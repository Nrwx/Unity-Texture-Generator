import subprocess
import os
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, List
from datetime import datetime
import tempfile
from packaging.version import parse as parse_version


class LibraryManager:
    """
    Automatisierter LibraryManager mit Live-Pip-Logging.
    """

    def __init__(self, log=None, config=None, base_path: Optional[Path] = None):
        self.log = log or (lambda *a, **k: None)
        self.config = config
        base = Path(base_path) if base_path else getattr(self.config, "base_dir", Path.cwd())
        self.base_path = Path(base)
        policy = {}
        try:
            policy = self.config.get_library_policy()
        except Exception:
            policy = {}
        self.work_path = Path(policy.get("work_path", ".")) if policy.get("work_path") else Path(".")
        self.requirements_name = policy.get("require_info") or policy.get("requirement_file") or "requirements.txt"

    # -----------------------
    # Internals (live pip logging)
    # -----------------------
    def _run_pip(self, *args: str, cwd: Optional[Path] = None) -> subprocess.CompletedProcess:
        """
        Führt pip aus und streamt stdout/stderr live über self.log.
        Liefert am Ende ein subprocess.CompletedProcess-ähnliches Objekt zurück.
        """
        cmd = [os.sys.executable, "-m", "pip", *args]
        work = (Path(cwd) if cwd else (self.base_path / self.work_path)).resolve()
        self.log(f"{' '.join(args)} wird ausgeführt…", "LIB-MANAGER", "PIP", "📦")

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(work),
                bufsize=1,
                universal_newlines=True,
            )
        except Exception as e:
            self.log(f"pip-Prozess konnte nicht starten: {e}", "LIB-MANAGER", "ERROR", "📛")
            return subprocess.CompletedProcess(cmd, 1, stdout="", stderr=str(e))

        stdout_lines: List[str] = []
        stderr_lines: List[str] = []

        def _read_stream(stream, collector, level_tag):
            try:
                for ln in iter(stream.readline, ""):
                    if not ln:
                        break
                    collector.append(ln)
            except Exception as ex:
                self.log(f"Fehler beim Lesen des Streams: {ex}", "LIB-MANAGER", "ERROR", "📛")

        t_out = threading.Thread(target=_read_stream, args=(proc.stdout, stdout_lines, "DEBUG"))
        t_err = threading.Thread(target=_read_stream, args=(proc.stderr, stderr_lines, "ERROR"))
        t_out.daemon = True
        t_err.daemon = True
        t_out.start()
        t_err.start()

        proc.wait()
        try:
            t_out.join(timeout=5)
            t_err.join(timeout=5)
        except Exception:
            pass

        stdout_str = "".join(stdout_lines)
        stderr_str = "".join(stderr_lines)

        # ----------------------------
        # Rückgabecode auswerten (pip)
        # ----------------------------
        rc = proc.returncode

        # Logmeldungen abhängig vom Returncode
        if rc == 0:
            self.log("Vorgang erfolgreich abgeschlossen.", "LIB-MANAGER", "INFO", "🔔")
        elif rc == 1:
            self.log("Paket oder Quelle konnten nicht aufgelöst werden!.", "LIB-MANAGER", "WARNING", "⚠️")
        elif rc == 2:
            self.log("Befehl oder Option/Flag konnte nicht ausgeführt werden!", "LIB-MANAGER", "WARNING", "⚠️")
        elif rc == 23:
            self.log("Paket konnte nicht gefunden werden!", "LIB-MANAGER", "ERROR", "📛")
        elif rc == 31:
            self.log("Konflikt bei der Paketinstallations-Version!", "LIB-MANAGER", "ERROR", "📛")
        else:
            self.log(f"Unbekannter Fehlercode: {rc}", "LIB-MANAGER", "ERROR", "📛")

        return subprocess.CompletedProcess(cmd, rc, stdout=stdout_str, stderr=stderr_str)

    def _get_installed_packages(self) -> Dict[str, str]:
        proc = self._run_pip("freeze")
        pkgs: Dict[str, str] = {}
        if proc.returncode != 0:
            self.log(f"pip freeze fehlgeschlagen: {proc.stderr}", "LIB-MANAGER", "WARNING", "⚠️")
            return pkgs
        for line in proc.stdout.splitlines():
            if "==" in line:
                name, version = line.split("==", 1)
                pkgs[name.lower()] = version
        return pkgs

    def _extract_libraries_scope(self, payload: Any) -> Dict[str, Any]:
        if not payload:
            return {}
        if isinstance(payload, dict) and "libraries" in payload:
            libs = payload.get("libraries") or {}
            if isinstance(libs, dict):
                return dict(libs)
            if isinstance(libs, list):
                return {str(n): {"version": "latest", "freeze": False} for n in libs}
        if isinstance(payload, dict):
            return dict(payload)
        return {}

    # -----------------------
    # check_integrity (works on libraries-scope)
    # -----------------------
    def check_integrity(self, libs_json: Dict[str, Any]) -> Dict[str, tuple]:
        libs_map = self._extract_libraries_scope(libs_json)
        installed = self._get_installed_packages()
        conflicts: Dict[str, tuple] = {}

        for name, meta in libs_map.items():
            expected = None
            if isinstance(meta, dict):
                expected = meta.get("version")
            name_low = name.lower()

            if name_low not in installed:
                conflicts[name] = (expected or "latest", "missing")
                continue

            found = installed[name_low]

            if isinstance(meta, dict):
                ver_raw = meta.get("version")
                freeze = bool(meta.get("freeze", False))
            else:
                ver_raw = None
                freeze = False

            ver_str = str(ver_raw).strip().lower() if ver_raw is not None else None

            if (ver_str is None or ver_str == "" or ver_str == "latest") and not freeze:
                conflicts[name] = ("latest", found)
                continue

            if freeze and ver_raw and ver_str != "latest" and found != str(ver_raw):
                conflicts[name] = (str(ver_raw), found)
                continue

            if ver_raw and ver_str != "latest" and found != str(ver_raw):
                conflicts[name] = (str(ver_raw), found)

        if len(conflicts) >= 5:
            self.log(f"Integritätstatus: 🔴", "LIB-MANAGER", "ERROR", "📛️")
        elif len(conflicts) >= 1:
            self.log(f"Integritätstatus: 🟡", "LIB-MANAGER", "WARNING", "⚠️")
        else:
            self.log("Integritätstatus: 🟢", "LIB-MANAGER", "INFO", "🔔")
        return conflicts

    # -----------------------
    # Requirements helpers
    # -----------------------
    def create_requirements_file(self, output_path: Optional[Path] = None, base_path: Optional[Path] = None) -> Path:
        cwd = Path(base_path) if base_path else None
        dest = Path(output_path) if output_path else (self.base_path / self.work_path / self.requirements_name)
        dest.parent.mkdir(parents=True, exist_ok=True)

        proc = self._run_pip("freeze", cwd=cwd)
        if proc.returncode != 0:
            self.log(f"pip freeze fehlgeschlagen: {proc.stderr}", "LIB-MANAGER", "ERROR", "📛")
            raise RuntimeError(f"pip freeze failed: {proc.stderr}")

        with open(dest, "w", encoding="utf-8") as f:
            f.write(proc.stdout)

        self.log("Derzeit installierte Abhängigkeiten aktualisiert…", "LIB-MANAGER", "INFO", "📄")
        return dest

    def parse_requirements_file(self, req_path: Path) -> Dict[str, Optional[str]]:
        mapping: Dict[str, Optional[str]] = {}
        if not req_path.exists():
            return mapping
        with open(req_path, "r", encoding="utf-8") as f:
            for ln in f:
                ln = ln.strip()
                if not ln or ln.startswith("#") or ln.startswith("-e") or ln.startswith("--") or ln.startswith("git+"):
                    continue
                if "==" in ln:
                    name, ver = ln.split("==", 1)
                    mapping[name.strip().lower()] = ver.strip()
                else:
                    mapping[ln.strip().lower()] = None
        return mapping

    def check_requirements_integrity(self, req_path: Path) -> Dict[str, Tuple[Optional[str], str]]:
        reqs = self.parse_requirements_file(req_path)
        installed = self._get_installed_packages()
        conflicts: Dict[str, Tuple[Optional[str], str]] = {}
        for name, expected in reqs.items():
            found = installed.get(name)
            if found is None:
                conflicts[name] = (expected, "missing")
            elif expected and expected != found:
                conflicts[name] = (expected, found)
        if len(conflicts) >= 5:
            self.log(f"Integritätstatus {self.requirements_name}: 🔴", "LIB-MANAGER", "ERROR", "📛️")
        elif len(conflicts) >= 1:
            self.log(f"Integritätstatus {self.requirements_name}: 🟡", "LIB-MANAGER", "WARNING", "⚠️")
        else:
            self.log(f"Integritätstatus {self.requirements_name}: 🟢", "LIB-MANAGER", "INFO", "🔔")
        return conflicts

    # -----------------------
    # Persist helpers
    # -----------------------
    def persist_full_libraries(self, libs_map: Dict[str, Any]) -> None:
        try:
            current_data = self.config.reload_from_disk() or {}
            deps = current_data.get("dependencies", {})
            deps["libraries"] = libs_map
            self.config.write_layer_management({"dependencies": deps})
        except Exception as e:
            self.log(f"Fehler beim speichern der 'build.json': {e}", "LIB-MANAGER", "ERROR", "📛")

    def reconcile_requirements_with_config(
        self,
        req_path: Optional[Path] = None,
        libs_payload: Optional[Dict[str, Any]] = None,
        auto_fix: bool = False,
        fix_with_requirements: bool = True,
        base_path: Optional[Path] = None,
        enable_cache: bool = True,
        use_cache: bool = True
    ) -> Dict[str, Tuple[Optional[str], str]]:
        req = Path(req_path) if req_path else (self.base_path / self.work_path / self.requirements_name)
        if not req.exists():
            req = self.create_requirements_file(output_path=req, base_path=base_path)

        req_map = self.parse_requirements_file(req)
        libs_map = self._extract_libraries_scope(libs_payload) or self.config.data.get("libraries", {})

        conflicts: Dict[str, Tuple[Optional[str], str]] = {}
        for name, meta in libs_map.items():
            expected = meta.get("version") if isinstance(meta, dict) else None
            found = req_map.get(name.lower())
            if found is None:
                conflicts[name] = (expected, "missing")
            elif expected and expected != "latest" and found != expected:
                conflicts[name] = (expected, found)

        if conflicts:
            self.log(f"Derzeit installierte Abhängigkeiten: {len(conflicts)} Konflikte gefunden!", "LIB-MANAGER", "WARN", "⚠️")
        else:
            self.log("Derzeit installierte Abhängigkeiten ohne Konflikte…", "LIB-MANAGER", "INFO", "🔔")

        if auto_fix and conflicts:
            concrete_pkgs = []
            latest_pkgs = []
            for pkg, (exp, _) in conflicts.items():
                if str(exp).lower() == "latest":
                    latest_pkgs.append(pkg)
                else:
                    concrete_pkgs.append((pkg, exp))

            if concrete_pkgs:
                if fix_with_requirements:
                    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt") as tf:
                        for pkg, exp in concrete_pkgs:
                            if exp and exp != "latest":
                                tf.write(f"{pkg}=={exp}\n")
                            else:
                                tf.write(f"{pkg}\n")
                        tmp_req = Path(tf.name)
                    cmd = ["install", "-r", str(tmp_req)]
                    if not enable_cache or not use_cache:
                        cmd.append("--no-cache-dir")
                    self._run_pip(*cmd, cwd=base_path)
                    try:
                        tmp_req.unlink()
                    except Exception:
                        pass
                else:
                    for pkg, exp in concrete_pkgs:
                        if exp and exp != "latest":
                            cmd = ["install", f"{pkg}=={exp}"]
                        else:
                            cmd = ["install", "--upgrade", pkg]
                        if not enable_cache or not use_cache:
                            cmd.append("--no-cache-dir")
                        self._run_pip(*cmd, cwd=base_path)

            for pkg in latest_pkgs:
                cmd = ["install", "--upgrade", pkg]
                if not enable_cache or not use_cache:
                    cmd.append("--no-cache-dir")
                self._run_pip(*cmd, cwd=base_path)

        # Refresh snapshot and persist all libraries
        installed = self._get_installed_packages()
        final_libs = {}
        for name, meta in libs_map.items():
            ver = installed.get(name.lower(), None)
            if isinstance(meta, dict) and str(meta.get("version")).lower() == "latest":
                final_ver = ver or "unknown"
            else:
                final_ver = ver or (meta.get("version") if isinstance(meta, dict) else None) or "unknown"
            final_libs[name] = {"version": final_ver, "freeze": meta.get("freeze", False)}

        try:
            self.persist_full_libraries(final_libs)
        except Exception as e:
            self.log(f"persist after reconcile failed: {e}", "LIB-MANAGER", "ERROR", "📛")

        return conflicts

    def update(
        self,
        libs_payload: Dict[str, Any],
        base_path: Optional[Path] = None,
        enable_cache: bool = True,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        libs_map = self._extract_libraries_scope(libs_payload)
        results: Dict[str, Any] = {}
        updated: Dict[str, Any] = {}

        installed_pkgs = self._get_installed_packages()

        # 1) Handle 'latest' first
        for key, meta in list(libs_map.items()):
            if not isinstance(meta, dict):
                continue
            if meta.get("freeze"):
                results[key] = {"status": "skipped (frozen)"}
                continue
            ver = str(meta.get("version") or "").strip().lower()
            if ver != "latest":
                continue

            cmd = ["install", "--upgrade", key]
            if not enable_cache or not use_cache:
                cmd.append("--no-cache-dir")
            proc = self._run_pip(*cmd, cwd=base_path)
            if proc.returncode == 0:
                installed_pkgs = self._get_installed_packages()
                new_ver = installed_pkgs.get(key.lower(), "unknown")
                old_ver = meta.get("version") or "missing"
                updated[key] = {"version": new_ver, "freeze": meta.get("freeze", False)}
                results[key] = {"status": "updated", "from": old_ver, "to": new_ver}
                self.log(f"Paket {key}: {old_ver} → {new_ver} aktualisiert…", "LIB-MANAGER", "INFO", "⬆️")
            else:
                results[key] = {"status": "error", "stderr": proc.stderr}
                self.log(f"Paket '{key}': update fehlgeschlagen: {proc.stderr}", "LIB-MANAGER", "ERROR", "❌")

        # 2) Concrete versions
        installed_pkgs = self._get_installed_packages()
        for key, meta in list(libs_map.items()):
            if not isinstance(meta, dict):
                continue
            if meta.get("freeze"):
                results.setdefault(key, {"status": "skipped (frozen)"})
                continue

            desired_raw = meta.get("version")
            desired = str(desired_raw).strip() if desired_raw is not None else ""
            desired_low = desired.lower()

            if desired_low == "latest":
                continue

            current_ver = installed_pkgs.get(key.lower())

            # treat empty desired as "latest"
            if not desired:
                cmd = ["install", "--upgrade", key]
            else:
                try:
                    if current_ver is None:
                        # not installed -> install desired
                        cmd = ["install", f"{key}=={desired}"]
                    else:
                        # version comparison
                        if parse_version(current_ver) < parse_version(desired):
                            cmd = ["install", f"{key}=={desired}"]
                        elif parse_version(current_ver) > parse_version(desired):
                            # Downgrade will happen if we proceed to install desired
                            self.log(f"Paket '{key}' wird downgraded: {current_ver} → {desired}…", "LIB-MANAGER", "WARN", "⬇️")
                            cmd = ["install", f"{key}=={desired}"]
                        else:
                            results[key] = {"status": "up-to-date", "version": current_ver}
                            continue
                except Exception:
                    # if parsing fails, conservative install
                    cmd = ["install", f"{key}=={desired}"]

            if not enable_cache or not use_cache:
                cmd.append("--no-cache-dir")
            proc = self._run_pip(*cmd, cwd=base_path)
            if proc.returncode == 0:
                installed_pkgs = self._get_installed_packages()
                new_ver = installed_pkgs.get(key.lower(), "unknown")
                updated[key] = {"version": new_ver, "freeze": meta.get("freeze", False)}
                results[key] = {"status": "updated", "version": new_ver}
                libs_payload.setdefault(key, {})["version"] = new_ver
                self.log(f"Paket '{key}': → {new_ver} installiert…", "LIB-MANAGER", "INFO", "⬆️")
            else:
                results[key] = {"status": "error", "stderr": proc.stderr}
                self.log(f"Paket '{key}': installation fehlgeschlagen: {proc.stderr}", "LIB-MANAGER", "ERROR", "❌")

        # Persist full libraries section (merge into build.json)
        try:
            current_data = self.config.reload_from_disk() or {}
            deps = current_data.get("dependencies", {})
            final_libraries = {}
            for k, v in self._extract_libraries_scope(libs_payload).items():
                if isinstance(v, dict):
                    final_libraries[k] = {"version": v.get("version"), "freeze": bool(v.get("freeze", False))}
                else:
                    final_libraries[k] = {"version": v, "freeze": False}
            deps["libraries"] = final_libraries
            deps["last_build"] = datetime.utcnow().isoformat() + "Z"
            self.config.write_layer_management({"dependencies": deps})
        except Exception as e:
            self.log(f"Speichern nach update fehlgeschlagen: {e}", "LIB-MANAGER", "ERROR", "📛")

        return results

    # -----------------------
    # Install / Uninstall / Freeze / Sync
    # -----------------------
    def install(
        self,
        libs_payload: Dict[str, Any],
        base_path: Optional[Path] = None,
        enable_cache: bool = True,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        libs_map = self._extract_libraries_scope(libs_payload)
        results: Dict[str, Any] = {}
        updated: Dict[str, Any] = {}

        for key, meta in libs_map.items():
            version = str(meta.get("version", "")).lower() if isinstance(meta, dict) else None
            cmd = ["install"]

            if version == "latest" or not version:
                cmd += ["--upgrade", key]
            else:
                cmd += [f"{key}=={version}"]

            if not enable_cache or not use_cache:
                cmd.append("--no-cache-dir")

            proc = self._run_pip(*cmd, cwd=base_path)

            if proc.returncode == 0:
                ver = self._get_installed_packages().get(key.lower(), "unknown")
                old_ver = meta.get("version") or "missing"
                updated[key] = {"version": ver, "freeze": meta.get("freeze", False)}
                results[key] = {"status": "installed", "from": old_ver, "to": ver}
                self.log(f"Paket '{key}': {old_ver} → {ver} installiert/aktualisiert…", "LIB-MANAGER", "INFO", "⬆️")
            else:
                results[key] = {"status": "error", "stderr": proc.stderr}
                self.log(f"Paket '{key}' installation fehlgeschlagen: {proc.stderr}", "LIB-MANAGER", "ERROR", "❌")

        if updated:
            self.persist_full_libraries(updated)
            for k, v in updated.items():
                if v["version"] and v["version"] != "latest":
                    libs_payload[k]["version"] = v["version"]

        return results

    def down(self, requirements_path: Optional[Path] = None, base_path: Optional[Path] = None) -> Dict[str, Any]:
        req = Path(requirements_path) if requirements_path else (self.base_path / self.work_path / self.requirements_name)
        proc = self._run_pip("install", "-r", str(req), cwd=base_path)
        if proc.returncode != 0:
            self.log(f"pip install -r failed: {proc.stderr}", "LIB-MANAGER", "ERROR", "📛")
            return {"status": "error", "stderr": proc.stderr}
        return {"status": "ok", "integrity": self.check_requirements_integrity(req)}

    def uninstall(self, libs_payload: Dict[str, Any], base_path: Optional[Path] = None) -> Dict[str, Any]:
        libs_map = self._extract_libraries_scope(libs_payload)
        results: Dict[str, Any] = {}
        for key in libs_map.keys():
            proc = self._run_pip("uninstall", "-y", key, cwd=base_path)
            results[key] = {"status": "removed" if proc.returncode == 0 else "error"}
        return results

    def freeze(self, libs_payload: Dict[str, Any], state: bool = True) -> Dict[str, Any]:
        libs_map = self._extract_libraries_scope(libs_payload)
        for meta in libs_map.values():
            if not isinstance(meta, dict):
                continue
            meta["freeze"] = state
            if not state:
                meta["version"] = "latest"
        self.persist_full_libraries(libs_map)
        return {"status": "freeze_set", "count": len(libs_map)}

    def sync_all(
        self,
        base_path: Optional[Path] = None,
        auto_fix_requirements: bool = True,
        fix_with_requirements: bool = True,
    ) -> Dict[str, Any]:
        report: Dict[str, Any] = {"steps": []}
        try:
            req = self.create_requirements_file(base_path=base_path)
            report["steps"].append({"create_requirements": str(req)})

            conflicts = self.reconcile_requirements_with_config(
                req_path=req,
                auto_fix=auto_fix_requirements,
                fix_with_requirements=fix_with_requirements,
                base_path=base_path,
            )
            report["steps"].append({"reconcile_conflicts": conflicts})

            libs_map = self.config.data.get("libraries", {})
            integrity = self.check_integrity(libs_map)
            report["steps"].append({"integrity_conflicts": integrity})

            if integrity:
                upd_res = self.update(integrity, base_path=base_path)
                report["steps"].append({"update_result": upd_res})
            else:
                report["steps"].append({"update_result": "no action"})
            report["status"] = "ok"
        except Exception as e:
            self.log(f"sync_all failed: {e}", "LIB-MANAGER", "ERROR", "📛")
            report["status"] = "error"
            report["error"] = str(e)
        return report

    def init_and_sync(self) -> Dict[str, Any]:
        policy = self.config.get_library_policy() or {}
        report_path = Path(policy.get("report_path", "./library_sync_report.json"))

        auto_fix = policy.get("auto_fix_requirements", True)
        fix_with_req = policy.get("fix_with_requirements", True)
        enable_cache = policy.get("enable_cache", True)
        use_cache = policy.get("use_cache", True)
        auto_update = policy.get("auto_update", True)

        # reload to ensure build.json is read freshly
        try:
            self.config.reload_from_disk()
        except Exception:
            pass

        self.log("Initialisiere Library-Manager gemäß den Abhängigkeiten… (build.json)", "LIB-MANAGER", "INFO", "🚀")

        report: Dict[str, Any] = {"steps": []}
        try:
            libs_map = self.config.data.get("libraries", {})

            if auto_update:
                report["steps"].append({"pre_update_latest": "starting"})
                pre_update_res = self.update(
                    libs_payload=libs_map,
                    base_path=self.base_path,
                    enable_cache=enable_cache,
                    use_cache=use_cache
                )
                report["steps"].append({"pre_update_result": pre_update_res})
                self.log(f"Es sind {len(pre_update_res)}/{len(libs_map)} Pakete auf dem neusten stand!", "LIB-MANAGER", "INFO", "🔔")

            req = self.create_requirements_file(base_path=self.base_path)
            report["steps"].append({"create_requirements": str(req)})
            self.log(f"Derzeit installierte Abhängigkeiten exportiert… ({self.requirements_name})", "LIB-MANAGER", "INFO", "💾")

            conflicts = self.reconcile_requirements_with_config(
                req_path=req,
                auto_fix=auto_fix,
                fix_with_requirements=fix_with_req,
                base_path=self.base_path,
                enable_cache=enable_cache,
                use_cache=use_cache
            )
            report["steps"].append({"reconcile_conflicts": conflicts})

            self.log(f"Abgleich der Unterschiede in '{self.requirements_name}'…", "LIB-MANAGER", "INFO", "🔎")
            if len(conflicts) > 0:
                self.log(f"Es sind ({len(conflicts)}) Konflikte vorhanden!", "LIB-MANAGER", "WARNING", "⚠️")
            else:
                self.log("Keine Konflikte gefunden!", "LIB-MANAGER", "INFO", "🔔")

            libs_map = self.config.data.get("libraries", {})
            integrity = self.check_integrity(libs_map)
            report["steps"].append({"integrity_conflicts": integrity})
            self.log("Abgleich der Integritätskonflikte…", "LIB-MANAGER", "INFO", "🔎")
            if len(integrity) > 0:
                self.log(f"Es sind ({len(integrity)}) Integritätskonflikte vorhanden!", "LIB-MANAGER", "WARNING", "⚠️")
            else:
                self.log(f"Keine Integritätskonflikte gefunden!", "LIB-MANAGER", "INFO", "🔔")

            if auto_update and integrity:
                upd_res = self.update(
                    libs_payload=libs_map,
                    base_path=self.base_path,
                    enable_cache=enable_cache,
                    use_cache=use_cache
                )
                report["steps"].append({"update_result": upd_res})
                self.log(f"Synchronisieren des Intigritätsberichtes → {upd_res}…", "LIB-MANAGER", "INFO", "⬆️")
            else:
                report["steps"].append({"update_result": "no action"})
                self.log("Kein synchronisieren notwendig!", "LIB-MANAGER", "INFO", "🔔")

            report["status"] = "ok"

        except Exception as e:
            self.log(f"init_and_sync failed: {e}", "LIB-MANAGER", "ERROR", "📛")
            report["status"] = "error"
            report["error"] = str(e)

        # persist timestamp + merge
        deps = self.config.data.get("dependencies", {})
        deps["last_build"] = datetime.utcnow().isoformat() + "Z"
        self.config.write_layer_management({"dependencies": deps})

        if policy.get("report_persist", True):
            report_path.parent.mkdir(parents=True, exist_ok=True)
            with open(report_path, "w", encoding="utf-8") as f:
                import json
                json.dump(report, f, indent=2)
            self.log(f"Ein vollständiger Intigritätsbericht wurde exportiert. ({report_path})", "LIB-MANAGER", "INFO", "💾")

        return report
