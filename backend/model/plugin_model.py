import os
import json
import time
import shutil
import zipfile
import threading
import importlib.util
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from flask import request
from werkzeug.utils import secure_filename

from model.base.main import BaseModel
from generated.paths import ASSETS_PLUGIN_FOLDER, PUBLIC_PLUGIN_FOLDER

try:
    import psutil
except Exception:
    psutil = None

load_dotenv()

GLOBAL_MANIFEST_NAME = "manifest.json"
PLUGIN_MANIFEST_NAME = "manifest.json"

PLUGIN_JOBS = {}
PLUGIN_JOBS_LOCK = threading.RLock()
PLUGIN_MANIFEST_LOCK = threading.RLock()

class PluginModel(BaseModel):
    """
    Plugin Manager API.

    Core/plugin.py setzt nur:
        PLUGIN_PATH

    Dieses Model übernimmt:
        - Pre-Plugins aus assets/plugin installieren/vorbereiten
        - public/plugin als Standard/Fallback einbeziehen
        - PLUGIN_PATH als aktiven WorkDir verwenden
        - manifest.json lesen/schreiben
        - main.py laden
        - main.save(manifest, context) ausführen
        - install:false respektieren
        - Uploads vorbereiten
        - repair/uninstall/toggle
        - XHR-/Action-Tracking im Manifest
        - install/repair als Background-Jobs, damit HTTP-Requests nicht blockieren
        - Download-Monitoring während blockierender save()/snapshot_download()-Aufrufe

    Frontend-Kompatibilität:
        fetch() gibt direkt eine Plugin-Liste zurück.
        scan() gibt das vollständige Scan-Objekt zurück.
    """

    # -------------------------------------------------------------------------
    # Registry / Core
    # -------------------------------------------------------------------------

    @classmethod
    def _registry(cls):
        try:
            return syslink.get("registry")
        except NameError:
            raise RuntimeError("syslink ist nicht verfügbar. Registry konnte nicht gelesen werden.")

    @staticmethod
    def _now_ms() -> int:
        return int(time.time() * 1000)

    @staticmethod
    def _abs(path: str) -> str:
        return os.path.abspath(os.path.expanduser(path))

    @staticmethod
    def _ensure_dir(path: str) -> str:
        os.makedirs(path, exist_ok=True)
        return path

    @staticmethod
    def _safe_id(value: str) -> str:
        return (
            str(value or "")
            .strip()
            .replace("/", "__")
            .replace("\\", "__")
            .replace(":", "_")
            .replace(" ", "_")
        )

    @staticmethod
    def _resolve_hf_token() -> Optional[str]:
        return (
            os.environ.get("HF_TOKEN")
            or os.environ.get("HUGGINGFACE_HUB_TOKEN")
        )

    @classmethod
    def _log(cls, msg: str, level: str = "INFO", icon: str = "🔌"):
        try:
            log(msg, "SYSTEM", "PLUGIN", icon)
        except Exception:
            pass

    @classmethod
    def _job_key(cls, plugin_id: str, action: str) -> str:
        return f"{cls._safe_id(plugin_id)}:{action}"

    @classmethod
    def _is_job_running(cls, plugin_id: str, action: str) -> bool:
        key = cls._job_key(plugin_id, action)

        with PLUGIN_JOBS_LOCK:
            job = PLUGIN_JOBS.get(key)

            if not job:
                return False

            thread = job.get("thread")

            if thread and thread.is_alive():
                return True

            PLUGIN_JOBS.pop(key, None)
            return False

    @classmethod
    def _is_any_job_running(cls, plugin_id: str) -> bool:
        plugin_id = cls._safe_id(plugin_id)

        return (
            cls._is_job_running(plugin_id, "install")
            or cls._is_job_running(plugin_id, "repair")
        )

    @classmethod
    def _mark_job_failed(cls, plugin_id: str, action: str, error: Exception):
        try:
            paths = cls._paths()
            plugin_id = cls._safe_id(plugin_id)
            plugin_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)

            manifest = cls._read_plugin_manifest(plugin_root)
            if not manifest:
                return

            manifest = cls._validate_plugin_manifest(manifest, plugin_root)
            manifest.setdefault("status", {})

            manifest["status"]["installed"] = False
            manifest["status"]["saved"] = False
            manifest["status"]["skipped"] = False
            manifest["status"]["error"] = str(error)

            cls._set_tracking(
                manifest,
                plugin_root,
                action=action,
                phase="error",
                progress=100,
                message=f"{action} fehlgeschlagen: {plugin_id}",
                error=str(error)
            )
        except Exception:
            pass

    @classmethod
    def _normalize_runtime_status(
        cls,
        plugin_id: str,
        manifest: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Korrigiert Runtime-Status beim fetch/scan.

        Wichtig:
        - fetch() darf xhr nicht sofort killen, nur weil PLUGIN_JOBS leer ist.
        - Bei Dev-Server/Multiworker kann der Background-Thread in einem anderen Prozess liegen.
        - Deshalb vertrauen wir aktiven Manifest-Phasen zuerst.
        - Erst nach Timeout wird ein hängender Job als error markiert.
        """
        manifest.setdefault("status", {})
        status = manifest["status"]

        action = status.get("action")
        phase = status.get("phase")

        active_phase = phase in ("prepare", "copy", "install", "repair")
        terminal_phase = phase in ("done", "error", "skipped", "idle")

        running_in_memory = bool(action and cls._is_job_running(plugin_id, action))

        now = cls._now_ms()
        started_at = status.get("startedAt") or 0
        heartbeat_at = status.get("heartbeatAt") or started_at or 0

        try:
            heartbeat_at = int(heartbeat_at or 0)
        except Exception:
            heartbeat_at = 0

        stale_after_ms = 6 * 60 * 60 * 1000

        is_stale = (
            active_phase
            and status.get("xhr") is True
            and heartbeat_at > 0
            and now - heartbeat_at > stale_after_ms
        )

        if active_phase and not is_stale:
            status["xhr"] = True
            status["running"] = True
            status["finishedAt"] = None

            if running_in_memory:
                status["heartbeatAt"] = now

            return manifest

        if running_in_memory:
            status["xhr"] = True
            status["running"] = True
            status["heartbeatAt"] = now
            status["finishedAt"] = None
            return manifest

        if terminal_phase:
            status["xhr"] = False
            status["running"] = False
            return manifest

        if is_stale:
            status["xhr"] = False
            status["running"] = False
            status["phase"] = "error"
            status["progress"] = 100
            status["finishedAt"] = now
            status["error"] = (
                status.get("error")
                or "Plugin-Aktion ist abgelaufen oder wurde unerwartet beendet."
            )
            status["message"] = status.get("message") or "Plugin-Aktion wurde unterbrochen."

        return manifest

    @classmethod
    def _start_background_job(cls, plugin_id: str, action: str, target, *args, **kwargs):
        """
        Startet eine Plugin-Aktion im Hintergrund.

        Wichtig:
        - HTTP-Request kehrt sofort zurück.
        - Manifest wird vom Background-Thread aktualisiert.
        - Frontend pollt per fetchPlugin().
        """
        plugin_id = cls._safe_id(plugin_id)
        key = cls._job_key(plugin_id, action)

        with PLUGIN_JOBS_LOCK:
            existing = PLUGIN_JOBS.get(key)
            if existing:
                thread = existing.get("thread")
                if thread and thread.is_alive():
                    return False

            def runner():
                try:
                    target(*args, **kwargs)
                except Exception as e:
                    cls._mark_job_failed(plugin_id, action, e)
                    cls._log(
                        f"Background Plugin Job fehlgeschlagen: {plugin_id}/{action}: {e}",
                        "ERROR",
                        "📛"
                    )
                finally:
                    with PLUGIN_JOBS_LOCK:
                        PLUGIN_JOBS.pop(key, None)

            thread = threading.Thread(
                target=runner,
                name=f"plugin-{plugin_id}-{action}",
                daemon=True
            )

            PLUGIN_JOBS[key] = {
                "pluginId": plugin_id,
                "action": action,
                "thread": thread,
                "startedAt": cls._now_ms()
            }

            thread.start()
            return True

    @classmethod
    def initialize(cls):
        try:
            return cls.install_all()
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def _paths(cls) -> Dict[str, str]:
        r = cls._registry()
        active_work_dir = r.get("PLUGIN_PATH")

        if not active_work_dir:
            raise RuntimeError("PLUGIN_PATH fehlt in Registry. core/plugin.py wurde nicht initialisiert.")

        standard_work_dir = PUBLIC_PLUGIN_FOLDER
        asset_dir = ASSETS_PLUGIN_FOLDER

        cls._ensure_dir(active_work_dir)
        cls._ensure_dir(standard_work_dir)
        cls._ensure_dir(asset_dir)

        return {
            "assetDir": cls._abs(asset_dir),
            "standardWorkDir": cls._abs(standard_work_dir),
            "activeWorkDir": cls._abs(active_work_dir)
        }

    # -------------------------------------------------------------------------
    # JSON / Manifest Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _json_load(path: str, fallback: Any):
        if not os.path.exists(path):
            return fallback

        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return fallback

    @staticmethod
    def _json_save(path: str, data: Any) -> str:
        os.makedirs(os.path.dirname(path), exist_ok=True)

        last_error = None

        with PLUGIN_MANIFEST_LOCK:
            for attempt in range(20):
                tmp_path = f"{path}.{threading.get_ident()}.{attempt}.tmp"

                try:
                    with open(tmp_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                        f.flush()
                        os.fsync(f.fileno())

                    os.replace(tmp_path, path)
                    return path

                except PermissionError as e:
                    last_error = e
                    try:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)
                    except Exception:
                        pass

                    time.sleep(0.1 + (attempt * 0.05))

                except OSError as e:
                    last_error = e
                    try:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)
                    except Exception:
                        pass

                    time.sleep(0.1 + (attempt * 0.05))

        raise last_error

    @staticmethod
    def _global_manifest_path(plugin_work_dir: str) -> str:
        return os.path.join(plugin_work_dir, GLOBAL_MANIFEST_NAME)

    @staticmethod
    def _plugin_manifest_path(plugin_root: str) -> str:
        return os.path.join(plugin_root, PLUGIN_MANIFEST_NAME)

    @classmethod
    def _plugin_root(cls, work_dir: str, plugin_id: str) -> str:
        return os.path.join(work_dir, cls._safe_id(plugin_id))

    @classmethod
    def _pause_marker_path(cls, plugin_root: str) -> str:
        return os.path.join(plugin_root, ".plugin_pause")

    @classmethod
    def _clear_pause_marker(cls, plugin_root: str):
        path = cls._pause_marker_path(plugin_root)
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    @classmethod
    def _write_pause_marker(cls, plugin_root: str):
        os.makedirs(plugin_root, exist_ok=True)
        path = cls._pause_marker_path(plugin_root)

        with open(path, "w", encoding="utf-8") as f:
            f.write(str(cls._now_ms()))

        return path

    @classmethod
    def _read_plugin_manifest(cls, plugin_root: str) -> Optional[Dict[str, Any]]:
        path = cls._plugin_manifest_path(plugin_root)

        if not os.path.exists(path):
            return None

        data = cls._json_load(path, None)

        if not isinstance(data, dict):
            return None

        return data

    @classmethod
    def _validate_plugin_manifest(
        cls,
        manifest: Dict[str, Any],
        plugin_root: str,
        source: str = "unknown"
    ) -> Dict[str, Any]:
        plugin_id = cls._safe_id(
            manifest.get("pluginId")
            or manifest.get("id")
            or os.path.basename(plugin_root)
        )

        manifest["pluginId"] = plugin_id
        manifest.setdefault("id", plugin_id)
        manifest.setdefault("name", plugin_id)
        manifest.setdefault("type", "plugin")
        manifest.setdefault("source", source)
        manifest.setdefault("active", True)

        manifest.setdefault("install", False)
        manifest.setdefault("entry", "main.py")
        manifest.setdefault("api", {"save": "save"})
        manifest.setdefault("config", {})
        manifest.setdefault("paths", {})
        manifest.setdefault("status", {})
        manifest.setdefault("createdAt", cls._now_ms())

        manifest["paths"]["root"] = plugin_root
        manifest["paths"].setdefault("main", manifest.get("entry", "main.py"))
        manifest["paths"].setdefault("data", "data")

        status = manifest["status"]

        status.setdefault("installed", False)
        status.setdefault("saved", False)
        status.setdefault("skipped", False)
        status.setdefault("error", None)
        status.setdefault("path", None)

        status.setdefault("xhr", False)
        status.setdefault("running", False)
        status.setdefault("action", None)
        status.setdefault("phase", "idle")
        status.setdefault("progress", 0)
        status.setdefault("startedAt", None)
        status.setdefault("heartbeatAt", None)
        status.setdefault("finishedAt", None)
        status.setdefault("message", None)

        status.setdefault("expectedBytes", 0)
        status.setdefault("presentBytes", 0)
        status.setdefault("finalPresentBytes", 0)
        status.setdefault("partialCacheBytes", 0)
        status.setdefault("monitorBytes", 0)

        status.setdefault("paused", False)
        status.setdefault("pauseRequested", False)

        # Download-Fortschritt
        status.setdefault("downloadedBytesAtStart", 0)
        status.setdefault("downloadedBytesThisRun", 0)
        status.setdefault("remainingBytes", 0)

        # Zeitbasis für echte Durchschnittsgeschwindigkeit.
        # Wird erst gesetzt, sobald wirklich neue Bytes dazukommen.
        status.setdefault("downloadStartedAt", None)
        status.setdefault("downloadElapsedSeconds", 0)

        # Geschwindigkeit
        status.setdefault("currentDownloadBytesPerSecond", 0)   # exakt letztes Intervall
        status.setdefault("averageDownloadBytesPerSecond", 0)   # echte Ø-Geschwindigkeit
        status.setdefault("speedBytesPerSecond", 0)             # geglättet / legacy

        # Sample-Basis
        status.setdefault("speedSampleAt", None)
        status.setdefault("speedSampleBytes", 0)

        # ETA ist Dauer in Sekunden, kein Timestamp
        status.setdefault("etaSeconds", None)

        # Netzwerk live/geglättet
        status.setdefault("networkReceiveBitsPerSecondCurrent", 0)
        status.setdefault("networkSendBitsPerSecondCurrent", 0)

        status.setdefault("networkReceiveBitsPerSecond", 0)
        status.setdefault("networkSendBitsPerSecond", 0)
        status.setdefault("networkAdapter", None)
        status.setdefault("networkSampleAt", None)
        status.setdefault("networkSampleRecv", 0)
        status.setdefault("networkSampleSent", 0)

        status.setdefault("remainingBytes", 0)

        status.setdefault("currentFile", None)
        status.setdefault("currentFileExpectedBytes", 0)
        status.setdefault("currentFilePresentBytes", 0)
        status.setdefault("currentFileRemainingBytes", 0)

        status.setdefault("currentFileStartPresentBytes", 0)
        status.setdefault("currentFileIndex", 0)
        status.setdefault("currentFileCount", 0)

        status.setdefault("networkDownloadStartedAt", None)
        status.setdefault("networkDownloadedBytesThisRun", 0)
        status.setdefault("networkAverageReceiveBytesPerSecond", 0)
        status.setdefault("networkEtaSeconds", None)

        status.setdefault("expectedFileCount", 0)
        status.setdefault("completeFileCount", 0)
        status.setdefault("missingFileCount", 0)
        status.setdefault("partialFileCount", 0)
        status.setdefault("missingFiles", [])
        status.setdefault("partialFiles", [])

        manifest["updatedAt"] = cls._now_ms()

        return manifest

    @staticmethod
    def _should_install(manifest: Dict[str, Any]) -> bool:
        return bool(manifest.get("install", False))

    # -------------------------------------------------------------------------
    # XHR / Action Tracking
    # -------------------------------------------------------------------------

    @classmethod
    def _set_tracking(
        cls,
        manifest: Dict[str, Any],
        plugin_root: str,
        action: str,
        phase: str,
        progress: int,
        message: Optional[str] = None,
        error: Optional[str] = None,
        save: bool = True
    ) -> Dict[str, Any]:
        manifest.setdefault("status", {})

        is_active = phase not in ("idle", "done", "error", "skipped")

        manifest["status"]["xhr"] = is_active
        manifest["status"]["running"] = is_active
        manifest["status"]["action"] = action
        manifest["status"]["phase"] = phase
        manifest["status"]["progress"] = max(0, min(100, int(progress)))
        manifest["status"]["message"] = message
        manifest["status"]["error"] = error
        manifest["status"]["heartbeatAt"] = cls._now_ms()

        if phase in ("prepare", "copy", "install", "repair"):
            if not manifest["status"].get("startedAt"):
                manifest["status"]["startedAt"] = cls._now_ms()
            manifest["status"]["finishedAt"] = None

        if phase in ("done", "error", "skipped"):
            manifest["status"]["xhr"] = False
            manifest["status"]["running"] = False
            manifest["status"]["finishedAt"] = cls._now_ms()

        manifest["updatedAt"] = cls._now_ms()

        if save:
            cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)

        return manifest

    @classmethod
    def _reset_tracking(
        cls,
        manifest: Dict[str, Any],
        plugin_root: str,
        action: str,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        manifest.setdefault("status", {})

        status = manifest["status"]

        status["xhr"] = True
        status["running"] = True
        status["paused"] = False
        status["pauseRequested"] = False
        status["action"] = action
        status["phase"] = "prepare"
        status["progress"] = 1
        status["startedAt"] = cls._now_ms()
        status["heartbeatAt"] = cls._now_ms()
        status["finishedAt"] = None
        status["message"] = message or f"{action} gestartet"
        status["error"] = None

        initial_present = int(status.get("presentBytes") or 0)
        now = cls._now_ms()

        status["downloadedBytesAtStart"] = initial_present
        status["downloadedBytesThisRun"] = 0
        status["remainingBytes"] = 0

        status["downloadStartedAt"] = None
        status["downloadElapsedSeconds"] = 0

        status["currentDownloadBytesPerSecond"] = 0
        status["averageDownloadBytesPerSecond"] = 0
        status["speedBytesPerSecond"] = 0

        status["speedSampleAt"] = now
        status["speedSampleBytes"] = initial_present

        status["etaSeconds"] = None

        status["remainingBytes"] = 0

        status["currentFile"] = None
        status["currentFileExpectedBytes"] = 0
        status["currentFilePresentBytes"] = 0
        status["currentFileRemainingBytes"] = 0

        status["networkDownloadStartedAt"] = None
        status["networkDownloadedBytesThisRun"] = 0
        status["networkAverageReceiveBytesPerSecond"] = 0
        status["networkEtaSeconds"] = None

        manifest["updatedAt"] = cls._now_ms()

        cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)
        return manifest

    # -------------------------------------------------------------------------
    # Download Monitor
    # -------------------------------------------------------------------------

    @classmethod
    def _resolve_data_path_from_manifest(
        cls,
        plugin_root: str,
        manifest: Dict[str, Any]
    ) -> str:
        status = manifest.get("status", {})
        paths = manifest.get("paths", {})
        config = manifest.get("config", {})

        candidate = (
            status.get("path")
            or paths.get("data")
            or config.get("saveDir")
            or "data"
        )

        if os.path.isabs(str(candidate)):
            return cls._abs(str(candidate))

        return cls._abs(os.path.join(plugin_root, str(candidate)))

    @classmethod
    def _network_adapter_name(cls) -> Optional[str]:
        """
        Optional per ENV festlegen:
            PLUGIN_NETWORK_ADAPTER="Wi-Fi 3"

        Wenn nicht gesetzt, nimmt er den aktivsten Adapter.
        """
        return (
            os.environ.get("PLUGIN_NETWORK_ADAPTER")
            or os.environ.get("NETWORK_ADAPTER")
        )

    @classmethod
    def _read_network_counters(cls, preferred_adapter: Optional[str] = None):
        if psutil is None:
            return None

        try:
            counters = psutil.net_io_counters(pernic=True)
        except Exception:
            return None

        if not counters:
            return None

        if preferred_adapter and preferred_adapter in counters:
            c = counters[preferred_adapter]
            return preferred_adapter, int(c.bytes_recv), int(c.bytes_sent)

        # Fallback: aktivsten Adapter nehmen.
        best_name = None
        best_total = -1

        for name, c in counters.items():
            total = int(c.bytes_recv) + int(c.bytes_sent)
            if total > best_total:
                best_total = total
                best_name = name

        if not best_name:
            return None

        c = counters[best_name]
        return best_name, int(c.bytes_recv), int(c.bytes_sent)

    @classmethod
    def _update_network_speed_status(cls, status: Dict[str, Any]):
        sample = cls._read_network_counters(cls._network_adapter_name())

        if not sample:
            return

        adapter_name, recv_bytes, sent_bytes = sample
        now = cls._now_ms()

        previous_at = int(status.get("networkSampleAt") or 0)
        previous_recv = int(status.get("networkSampleRecv") or 0)
        previous_sent = int(status.get("networkSampleSent") or 0)

        if previous_at > 0 and now > previous_at:
            delta_seconds = max(0.001, (now - previous_at) / 1000)

            delta_recv_bytes = max(0, recv_bytes - previous_recv)
            delta_sent_bytes = max(0, sent_bytes - previous_sent)

            recv_bits_per_second_current = int((delta_recv_bytes * 8) / delta_seconds)
            sent_bits_per_second_current = int((delta_sent_bytes * 8) / delta_seconds)

            status["networkReceiveBitsPerSecondCurrent"] = recv_bits_per_second_current
            status["networkSendBitsPerSecondCurrent"] = sent_bits_per_second_current

            old_recv = int(status.get("networkReceiveBitsPerSecond") or 0)
            old_sent = int(status.get("networkSendBitsPerSecond") or 0)

            recv_bits_per_second_smooth = recv_bits_per_second_current
            sent_bits_per_second_smooth = sent_bits_per_second_current

            if old_recv > 0:
                recv_bits_per_second_smooth = int((old_recv * 0.6) + (recv_bits_per_second_current * 0.4))

            if old_sent > 0:
                sent_bits_per_second_smooth = int((old_sent * 0.6) + (sent_bits_per_second_current * 0.4))

            status["networkReceiveBitsPerSecond"] = recv_bits_per_second_smooth
            status["networkSendBitsPerSecond"] = sent_bits_per_second_smooth

            # Netzwerk-Ø nur starten, wenn wirklich Downloadtraffic sichtbar ist.
            # Kleine Werte ignorieren, damit Idle/HTTP-Metadaten nicht sofort den Ø verfälschen.
            min_download_delta_bytes = 32 * 1024

            if delta_recv_bytes >= min_download_delta_bytes:
                if not status.get("networkDownloadStartedAt"):
                    status["networkDownloadStartedAt"] = previous_at

                status["networkDownloadedBytesThisRun"] = int(
                    status.get("networkDownloadedBytesThisRun") or 0
                ) + int(delta_recv_bytes)

            started_at = int(status.get("networkDownloadStartedAt") or 0)
            downloaded_network_bytes = int(status.get("networkDownloadedBytesThisRun") or 0)

            network_average_bytes_per_second = 0

            if started_at > 0 and now > started_at and downloaded_network_bytes > 0:
                elapsed_seconds = max(0.001, (now - started_at) / 1000)
                network_average_bytes_per_second = int(downloaded_network_bytes / elapsed_seconds)

            status["networkAverageReceiveBytesPerSecond"] = int(network_average_bytes_per_second)

            remaining_bytes = int(status.get("remainingBytes") or 0)

            if remaining_bytes > 0 and network_average_bytes_per_second > 0:
                status["networkEtaSeconds"] = int(remaining_bytes / network_average_bytes_per_second)
                status["etaSeconds"] = int(status["networkEtaSeconds"])
            else:
                status["networkEtaSeconds"] = None
                status["etaSeconds"] = None

            # Für Frontend-Kompatibilität:
            # Ø-Speed soll sich jetzt allein aufs Netzwerk beziehen.
            status["averageDownloadBytesPerSecond"] = int(network_average_bytes_per_second)

        status["networkAdapter"] = adapter_name
        status["networkSampleAt"] = now
        status["networkSampleRecv"] = recv_bytes
        status["networkSampleSent"] = sent_bytes

    @classmethod
    def _file_size_safe(cls, path: str) -> int:
        try:
            if os.path.isfile(path):
                return int(os.path.getsize(path))
        except OSError:
            pass
        return 0

    @classmethod
    def _scan_monitor_bytes(cls, data_root: str) -> Dict[str, int]:
        """
        Schätzt laufenden Download-Fortschritt.

        finalBytes:
            Normale Dateien im Datenordner, ohne HF-Cache.

        cacheBytes:
            Große Cache-/Partial-Dateien unter .cache / .huggingface / .locks.
            Diese sind während snapshot_download() oft der einzige sichtbare Fortschritt.

        totalBytes:
            finalBytes + cacheBytes.
            Wird später gegen expectedBytes gekappt.
        """
        final_bytes = 0
        cache_bytes = 0

        if not data_root or not os.path.exists(data_root):
            return {
                "finalBytes": 0,
                "cacheBytes": 0,
                "totalBytes": 0
            }

        cache_markers = (
            f"{os.sep}.cache{os.sep}",
            f"{os.sep}.huggingface{os.sep}",
            f"{os.sep}.locks{os.sep}",
        )

        cache_names = {".cache", ".huggingface", ".locks"}
        partial_suffixes = (
            ".incomplete",
            ".partial",
            ".tmp",
            ".lock",
        )

        for dirpath, dirnames, filenames in os.walk(data_root):
            normalized_dir = dirpath.replace("\\", os.sep)

            is_cache_dir = (
                any(marker in normalized_dir for marker in cache_markers)
                or os.path.basename(normalized_dir) in cache_names
            )

            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                size = cls._file_size_safe(file_path)

                if size <= 0:
                    continue

                lower_name = filename.lower()
                lower_path = file_path.lower().replace("\\", "/")

                looks_partial = lower_name.endswith(partial_suffixes)
                looks_hf_blob = (
                    "/blobs/" in lower_path
                    or "/download" in lower_path
                    or "/snapshots/" in lower_path
                )

                if is_cache_dir or looks_partial or looks_hf_blob:
                    # Kleine Metadata-/Lock-Dateien verfälschen nur.
                    if size >= 1024 * 1024:
                        cache_bytes += size
                else:
                    final_bytes += size

        return {
            "finalBytes": int(final_bytes),
            "cacheBytes": int(cache_bytes),
            "totalBytes": int(final_bytes + cache_bytes)
        }

    @classmethod
    def _update_monitor_status(
        cls,
        plugin_root: str,
        action: str,
        message: Optional[str] = None
    ):
        manifest = cls._read_plugin_manifest(plugin_root)
        if not manifest:
            return

        manifest = cls._validate_plugin_manifest(manifest, plugin_root)
        status = manifest.setdefault("status", {})

        phase = status.get("phase")
        if phase in ("done", "error", "skipped", "idle"):
            return

        if phase not in ("prepare", "copy", "install", "repair"):
            return

        data_root = cls._resolve_data_path_from_manifest(plugin_root, manifest)
        sizes = cls._scan_monitor_bytes(data_root)

        expected_bytes = int(status.get("expectedBytes") or 0)
        previous_present = int(status.get("presentBytes") or 0)

        monitor_bytes = int(sizes.get("totalBytes") or 0)

        if expected_bytes > 0:
            monitor_bytes = min(monitor_bytes, expected_bytes)

        present_bytes = max(previous_present, monitor_bytes)

        remaining_bytes = 0
        if expected_bytes > 0:
            remaining_bytes = max(0, expected_bytes - int(present_bytes))

        status["remainingBytes"] = int(remaining_bytes)

        now = cls._now_ms()
        previous_sample_at = int(status.get("speedSampleAt") or 0)
        previous_sample_bytes = int(status.get("speedSampleBytes") or 0)

        downloaded_at_start = int(status.get("downloadedBytesAtStart") or 0)
        downloaded_this_run = max(0, int(present_bytes) - downloaded_at_start)

        remaining_bytes = 0
        if expected_bytes > 0:
            remaining_bytes = max(0, expected_bytes - int(present_bytes))

        current_speed_bps = 0
        smoothed_speed_bps = int(status.get("speedBytesPerSecond") or 0)

        if previous_sample_at > 0 and now > previous_sample_at:
            delta_bytes = max(0, int(present_bytes) - previous_sample_bytes)
            delta_seconds = max(0.001, (now - previous_sample_at) / 1000)

            # Exakte Dateisystem-Live-Geschwindigkeit.
            # Wenn keine neuen Bytes sichtbar sind, ist Datei-Live wirklich 0.
            current_speed_bps = int(delta_bytes / delta_seconds)

            # Ø-Timer erst starten, wenn wirklich Fortschritt sichtbar ist.
            if delta_bytes > 0 and not status.get("downloadStartedAt"):
                status["downloadStartedAt"] = previous_sample_at

            # Geglätteter Wert: nur aktualisieren, wenn Fortschritt sichtbar ist.
            # Nicht künstlich herunterzählen, sonst sieht es wie falscher Live-Speed aus.
            if current_speed_bps > 0:
                if smoothed_speed_bps > 0:
                    smoothed_speed_bps = int((smoothed_speed_bps * 0.6) + (current_speed_bps * 0.4))
                else:
                    smoothed_speed_bps = current_speed_bps

        download_started_at = int(status.get("downloadStartedAt") or 0)
        elapsed_seconds = 0
        average_speed_bps = 0

        if download_started_at > 0 and now > download_started_at:
            elapsed_seconds = int((now - download_started_at) / 1000)

            if elapsed_seconds > 0 and downloaded_this_run > 0:
                average_speed_bps = int(downloaded_this_run / elapsed_seconds)

        eta_seconds = None

        # ETA bewusst mit Ø-Speed berechnen.
        # ETA = verbleibende Bytes / durchschnittliche Bytes pro Sekunde
        if remaining_bytes > 0 and average_speed_bps > 0:
            eta_seconds = int(remaining_bytes / average_speed_bps)

        status["speedSampleAt"] = now
        status["speedSampleBytes"] = int(present_bytes)

        status["downloadedBytesThisRun"] = int(downloaded_this_run)
        status["remainingBytes"] = int(remaining_bytes)
        status["downloadElapsedSeconds"] = int(elapsed_seconds)

        # Exakt letztes Intervall
        status["currentDownloadBytesPerSecond"] = int(current_speed_bps)

        # Echte Durchschnittsgeschwindigkeit seit erstem sichtbaren Byte-Fortschritt
        status["averageDownloadBytesPerSecond"] = int(average_speed_bps)

        # Legacy/geglättet
        status["speedBytesPerSecond"] = int(smoothed_speed_bps)

        # Dauer in Sekunden, kein Timestamp
        status["etaSeconds"] = eta_seconds

        progress = int(status.get("progress") or 0)

        if expected_bytes > 0 and present_bytes > 0:
            progress = int(min(99, max(progress, (present_bytes / expected_bytes) * 100)))

        status["xhr"] = True
        status["running"] = True
        status["action"] = action
        status["heartbeatAt"] = cls._now_ms()
        status["presentBytes"] = int(present_bytes)
        status["monitorBytes"] = int(monitor_bytes)
        current_file = status.get("currentFile")
        current_file_expected = int(status.get("currentFileExpectedBytes") or 0)
        current_file_start_present = int(status.get("currentFileStartPresentBytes") or 0)

        if current_file and current_file_expected > 0:
            current_file_present = max(0, int(present_bytes) - current_file_start_present)
            current_file_present = min(current_file_present, current_file_expected)

            status["currentFilePresentBytes"] = int(current_file_present)
            status["currentFileRemainingBytes"] = int(
                max(0, current_file_expected - current_file_present)
            )
        status["finalPresentBytes"] = max(
            int(status.get("finalPresentBytes") or 0),
            int(sizes.get("finalBytes") or 0)
        )
        status["partialCacheBytes"] = max(
            int(status.get("partialCacheBytes") or 0),
            int(sizes.get("cacheBytes") or 0)
        )
        status["progress"] = max(1, min(99, progress))

        if message:
            status["message"] = message
        elif expected_bytes > 0:
            status["message"] = "Download läuft. Fortschritt wird überwacht."
        else:
            status["message"] = "Plugin-Aktion läuft. Warte auf Download-Metadaten."

        cls._update_network_speed_status(status)
        manifest["updatedAt"] = cls._now_ms()
        cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)

    @classmethod
    def _start_download_monitor(
        cls,
        plugin_id: str,
        plugin_root: str,
        action: str,
        stop_event: threading.Event,
        interval: float = 2.0
    ) -> threading.Thread:
        plugin_id = cls._safe_id(plugin_id)

        def monitor_runner():
            while not stop_event.is_set():
                try:
                    cls._update_monitor_status(
                        plugin_root=plugin_root,
                        action=action,
                        message=None
                    )
                except Exception:
                    pass

                stop_event.wait(interval)

            # Ein letzter Scan, damit das Frontend nach Ende keinen veralteten Wert behält.
            try:
                cls._update_monitor_status(
                    plugin_root=plugin_root,
                    action=action,
                    message="Downloadstatus wird finalisiert."
                )
            except Exception:
                pass

        thread = threading.Thread(
            target=monitor_runner,
            name=f"plugin-{plugin_id}-{action}-monitor",
            daemon=True
        )
        thread.start()
        return thread

    # -------------------------------------------------------------------------
    # Plugin Execution
    # -------------------------------------------------------------------------

    @classmethod
    def _load_plugin_module(cls, plugin_root: str, manifest: Dict[str, Any]):
        entry = manifest.get("entry", "main.py")
        entry_path = os.path.join(plugin_root, entry)

        if not os.path.exists(entry_path):
            raise FileNotFoundError(f"Plugin entry fehlt: {entry_path}")

        module_name = f"plugin_{cls._safe_id(manifest['pluginId'])}_{cls._now_ms()}"

        spec = importlib.util.spec_from_file_location(module_name, entry_path)

        if spec is None or spec.loader is None:
            raise ImportError(f"Plugin konnte nicht geladen werden: {entry_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        return module

    @classmethod
    def _evaluate_save(
        cls,
        plugin_root: str,
        manifest: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        api = manifest.get("api", {})
        save_name = api.get("save", "save")
        plugin_id = manifest.get("pluginId") or os.path.basename(plugin_root)
        action = manifest.get("status", {}).get("action") or "install"

        module = cls._load_plugin_module(plugin_root, manifest)
        save_fn = getattr(module, save_name, None)

        if not callable(save_fn):
            raise AttributeError(f"Plugin API '{save_name}' fehlt oder ist nicht callable.")

        cls._log(f"Installiere Plugin via save(): {manifest['pluginId']}", "INFO", "💾")

        stop_event = threading.Event()
        monitor_thread = cls._start_download_monitor(
            plugin_id=plugin_id,
            plugin_root=plugin_root,
            action=action,
            stop_event=stop_event,
            interval=2.0
        )

        try:
            result = save_fn(manifest, context)
        finally:
            stop_event.set()
            try:
                monitor_thread.join(timeout=4.0)
            except Exception:
                pass

        if isinstance(result, dict):
            manifest = result

        status = manifest.setdefault("status", {})

        if status.get("phase") == "paused" or status.get("paused") is True:
            status["xhr"] = False
            status["running"] = False
            status["paused"] = True
            status["pauseRequested"] = True
            status["installed"] = False
            status["saved"] = False
            status["error"] = None
            manifest["updatedAt"] = cls._now_ms()
            cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)
            return manifest

        manifest.setdefault("status", {})
        manifest["status"]["installed"] = True
        manifest["status"]["saved"] = True
        manifest["status"]["skipped"] = False
        manifest["status"]["error"] = None
        manifest["updatedAt"] = cls._now_ms()

        return manifest

    # -------------------------------------------------------------------------
    # Files / Assets
    # -------------------------------------------------------------------------

    @classmethod
    def _extract_zip_to_temp(cls, zip_path: str, temp_root: str) -> str:
        plugin_name = cls._safe_id(Path(zip_path).stem)
        extract_dir = os.path.join(temp_root, plugin_name)

        if os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)

        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(extract_dir)

        children = [
            os.path.join(extract_dir, child)
            for child in os.listdir(extract_dir)
        ]

        dirs = [child for child in children if os.path.isdir(child)]

        if len(dirs) == 1 and os.path.exists(os.path.join(dirs[0], PLUGIN_MANIFEST_NAME)):
            return dirs[0]

        return extract_dir

    @classmethod
    def _copy_plugin_folder(cls, src_root: str, dest_root: str, preserve_data: bool = True):
        os.makedirs(dest_root, exist_ok=True)

        preserve_names = {
            "data",
            ".cache",
            ".huggingface",
            ".locks",
            "__pycache__"
        } if preserve_data else set()

        for entry in os.listdir(src_root):
            if preserve_data and entry in preserve_names:
                continue

            src_path = os.path.join(src_root, entry)
            dest_path = os.path.join(dest_root, entry)

            if os.path.isdir(src_path):
                if os.path.exists(dest_path):
                    shutil.rmtree(dest_path)
                shutil.copytree(src_path, dest_path)
            else:
                shutil.copy2(src_path, dest_path)

    @classmethod
    def _discover_asset_zips(cls) -> List[str]:
        paths = cls._paths()
        asset_dir = paths["assetDir"]

        if not os.path.exists(asset_dir):
            return []

        result = []

        for entry in os.listdir(asset_dir):
            path = os.path.join(asset_dir, entry)

            if os.path.isfile(path) and entry.lower().endswith(".zip"):
                result.append(path)

        return sorted(result)

    @classmethod
    def _discover_asset_folders(cls) -> List[str]:
        paths = cls._paths()
        asset_dir = paths["assetDir"]

        if not os.path.exists(asset_dir):
            return []

        result = []

        for entry in os.listdir(asset_dir):
            path = os.path.join(asset_dir, entry)

            if os.path.isdir(path) and os.path.exists(os.path.join(path, PLUGIN_MANIFEST_NAME)):
                result.append(path)

        return sorted(result)

    @classmethod
    def _find_asset_source_for_plugin(cls, plugin_id: str) -> Optional[str]:
        plugin_id = cls._safe_id(plugin_id)
        paths = cls._paths()
        asset_dir = paths["assetDir"]

        direct_folder = os.path.join(asset_dir, plugin_id)
        if os.path.isdir(direct_folder):
            manifest = cls._read_plugin_manifest(direct_folder)
            if manifest:
                manifest = cls._validate_plugin_manifest(manifest, direct_folder, source="asset_folder")
                if manifest.get("pluginId") == plugin_id:
                    return direct_folder

        direct_zip = os.path.join(asset_dir, f"{plugin_id}.zip")
        if os.path.isfile(direct_zip) and zipfile.is_zipfile(direct_zip):
            return direct_zip

        for folder_path in cls._discover_asset_folders():
            manifest = cls._read_plugin_manifest(folder_path)
            if not manifest:
                continue

            manifest = cls._validate_plugin_manifest(manifest, folder_path, source="asset_folder")
            if manifest.get("pluginId") == plugin_id:
                return folder_path

        temp_root = os.path.join(paths["activeWorkDir"], ".repair_scan_tmp")

        if os.path.exists(temp_root):
            shutil.rmtree(temp_root)

        os.makedirs(temp_root, exist_ok=True)

        try:
            for zip_path in cls._discover_asset_zips():
                src_root = cls._extract_zip_to_temp(zip_path, temp_root)
                manifest = cls._read_plugin_manifest(src_root)

                if not manifest:
                    continue

                manifest = cls._validate_plugin_manifest(manifest, src_root, source="asset_zip")
                if manifest.get("pluginId") == plugin_id:
                    return zip_path

        finally:
            shutil.rmtree(temp_root, ignore_errors=True)

        return None

    # -------------------------------------------------------------------------
    # Normalize / Scan
    # -------------------------------------------------------------------------

    @classmethod
    def _normalize_plugin_item(
        cls,
        manifest: Dict[str, Any],
        plugin_root: str
    ) -> Dict[str, Any]:
        status = manifest.get("status", {})
        paths = manifest.get("paths", {})

        return {
            "pluginId": manifest.get("pluginId"),
            "id": manifest.get("id"),
            "name": manifest.get("name"),
            "type": manifest.get("type", "plugin"),
            "source": manifest.get("source"),
            "active": manifest.get("active", True),
            "install": manifest.get("install", False),
            "root": plugin_root,
            "manifest": cls._plugin_manifest_path(plugin_root),
            "status": status,
            "paths": paths,
            "data": manifest
        }

    @classmethod
    def _scan_data(cls) -> Dict[str, Any]:
        paths = cls._paths()

        standard_work_dir = paths["standardWorkDir"]
        active_work_dir = paths["activeWorkDir"]

        scan_dirs = [standard_work_dir]

        if cls._abs(active_work_dir) != cls._abs(standard_work_dir):
            scan_dirs.append(active_work_dir)

        found_by_id: Dict[str, Dict[str, Any]] = {}

        for work_dir in scan_dirs:
            if not os.path.exists(work_dir):
                continue

            for entry in os.listdir(work_dir):
                plugin_root = os.path.join(work_dir, entry)

                if not os.path.isdir(plugin_root):
                    continue

                manifest = cls._read_plugin_manifest(plugin_root)

                if not manifest:
                    continue

                manifest = cls._validate_plugin_manifest(
                    manifest,
                    plugin_root,
                    source=manifest.get("source", "installed")
                )

                plugin_id = manifest["pluginId"]
                manifest = cls._normalize_runtime_status(plugin_id, manifest)

                item = cls._normalize_plugin_item(manifest, plugin_root)
                found_by_id[plugin_id] = item

                cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)

        plugins = list(found_by_id.values())

        global_manifest = {
            "version": 1,
            "updatedAt": cls._now_ms(),
            "standardWorkDir": standard_work_dir,
            "activeWorkDir": active_work_dir,
            "plugins": [
                {
                    "pluginId": item["pluginId"],
                    "root": item["root"],
                    "manifest": item["manifest"],
                    "type": item["type"],
                    "source": item["source"],
                    "active": item["active"],
                    "install": item["install"],
                    "status": item["status"],
                    "paths": item["paths"]
                }
                for item in plugins
            ]
        }

        cls._json_save(cls._global_manifest_path(active_work_dir), global_manifest)

        if cls._abs(active_work_dir) != cls._abs(standard_work_dir):
            cls._json_save(cls._global_manifest_path(standard_work_dir), global_manifest)

        return {
            "manifest": cls._global_manifest_path(active_work_dir),
            "standardManifest": cls._global_manifest_path(standard_work_dir),
            "standardWorkDir": standard_work_dir,
            "activeWorkDir": active_work_dir,
            "plugins": plugins
        }

    # -------------------------------------------------------------------------
    # Internal Install
    # -------------------------------------------------------------------------

    @classmethod
    def _install_plugin_from_source(
        cls,
        src_root: str,
        target_work_dir: str,
        standard_work_dir: str,
        source: str,
        evaluate: bool = True,
        force_install: bool = False,
        action: str = "install"
    ) -> Dict[str, Any]:
        src_manifest = cls._read_plugin_manifest(src_root)

        if not src_manifest:
            raise ValueError(f"Plugin manifest fehlt: {src_root}")

        src_manifest = cls._validate_plugin_manifest(src_manifest, src_root, source=source)

        plugin_id = src_manifest["pluginId"]

        active_plugin_root = cls._plugin_root(target_work_dir, plugin_id)
        standard_plugin_root = cls._plugin_root(standard_work_dir, plugin_id)

        cls._clear_pause_marker(active_plugin_root)

        cls._copy_plugin_folder(src_root, standard_plugin_root, preserve_data=True)

        if cls._abs(target_work_dir) != cls._abs(standard_work_dir):
            cls._copy_plugin_folder(src_root, active_plugin_root, preserve_data=True)
        else:
            active_plugin_root = standard_plugin_root

        manifest = cls._read_plugin_manifest(active_plugin_root) or src_manifest
        manifest = cls._validate_plugin_manifest(manifest, active_plugin_root, source=source)

        manifest = cls._reset_tracking(
            manifest,
            active_plugin_root,
            action=action,
            message=f"{action} vorbereitet: {plugin_id}"
        )

        manifest.setdefault("paths", {})
        manifest["paths"]["root"] = active_plugin_root
        manifest["paths"]["standardRoot"] = standard_plugin_root
        manifest["paths"]["activeRoot"] = active_plugin_root
        manifest["paths"]["assetSource"] = src_root

        manifest.setdefault("fallback", {})
        manifest["fallback"]["standardRoot"] = standard_plugin_root

        manifest = cls._set_tracking(
            manifest,
            active_plugin_root,
            action=action,
            phase="copy",
            progress=20,
            message="Plugin-Dateien wurden vorbereitet."
        )

        context = {
            "pluginId": plugin_id,
            "pluginRoot": active_plugin_root,
            "standardPluginRoot": standard_plugin_root,
            "assetSource": src_root,
            "activeWorkDir": target_work_dir,
            "standardWorkDir": standard_work_dir,
            "manifestPath": cls._plugin_manifest_path(active_plugin_root),
            "pausePath": cls._pause_marker_path(active_plugin_root),
            "hfToken": cls._resolve_hf_token()
        }

        should_install = cls._should_install(manifest) or force_install

        if evaluate and should_install:
            try:
                manifest = cls._set_tracking(
                    manifest,
                    active_plugin_root,
                    action=action,
                    phase="install" if action == "install" else "repair",
                    progress=45,
                    message="Plugin-Installation läuft."
                )

                manifest = cls._evaluate_save(
                    active_plugin_root,
                    manifest,
                    context
                )

                if manifest.get("status", {}).get("phase") == "paused":
                    manifest = cls._validate_plugin_manifest(manifest, active_plugin_root, source=source)
                    cls._json_save(cls._plugin_manifest_path(active_plugin_root), manifest)
                    return cls._normalize_plugin_item(manifest, active_plugin_root)

                manifest["install"] = True

                manifest = cls._set_tracking(
                    manifest,
                    active_plugin_root,
                    action=action,
                    phase="done",
                    progress=100,
                    message=f"{action} abgeschlossen."
                )

            except Exception as e:
                manifest.setdefault("status", {})
                manifest["status"]["installed"] = False
                manifest["status"]["saved"] = False
                manifest["status"]["skipped"] = False
                manifest["status"]["error"] = str(e)
                manifest["updatedAt"] = cls._now_ms()

                cls._set_tracking(
                    manifest,
                    active_plugin_root,
                    action=action,
                    phase="error",
                    progress=100,
                    message=f"{action} fehlgeschlagen.",
                    error=str(e)
                )

                cls._json_save(cls._plugin_manifest_path(active_plugin_root), manifest)
                raise

        elif not should_install:
            manifest.setdefault("status", {})
            manifest["status"]["installed"] = True
            manifest["status"]["saved"] = False
            manifest["status"]["skipped"] = True
            manifest["status"]["error"] = None
            manifest["status"]["path"] = manifest["status"].get("path")
            manifest["status"]["skipReason"] = "install:false"
            manifest["updatedAt"] = cls._now_ms()

            manifest = cls._set_tracking(
                manifest,
                active_plugin_root,
                action=action,
                phase="skipped",
                progress=100,
                message="Installation übersprungen: install:false"
            )

            cls._log(
                f"Plugin vorbereitet, Installation übersprungen: {manifest['pluginId']}",
                "INFO",
                "⏭️"
            )

        manifest = cls._validate_plugin_manifest(manifest, active_plugin_root, source=source)
        cls._json_save(cls._plugin_manifest_path(active_plugin_root), manifest)

        cls._log(f"Plugin bereit: {plugin_id}", "INFO", "✅")

        return cls._normalize_plugin_item(manifest, active_plugin_root)

    @classmethod
    def _run_install_job(cls, plugin_id: str):
        paths = cls._paths()

        plugin_id = cls._safe_id(plugin_id)
        plugin_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)
        manifest = cls._read_plugin_manifest(plugin_root)

        if not manifest:
            raise FileNotFoundError(f"Plugin nicht gefunden: {plugin_id}")

        manifest = cls._validate_plugin_manifest(manifest, plugin_root)

        context = {
            "pluginId": plugin_id,
            "pluginRoot": plugin_root,
            "standardPluginRoot": cls._plugin_root(paths["standardWorkDir"], plugin_id),
            "assetSource": manifest.get("paths", {}).get("assetSource"),
            "activeWorkDir": paths["activeWorkDir"],
            "standardWorkDir": paths["standardWorkDir"],
            "manifestPath": cls._plugin_manifest_path(plugin_root),
            "pausePath": cls._pause_marker_path(plugin_root),
            "hfToken": cls._resolve_hf_token()
        }

        manifest = cls._reset_tracking(
            manifest,
            plugin_root,
            action="install",
            message=f"Installation gestartet: {plugin_id}"
        )

        try:
            manifest = cls._set_tracking(
                manifest,
                plugin_root,
                action="install",
                phase="install",
                progress=35,
                message="Plugin wird installiert."
            )

            manifest = cls._evaluate_save(plugin_root, manifest, context)

            if manifest.get("status", {}).get("phase") == "paused":
                manifest = cls._validate_plugin_manifest(manifest, plugin_root)
                cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)
                cls._scan_data()
                return

            manifest["install"] = True
            manifest = cls._validate_plugin_manifest(manifest, plugin_root)

            manifest = cls._set_tracking(
                manifest,
                plugin_root,
                action="install",
                phase="done",
                progress=100,
                message=f"Installation abgeschlossen: {plugin_id}"
            )

        except Exception as e:
            manifest.setdefault("status", {})
            manifest["status"]["installed"] = False
            manifest["status"]["saved"] = False
            manifest["status"]["skipped"] = False
            manifest["status"]["error"] = str(e)

            cls._set_tracking(
                manifest,
                plugin_root,
                action="install",
                phase="error",
                progress=100,
                message=f"Installation fehlgeschlagen: {plugin_id}",
                error=str(e)
            )
            raise

        cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)
        cls._scan_data()

    @classmethod
    def _run_repair_job(cls, plugin_id: str):
        paths = cls._paths()
        plugin_id = cls._safe_id(plugin_id)

        source_path = cls._find_asset_source_for_plugin(plugin_id)

        if not source_path:
            raise FileNotFoundError(f"Keine Asset-Quelle für Plugin '{plugin_id}' gefunden.")

        temp_root = os.path.join(paths["activeWorkDir"], ".repair_tmp")

        if os.path.exists(temp_root):
            shutil.rmtree(temp_root)

        os.makedirs(temp_root, exist_ok=True)

        try:
            if os.path.isdir(source_path):
                src_root = source_path
                source = "asset_folder"
            elif os.path.isfile(source_path) and zipfile.is_zipfile(source_path):
                src_root = cls._extract_zip_to_temp(source_path, temp_root)
                source = "asset_zip"
            else:
                raise ValueError("Asset-Quelle muss ZIP oder Plugin-Ordner sein.")

            cls._install_plugin_from_source(
                src_root=src_root,
                target_work_dir=paths["activeWorkDir"],
                standard_work_dir=paths["standardWorkDir"],
                source=source,
                evaluate=True,
                force_install=True,
                action="repair"
            )

            cls._scan_data()

        finally:
            shutil.rmtree(temp_root, ignore_errors=True)

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    @classmethod
    def fetch(cls):
        try:
            scan_data = cls._scan_data()
            return scan_data.get("plugins", []), 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def scan(cls):
        try:
            return cls._scan_data(), 200
        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def install_all(cls):
        try:
            paths = cls._paths()

            installed = []
            temp_root = os.path.join(paths["activeWorkDir"], ".install_tmp")

            if os.path.exists(temp_root):
                shutil.rmtree(temp_root)

            os.makedirs(temp_root, exist_ok=True)

            try:
                for zip_path in cls._discover_asset_zips():
                    cls._log(f"Entpacke Pre-Plugin ZIP: {zip_path}", "INFO", "📦")
                    src_root = cls._extract_zip_to_temp(zip_path, temp_root)

                    installed.append(
                        cls._install_plugin_from_source(
                            src_root=src_root,
                            target_work_dir=paths["activeWorkDir"],
                            standard_work_dir=paths["standardWorkDir"],
                            source="asset_zip",
                            evaluate=True,
                            force_install=False,
                            action="install"
                        )
                    )

                for folder_path in cls._discover_asset_folders():
                    cls._log(f"Kopiere Pre-Plugin Ordner: {folder_path}", "INFO", "📁")

                    installed.append(
                        cls._install_plugin_from_source(
                            src_root=folder_path,
                            target_work_dir=paths["activeWorkDir"],
                            standard_work_dir=paths["standardWorkDir"],
                            source="asset_folder",
                            evaluate=True,
                            force_install=False,
                            action="install"
                        )
                    )

            finally:
                shutil.rmtree(temp_root, ignore_errors=True)

            scan_data = cls._scan_data()

            return {
                "message": "Plugins installiert/vorbereitet.",
                "installed": installed,
                "plugins": scan_data.get("plugins", []),
                "scan": scan_data
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def install(cls, pluginId: str):
        try:
            paths = cls._paths()
            plugin_id = cls._safe_id(pluginId)

            if not plugin_id:
                return {"error": "pluginId fehlt"}, 400

            plugin_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)
            manifest = cls._read_plugin_manifest(plugin_root)

            if not manifest:
                return {"error": f"Plugin nicht gefunden: {plugin_id}"}, 404

            manifest = cls._validate_plugin_manifest(manifest, plugin_root)

            if cls._is_any_job_running(plugin_id):
                scan_data = cls._scan_data()
                return {
                    "message": f"Plugin-Aktion läuft bereits: {plugin_id}",
                    "plugin": cls._normalize_plugin_item(manifest, plugin_root),
                    "plugins": scan_data.get("plugins", []),
                    "scan": scan_data
                }, 202

            cls._clear_pause_marker(plugin_root)

            manifest = cls._reset_tracking(
                manifest,
                plugin_root,
                action="install",
                message=f"Installation wird vorbereitet: {plugin_id}"
            )

            cls._start_background_job(
                plugin_id,
                "install",
                cls._run_install_job,
                plugin_id
            )

            scan_data = cls._scan_data()

            return {
                "message": f"Installation gestartet: {plugin_id}",
                "plugin": cls._normalize_plugin_item(manifest, plugin_root),
                "plugins": scan_data.get("plugins", []),
                "scan": scan_data
            }, 202

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def repair(cls, pluginId: str):
        try:
            paths = cls._paths()
            plugin_id = cls._safe_id(pluginId)

            if not plugin_id:
                return {"error": "pluginId fehlt"}, 400

            plugin_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)
            manifest = cls._read_plugin_manifest(plugin_root)

            if not manifest:
                return {"error": f"Plugin nicht gefunden: {plugin_id}"}, 404

            manifest = cls._validate_plugin_manifest(manifest, plugin_root)

            if cls._is_any_job_running(plugin_id):
                scan_data = cls._scan_data()
                return {
                    "message": f"Plugin-Aktion läuft bereits: {plugin_id}",
                    "plugin": cls._normalize_plugin_item(manifest, plugin_root),
                    "plugins": scan_data.get("plugins", []),
                    "scan": scan_data
                }, 202

            cls._clear_pause_marker(plugin_root)

            manifest = cls._reset_tracking(
                manifest,
                plugin_root,
                action="repair",
                message=f"Reparatur wird vorbereitet: {plugin_id}"
            )

            cls._start_background_job(
                plugin_id,
                "repair",
                cls._run_repair_job,
                plugin_id
            )

            scan_data = cls._scan_data()

            return {
                "message": f"Reparatur gestartet: {plugin_id}",
                "plugin": cls._normalize_plugin_item(manifest, plugin_root),
                "plugins": scan_data.get("plugins", []),
                "scan": scan_data
            }, 202

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def uninstall(cls, pluginId: str):
        try:
            paths = cls._paths()
            plugin_id = cls._safe_id(pluginId)

            active_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)
            standard_root = cls._plugin_root(paths["standardWorkDir"], plugin_id)

            removed = []

            if os.path.exists(active_root):
                shutil.rmtree(active_root, ignore_errors=True)
                removed.append(active_root)

            if cls._abs(active_root) != cls._abs(standard_root) and os.path.exists(standard_root):
                shutil.rmtree(standard_root, ignore_errors=True)
                removed.append(standard_root)

            with PLUGIN_JOBS_LOCK:
                for action in ("install", "repair"):
                    PLUGIN_JOBS.pop(cls._job_key(plugin_id, action), None)

            scan_data = cls._scan_data()

            return {
                "message": f"Plugin deinstalliert: {plugin_id}",
                "removed": removed,
                "plugins": scan_data.get("plugins", []),
                "scan": scan_data
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def pause(cls, pluginId: str):
        """
        Fordert Pause für install/repair an.

        Wichtig:
        - Der aktuelle HF-Dateidownload kann nicht immer sofort hart abgebrochen werden.
        - Die Pause wird spätestens vor der nächsten Datei wirksam.
        - Fortsetzen läuft über install/repair erneut; vorhandene Daten bleiben erhalten.
        """
        try:
            paths = cls._paths()
            plugin_id = cls._safe_id(pluginId)

            if not plugin_id:
                return {"error": "pluginId fehlt"}, 400

            plugin_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)
            manifest = cls._read_plugin_manifest(plugin_root)

            if not manifest:
                return {"error": f"Plugin nicht gefunden: {plugin_id}"}, 404

            cls._write_pause_marker(plugin_root)

            manifest = cls._validate_plugin_manifest(manifest, plugin_root)
            status = manifest.setdefault("status", {})

            status["pauseRequested"] = True
            status["message"] = "Pause angefordert. Der aktuelle Dateidownload wird noch abgeschlossen."
            status["heartbeatAt"] = cls._now_ms()

            # Noch nicht direkt phase=paused setzen, solange der Job wirklich läuft.
            # main.py setzt phase=paused, sobald der laufende Download kooperativ stoppt.
            if not cls._is_any_job_running(plugin_id):
                status["xhr"] = False
                status["running"] = False
                status["paused"] = True
                status["phase"] = "paused"
                status["finishedAt"] = cls._now_ms()

            manifest["updatedAt"] = cls._now_ms()
            cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)

            scan_data = cls._scan_data()

            return {
                "message": f"Pause angefordert: {plugin_id}",
                "plugin": cls._normalize_plugin_item(manifest, plugin_root),
                "plugins": scan_data.get("plugins", []),
                "scan": scan_data
            }, 202

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def toggle(cls, pluginId: str):
        try:
            paths = cls._paths()
            plugin_id = cls._safe_id(pluginId)

            plugin_root = cls._plugin_root(paths["activeWorkDir"], plugin_id)
            standard_root = cls._plugin_root(paths["standardWorkDir"], plugin_id)

            manifest = cls._read_plugin_manifest(plugin_root)

            if not manifest and os.path.exists(standard_root):
                plugin_root = standard_root
                manifest = cls._read_plugin_manifest(plugin_root)

            if not manifest:
                return {"error": f"Plugin nicht gefunden: {plugin_id}"}, 404

            manifest = cls._validate_plugin_manifest(manifest, plugin_root)
            manifest["active"] = not bool(manifest.get("active", True))
            manifest["updatedAt"] = cls._now_ms()

            cls._json_save(cls._plugin_manifest_path(plugin_root), manifest)

            if cls._abs(plugin_root) != cls._abs(standard_root) and os.path.exists(standard_root):
                standard_manifest = cls._read_plugin_manifest(standard_root)
                if standard_manifest:
                    standard_manifest = cls._validate_plugin_manifest(standard_manifest, standard_root)
                    standard_manifest["active"] = manifest["active"]
                    standard_manifest["updatedAt"] = cls._now_ms()
                    cls._json_save(cls._plugin_manifest_path(standard_root), standard_manifest)

            scan_data = cls._scan_data()

            return {
                "message": f"Plugin {'aktiviert' if manifest['active'] else 'deaktiviert'}: {plugin_id}",
                "plugin": cls._normalize_plugin_item(manifest, plugin_root),
                "plugins": scan_data.get("plugins", []),
                "scan": scan_data
            }, 200

        except Exception as e:
            return cls.handle_error(e)

    @classmethod
    def upload(cls):
        try:
            files = request.files

            if "file" not in files:
                return {"error": "No file part"}, 400

            f = files["file"]
            filename = secure_filename(f.filename)

            if not filename:
                return {"error": "No selected file"}, 400

            paths = cls._paths()
            upload_tmp = os.path.join(paths["activeWorkDir"], ".upload_tmp")

            if os.path.exists(upload_tmp):
                shutil.rmtree(upload_tmp)

            os.makedirs(upload_tmp, exist_ok=True)

            upload_path = os.path.join(upload_tmp, filename)
            f.save(upload_path)

            try:
                if zipfile.is_zipfile(upload_path):
                    src_root = cls._extract_zip_to_temp(upload_path, upload_tmp)
                else:
                    return {"error": "Upload muss eine Plugin-ZIP sein"}, 400

                result = cls._install_plugin_from_source(
                    src_root=src_root,
                    target_work_dir=paths["activeWorkDir"],
                    standard_work_dir=paths["standardWorkDir"],
                    source="upload",
                    evaluate=True,
                    force_install=False,
                    action="install"
                )

                scan_data = cls._scan_data()

                return {
                    "message": "Plugin hochgeladen.",
                    "plugin": result,
                    "plugins": scan_data.get("plugins", []),
                    "scan": scan_data
                }, 201

            finally:
                shutil.rmtree(upload_tmp, ignore_errors=True)

        except Exception as e:
            return cls.handle_error(e)