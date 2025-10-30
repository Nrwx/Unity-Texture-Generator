import os
import time
import shutil
import zipfile
import tarfile
import subprocess
import importlib.util
import ctypes
import ctypes.wintypes
from generated.paths import __DRIVER_FOLDER
import psutil
from typing import Callable, Optional
DRIVER_META = {
    "total": 0,
    "installed": 0,
    "not_installed": 0
}

def detect_platform_driver_folder(os_type, os_arch):
    if os_type == "windows":
        from generated.paths import ASSETS_DRIVER_WINDOWS_FOLDER
        return ASSETS_DRIVER_WINDOWS_FOLDER
    elif os_type == "linux":
        from generated.paths import ASSETS_DRIVER_LINUX_FOLDER
        return ASSETS_DRIVER_LINUX_FOLDER
    else:
        raise RuntimeError(f"❌ Unsupported system: {os_type} ({os_arch})")


def run_installer_as_admin(exe_path, params="/S"):
    SEE_MASK_NOCLOSEPROCESS = 0x00000040

    class SHELLEXECUTEINFO(ctypes.Structure):
        _fields_ = [
            ("cbSize", ctypes.wintypes.DWORD),
            ("fMask", ctypes.wintypes.ULONG),
            ("hwnd", ctypes.wintypes.HWND),
            ("lpVerb", ctypes.wintypes.LPCWSTR),
            ("lpFile", ctypes.wintypes.LPCWSTR),
            ("lpParameters", ctypes.wintypes.LPCWSTR),
            ("lpDirectory", ctypes.wintypes.LPCWSTR),
            ("nShow", ctypes.c_int),
            ("hInstApp", ctypes.wintypes.HINSTANCE),
            ("lpIDList", ctypes.c_void_p),
            ("lpClass", ctypes.wintypes.LPCWSTR),
            ("hkeyClass", ctypes.wintypes.HKEY),
            ("dwHotKey", ctypes.wintypes.DWORD),
            ("hIcon", ctypes.wintypes.HANDLE),
            ("hProcess", ctypes.wintypes.HANDLE),
        ]

    sei = SHELLEXECUTEINFO()
    sei.cbSize = ctypes.sizeof(sei)
    sei.fMask = SEE_MASK_NOCLOSEPROCESS
    sei.hwnd = None
    sei.lpVerb = "runas"
    sei.lpFile = exe_path
    sei.lpParameters = params
    sei.lpDirectory = None
    sei.nShow = 1
    sei.hInstApp = None

    if not ctypes.windll.shell32.ShellExecuteExW(ctypes.byref(sei)):
        raise ctypes.WinError()

    ctypes.windll.kernel32.WaitForSingleObject(sei.hProcess, -1)
    ctypes.windll.kernel32.CloseHandle(sei.hProcess)

def wait_for_watch_processes(watch_list, log):
    """
    Beobachtet die in watch_list angegebenen Pfade.
    Blockiert, bis kein Prozess mehr läuft.
    """
    # Normiere die Watchliste
    normalized_watch = [os.path.normcase(os.path.abspath(p)) for p in watch_list]

    log(f"Beobachte Prozesse: {normalized_watch}", "DRIVER", "OBSERVE", "️⚙️")

    while True:
        running = []
        for proc in psutil.process_iter(['pid', 'exe']):
            try:
                proc_path = proc.info['exe']
                if not proc_path:
                    continue
                proc_path_norm = os.path.normcase(os.path.abspath(proc_path))
                if proc_path_norm in normalized_watch or os.path.basename(proc_path_norm) in [os.path.basename(p) for p in normalized_watch]:
                    running.append(proc_path_norm)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        if not running:
            break

        log(f"folgende Prozesse laufen noch: {running}", "DRIVER", "OBSERVE", "⏱️")
        time.sleep(5)

    log("Alle überwachten Prozesse abgeschlossen.", "DRIVER", "INFO", "🔔️")


def execute_plan(plan, os_type, os_arch, log):
    env_vars_all = plan.get("env_vars") or {}
    env_vars = env_vars_all.get(os_type) or {}

    installers_all = plan.get("installers") or {}
    installers = installers_all.get(os_type) or []

    watch_list = plan.get("watch") or []

    check_func = plan.get("check")

    for key, values in (env_vars or {}).items():
        if values is not None:
            os.environ[key] = os.pathsep.join(values + [os.environ.get(key, "")])

    if callable(check_func) and check_func(log):
        log(f"Paket:'{plan.get('installer_name') or 'Plan'}' bereits installiert.", "DRIVER", "INFO", "🔒")
        DRIVER_META['installed'] = int(DRIVER_META['installed']+1)
        return
    else:
        DRIVER_META['not_installed'] = int(DRIVER_META['not_installed']+1)

    log(f"Paket: {plan.get('installer_name') or 'Plan'} nicht gefunden!", "DRIVER", "WARNING", "⚠️")

    driver_folder = detect_platform_driver_folder(os_type, os_arch)
    os.makedirs(__DRIVER_FOLDER, exist_ok=True)

    for installer_zip in installers:
        if not installer_zip:
            continue
        zip_path = os.path.join(driver_folder, installer_zip)
        if not os.path.exists(zip_path):
            log(f"Installer: '{zip_path}' nicht gefunden!", "DRIVER", "WARNING", "⚠️")
            continue

        log(f"Entpacke: '{installer_zip}'...", "DRIVER", "INFO", "📦")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(__DRIVER_FOLDER)

        for f in os.listdir(__DRIVER_FOLDER):
            abs_path = os.path.join(__DRIVER_FOLDER, f)
            if f.endswith(".exe") and os_type == "windows":
                log(f"Administrative-Rechte erforderlich für: '{abs_path}'!", "DRIVER", "INFO", "🛡️")
                try:
                    run_installer_as_admin(abs_path, "/S")
                except Exception as e:
                    log(f"Fehler beim Administrativen-Start von {abs_path}: {e}", "DRIVER", "ERROR", "❌️")
            elif f.endswith(".exe"):
                log(f"Administrative-Authentifizierung erfolgreich!", "SYSTEM", "INFO", "🔓")
                log(f"Installation '{abs_path}' wird ausgeführt...", "DRIVER", "INSTALL", "📀")
                try:
                    subprocess.run([abs_path, "/S"], check=True)
                except Exception as e:
                    log(f"Fehler beim installieren von {abs_path}: {e}", "DRIVER", "ERROR", "❌️")
            elif f.endswith(".tar.gz"):
                log(f"Entpacke: 'tar.gz: {abs_path}'...", "DRIVER", "INFO", "📦")
                try:
                    with tarfile.open(abs_path, "r:gz") as tar:
                        tar.extractall(__DRIVER_FOLDER)
                except Exception as e:
                    log(f"Fehler beim Entpacken von {abs_path}: {e}", "DRIVER", "ERROR", "❌️")

    # Watch-Logik für automatisch gestartete Setup.exe
    if os_type == "windows" and watch_list:
        watch_list_existing = [p for p in watch_list if os.path.exists(p)]
        if watch_list_existing:
            wait_for_watch_processes(watch_list_existing, log)

    # End-Check
    if callable(check_func):
        try:
            if check_func(log):
                log(f"Paket: {plan.get('installer_name') or 'Plan'} wurde erfolgreich installiert und geprüft.", "DRIVER", "INSTALL", "️🛡️")
            else:
                log(f"Paket: {plan.get('installer_name') or 'Plan'} fehlerhaft.", "DRIVER", "ERROR", "❌️")

        except Exception as e:
            log("Treiberüberprüfung fehlgeschlagen", "DRIVER", "ERROR", "❌️")


def load_package_plans(os_type, os_arch, log):
    plans = []
    pkg_dir = os.path.join(os.path.dirname(__file__), "packages")

    for filename in os.listdir(pkg_dir):
        if not filename.endswith(".py") or filename == "__init__.py":
            continue

        module_path = os.path.join(pkg_dir, filename)
        module_name = f"packages.{filename[:-3]}"

        spec = importlib.util.spec_from_file_location(module_name, module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        for attr_name in dir(module):
            if attr_name.startswith("plan_") and callable(getattr(module, attr_name)):
                plan_func = getattr(module, attr_name)
                try:
                    plans.append(plan_func())
                    log(f"Installations-Plan: '{attr_name}' aus '{filename}' wurde erfolgreich gelesen.", "DRIVER", "PLAN", "️🧩️")
                except Exception as e:
                    log(f"Fehler im Installations-Plan: {attr_name} in {filename}: {e}", "DRIVER", "ERROR", "❌️")

    return plans


def driver(os_type, os_arch, log):
    plans = load_package_plans(os_type, os_arch, log)

    config_set = {}

    for plan in plans:
        plan_id = plan.get("id", None)
        installer_name = plan.get("installer_name", "Unbekannt")
        check_func = plan.get("check")
        plan_return = plan.get("return", None)

        log(f"Bevorstehende Treiberinstallation für: '{installer_name}'.", "DRIVER", "INSTALL", "💿")

        # Führe Installation aus
        execute_plan(plan, os_type, os_arch, log)

        # Prüfe Status dynamisch über check_func
        if callable(check_func):
            try:
                status = bool(check_func(log))
            except Exception as e:
                log(f"Installations-Plan: {plan_id} ist fehlgeschlagen. {e}", "DRIVER", "PLAN", "❌️")
                status = False
        else:
            status = False

        if plan_id:
            config_set[plan_id] = {"value": status, "type": bool}

        if plan_return:
            config_set[plan_return["id"]] = {
                "value": plan_return["value"],
                "type": plan_return["type"]
            }

        DRIVER_META['total'] = int(DRIVER_META['total']+1)


    # Temporäre Treiber-Dateien entfernen
    if os.path.exists(__DRIVER_FOLDER):
        retries = [10, 15, 20]
        for i, wait in enumerate(retries):
            try:
                shutil.rmtree(__DRIVER_FOLDER)
                log("Temporäre Installations-Dateien erfolgreich entfernt.", "DRIVER", "CLEAN", "️🧹️")
                break
            except Exception as e:
                if i < len(retries) - 1:
                    log(f"Versuch {i+1}: Konnte temporäre Installations-Dateien nicht entfernen: {e}. Neuer Versuch in {wait} Sekunden...", "DRIVER", "WARNING", "⚠️️",)
                    time.sleep(wait)
                else:
                    log(f"❌ Alle Versuche fehlgeschlagen: {e}")
                    log(f"Alle Säuberungsversuche sind fehlgeschlagen. {e}", "DRIVER", "ERROR", "❌️")

    if DRIVER_META['not_installed'] == 0:
        log(f"Alle Treiber {DRIVER_META['installed']}/{DRIVER_META['total']} sind bereits installiert.", "DRIVER", "INSTALL", "️🛡️")
    elif DRIVER_META['installed'] == 0:
        log(f"Alle {DRIVER_META['not_installed']}/{DRIVER_META['total']} erfolgreich installiert.", "DRIVER", "INSTALL", "🛡️")
    elif DRIVER_META['not_installed'] != DRIVER_META['total'] and DRIVER_META['not_installed'] != 0 and DRIVER_META['installed'] != 0:
        log(f"Installiert: {DRIVER_META['not_installed']}, bereits installiert: {DRIVER_META['installed']}", "DRIVER", "INSTALL", "🛡️")
    else:
        log(f"Fehler: {DRIVER_META['not_installed']} von {DRIVER_META['total']} Treiber konnten nicht installiert werden.","DRIVER","INSTALL","⚠️")

    return config_set

def main(os_type: str, os_arch: str, log:Callable[[str, str, str, Optional[str]], None]):
    return driver(os_type, os_arch, log)
