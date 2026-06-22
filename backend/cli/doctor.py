import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .console import Console


@dataclass
class DoctorResult:
    level: str
    check: str
    message: str
    detail: str = ""


class BackendDoctor:
    SECRET_NAME_RE = re.compile(r"(secret|token|api[_-]?key|password|credential)", re.IGNORECASE)
    TOKEN_VALUE_RE = re.compile(
        r"(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|"
        r"AIza[0-9A-Za-z\-_]{35}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})"
    )

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = Path(base_dir or Path.cwd()).resolve()
        self.results: List[DoctorResult] = []
        self.build_data: Dict[str, Any] = {}
        self.config_data: Dict[str, Any] = {}

    def run(self, args: Iterable[str] = ()) -> int:
        args = list(args or [])
        strict = "--strict" in args

        self.results = []
        self._check_required_files()
        self._check_json_files()
        self._check_frontend_dist()
        self._check_requirements()
        self._check_build_config()
        self._check_router_sources()

        self._print_results()
        errors = sum(1 for item in self.results if item.level == "ERROR")
        warnings = sum(1 for item in self.results if item.level == "WARN")

        if errors:
            return 2
        if strict and warnings:
            return 1
        return 0

    def _add(self, level: str, check: str, message: str, detail: str = "") -> None:
        self.results.append(DoctorResult(level=level, check=check, message=message, detail=detail))

    def _read_json(self, path: Path) -> Optional[Dict[str, Any]]:
        try:
            with path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                self._add("OK", "json", f"{path.name} is valid JSON.")
                return data
            self._add("ERROR", "json", f"{path.name} must contain a JSON object.")
            return None
        except FileNotFoundError:
            self._add("ERROR", "json", f"{path.name} is missing.")
        except Exception as exc:
            self._add("ERROR", "json", f"{path.name} could not be read.", str(exc))
        return None

    def _check_required_files(self) -> None:
        for name in ("app.py", "cli.py", "build.json", "config.json", "requirements.txt", "version.txt"):
            path = self.base_dir / name
            if path.exists():
                self._add("OK", "files", f"{name} exists.")
            else:
                self._add("ERROR", "files", f"{name} is missing.")

    def _check_json_files(self) -> None:
        build_data = self._read_json(self.base_dir / "build.json")
        if build_data is not None:
            self.build_data = build_data
        config_data = self._read_json(self.base_dir / "config.json")
        if config_data is not None:
            self.config_data = config_data

    def _check_frontend_dist(self) -> None:
        frontend_index = (self.base_dir / ".." / "frontend" / "dist" / "index.html").resolve()
        if frontend_index.exists():
            self._add("OK", "frontend", "Frontend dist/index.html exists.", str(frontend_index))
        else:
            self._add("WARN", "frontend", "Frontend dist/index.html is missing.", str(frontend_index))

    def _check_requirements(self) -> None:
        req_path = self.base_dir / "requirements.txt"
        if not req_path.exists():
            return

        lines = req_path.read_text(encoding="utf-8-sig").splitlines()
        file_refs = [line for line in lines if " @ file:" in line.lower() or line.lower().startswith("file:")]
        if file_refs:
            self._add("ERROR", "requirements", f"{len(file_refs)} file:// requirements found.")
        else:
            self._add("OK", "requirements", "No file:// requirements found.")

        req_names = self._parse_requirement_names(lines)
        configured = self._configured_libraries()
        missing = sorted(name for name in configured if self._normalize_pkg(name) not in req_names)
        if missing:
            shown = ", ".join(missing[:12])
            suffix = " ..." if len(missing) > 12 else ""
            self._add("WARN", "requirements", "Some build.json libraries are missing from requirements.txt.", shown + suffix)
        elif configured:
            self._add("OK", "requirements", "All build.json libraries are present in requirements.txt.")

    def _parse_requirement_names(self, lines: Iterable[str]) -> set:
        names = set()
        for raw in lines:
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("-") or " @ file:" in line.lower():
                continue
            if "==" in line:
                name = line.split("==", 1)[0].strip()
            elif " @ " in line:
                name = line.split(" @ ", 1)[0].strip()
            else:
                name = re.split(r"[<>=!~]", line, maxsplit=1)[0].strip()
            if name:
                names.add(self._normalize_pkg(name))
        return names

    def _configured_libraries(self) -> List[str]:
        deps = self.build_data.get("dependencies", {}) if isinstance(self.build_data, dict) else {}
        libs = deps.get("libraries", {}) if isinstance(deps, dict) else {}
        if isinstance(libs, dict):
            return list(libs.keys())
        if isinstance(libs, list):
            return [str(item) for item in libs]
        return []

    def _normalize_pkg(self, name: str) -> str:
        return re.sub(r"[-_.]+", "-", name).lower()

    def _check_build_config(self) -> None:
        if not self.build_data:
            return

        bad_values = []
        self._walk_values(self.build_data, "", bad_values)
        if bad_values:
            for path, reason in bad_values[:12]:
                self._add("WARN", "build.json", f"{path} contains a token-like value.", reason)
        else:
            self._add("OK", "build.json", "No obvious tokens found in build.json.")

    def _walk_values(self, value: Any, path: str, out: List[Tuple[str, str]]) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}" if path else str(key)
                self._walk_values(child, child_path, out)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                self._walk_values(child, f"{path}[{index}]", out)
        elif isinstance(value, str):
            if self.SECRET_NAME_RE.search(path) and self.TOKEN_VALUE_RE.search(value):
                out.append((path, "contains a token-like value"))

    def _check_router_sources(self) -> None:
        router = self.build_data.get("router", []) if isinstance(self.build_data, dict) else []
        if not isinstance(router, list):
            self._add("ERROR", "router", "build.json router must be a list.")
            return

        missing = []
        for entry in router:
            if not isinstance(entry, dict):
                continue
            for key in ("view_module", "controller", "model"):
                module_name = entry.get(key)
                if not module_name:
                    continue
                source_path = self.base_dir / Path(str(module_name).replace(".", os.sep) + ".py")
                if not source_path.exists():
                    missing.append(f"{entry.get('blueprint', '?')}:{key}={module_name}")

        if missing:
            self._add("ERROR", "router", "Router source modules are missing.", ", ".join(missing[:12]))
        elif router:
            self._add("OK", "router", f"{len(router)} router entries have source modules.")

    def _print_results(self) -> None:
        order = {"ERROR": 0, "WARN": 1, "INFO": 2, "OK": 3}
        for item in sorted(self.results, key=lambda result: (order.get(result.level, 9), result.check)):
            style = "success"
            if item.level == "WARN":
                style = "warning"
            elif item.level == "ERROR":
                style = "error"
            elif item.level == "INFO":
                style = "info"
            detail = f" ({item.detail})" if item.detail else ""
            Console.print(f"[{item.level}] {item.check}: {item.message}{detail}", "DOCTOR", "CHECK", None, style)

        errors = sum(1 for item in self.results if item.level == "ERROR")
        warnings = sum(1 for item in self.results if item.level == "WARN")
        Console.print(f"Doctor completed: {errors} errors, {warnings} warnings.", "DOCTOR", "SUMMARY", None, "info")


def register_doctor(manager):
    def doctor_command(*args):
        code = BackendDoctor().run(args)
        if code:
            Console.print(f"Doctor returned exit code {code}.", "DOCTOR", "SUMMARY", None, "warning")

    manager.register_command(
        "doctor",
        doctor_command,
        "Run backend checks (--strict)"
    )
