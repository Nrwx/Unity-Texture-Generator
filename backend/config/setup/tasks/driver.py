import os
import time
import shutil
import zipfile
import tarfile
import logging
import subprocess
import importlib.util
import ctypes
import ctypes.wintypes
from generated.paths import __DRIVER_FOLDER
import psutil

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

OS_TYPE = None
OS_ARCH = None


def set_os(os_type, os_arch):
    global OS_TYPE, OS_ARCH
    OS_TYPE = os_type
    OS_ARCH = os_arch


def detect_platform_driver_folder():
    if OS_TYPE == "windows":
        from generated.paths import ASSETS_DRIVER_WINDOWS_FOLDER
        return ASSETS_DRIVER_WINDOWS_FOLDER
    elif OS_TYPE == "linux":
        from generated.paths import ASSETS_DRIVER_LINUX_FOLDER
        return ASSETS_DRIVER_LINUX_FOLDER
    else:
        raise RuntimeError(f"❌ Unsupported system: {OS_TYPE} ({OS_ARCH})")


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


import os
import time
import logging
import psutil

def wait_for_watch_processes(watch_list):
    """
    Beobachtet die in watch_list angegebenen Pfade.
    Blockiert, bis kein Prozess mehr läuft.
    """
    # Normiere die Watchliste
    normalized_watch = [os.path.normcase(os.path.abspath(p)) for p in watch_list]

    logging.info(f"👀 Beobachte Prozesse: {normalized_watch}")

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

        logging.info(f"⏳ Prozesse laufen noch: {running}")
        time.sleep(5)

    logging.info("✅ Alle überwachten Prozesse abgeschlossen.")


def execute_plan(plan):
    env_vars_all = plan.get("env_vars") or {}
    env_vars = env_vars_all.get(OS_TYPE) or {}

    installers_all = plan.get("installers") or {}
    installers = installers_all.get(OS_TYPE) or []

    watch_list = plan.get("watch") or []

    check_func = plan.get("check")

    for key, values in (env_vars or {}).items():
        if values is not None:
            os.environ[key] = os.pathsep.join(values + [os.environ.get(key, "")])

    if callable(check_func) and check_func():
        logging.info(f"✅ {plan.get('installer_name') or 'Plan'} bereits installiert und geprüft.")
        return

    logging.info(f"⚠️ {plan.get('installer_name') or 'Plan'} nicht gefunden – Installation wird gestartet.")

    driver_folder = detect_platform_driver_folder()
    os.makedirs(__DRIVER_FOLDER, exist_ok=True)

    for installer_zip in installers:
        if not installer_zip:
            continue
        zip_path = os.path.join(driver_folder, installer_zip)
        if not os.path.exists(zip_path):
            logging.warning(f"⚠️ Installer nicht gefunden: {zip_path}")
            continue

        logging.info(f"📦 Entpacke {installer_zip}")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(__DRIVER_FOLDER)

        for f in os.listdir(__DRIVER_FOLDER):
            abs_path = os.path.join(__DRIVER_FOLDER, f)
            if f.endswith(".exe") and OS_TYPE == "windows":
                logging.info(f"🚀 Starte Installer als Admin: {abs_path}")
                try:
                    run_installer_as_admin(abs_path, "/S")
                except Exception as e:
                    logging.error(f"❌ Fehler beim Admin-Start von {abs_path}: {e}")
            elif f.endswith(".exe"):
                logging.info(f"🚀 Starte Installer: {abs_path}")
                try:
                    subprocess.run([abs_path, "/S"], check=True)
                except Exception as e:
                    logging.error(f"❌ Fehler beim Ausführen von {abs_path}: {e}")
            elif f.endswith(".tar.gz"):
                logging.info(f"📦 Entpacke tar.gz: {abs_path}")
                try:
                    with tarfile.open(abs_path, "r:gz") as tar:
                        tar.extractall(__DRIVER_FOLDER)
                except Exception as e:
                    logging.error(f"❌ Fehler beim Entpacken von {abs_path}: {e}")

    # Watch-Logik für automatisch gestartete Setup.exe
    if OS_TYPE == "windows" and watch_list:
        watch_list_existing = [p for p in watch_list if os.path.exists(p)]
        if watch_list_existing:
            wait_for_watch_processes(watch_list_existing)

    # End-Check
    if callable(check_func):
        try:
            if check_func():
                logging.info(f"✅ {plan.get('installer_name') or 'Plan'} erfolgreich installiert und geprüft.")
            else:
                logging.error(f"❌ {plan.get('installer_name') or 'Plan'} Installation/Check fehlgeschlagen.")
        except Exception as e:
            logging.error(f"❌ Fehler beim Ausführen des Checks: {e}")


def load_package_plans():
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
                    logging.info(f"🧩 Plan geladen: {attr_name} aus {filename}")
                except Exception as e:
                    logging.error(f"❌ Fehler beim Laden von {attr_name} in {filename}: {e}")

    return plans


def driver(os_type, os_arch):
    set_os(os_type, os_arch)

    plans = load_package_plans()
    config_set = {}

    for plan in plans:
        plan_id = plan.get("id", None)
        installer_name = plan.get("installer_name", "Unbekannt")
        check_func = plan.get("check")
        plan_return = plan.get("return", None)

        logging.info(f"🚀 Initialisierung starten: {installer_name}")

        # Führe Installation aus
        execute_plan(plan)

        # Prüfe Status dynamisch über check_func
        if callable(check_func):
            try:
                status = bool(check_func())
            except Exception as e:
                logging.error(f"❌ Fehler beim Prüfen von {plan_id}: {e}")
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

        logging.info(f"✅ Initialisierung abgeschlossen: {installer_name}")

    # Temporäre Treiber-Dateien entfernen
    if os.path.exists(__DRIVER_FOLDER):
        retries = [10, 15, 20]
        for i, wait in enumerate(retries):
            try:
                shutil.rmtree(__DRIVER_FOLDER)
                logging.info("🧹 Temporäre Installations-Dateien entfernt.")
                break
            except Exception as e:
                if i < len(retries) - 1:
                    logging.warning(f"❌ Versuch {i+1}: Konnte temporäre Installations-Dateien nicht entfernen: {e}. Neuer Versuch in {wait} Sekunden...")
                    time.sleep(wait)
                else:
                    logging.error(f"❌ Alle Versuche fehlgeschlagen: {e}")

    # Saubere Ausgabe des Config-Sets am Ende
    print("=== Build Tools ===")
    for plan_id, data in config_set.items():
        print(f"{plan_id:<20} : {data['value']}")
    print("===================================")

    return config_set



def main(os_type, os_arch):
    return driver(os_type, os_arch)
