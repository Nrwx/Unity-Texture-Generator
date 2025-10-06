import os
import time
import platform
import shutil
import zipfile
import tarfile
import logging
import subprocess
import ctypes
import ctypes.wintypes
from generated.paths import __DRIVER_FOLDER
from config.app.driver.packages.nvcompress_setup import plan_nvcompress
from config.app.driver.packages.cairosvg_setup import plan_cairosvg

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def detect_platform_driver_folder():
    system = platform.system().lower()
    arch = platform.machine().lower()
    from generated.paths import ASSETS_DRIVER_WINDOWS_FOLDER, ASSETS_DRIVER_LINUX_FOLDER, ASSETS_DRIVER_AARCH64_FOLDER

    if system == "windows":
        return ASSETS_DRIVER_WINDOWS_FOLDER
    elif "arm" in arch or "aarch64" in arch:
        return ASSETS_DRIVER_AARCH64_FOLDER
    elif system == "linux":
        return ASSETS_DRIVER_LINUX_FOLDER
    else:
        raise RuntimeError(f"❌ Unsupported system: {system} ({arch})")


def run_installer_as_admin(exe_path, params="/S"):
    """Startet einen Windows-Installer mit Adminrechten und wartet auf Beendigung."""
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


def execute_plan(plan):
    platform_name = platform.system().lower()

    # Sicherstellen, dass env_vars und installers dicts sind
    env_vars_all = plan.get("env_vars") or {}
    env_vars = env_vars_all.get(platform_name) or {}

    installers_all = plan.get("installers") or {}
    installers = installers_all.get(platform_name) or []

    check_func = plan.get("check")

    # Env Vars setzen
    for key, values in (env_vars or {}).items():
        if values is not None:
            os.environ[key] = os.pathsep.join(values + [os.environ.get(key, "")])

    # Check vor Installation
    if callable(check_func) and check_func():
        logging.info(f"✅ {plan.get('installer_name') or 'Plan'} bereits installiert, überspringe Installation.")
        return

    logging.info(f"⚠️ {plan.get('installer_name') or 'Plan'} nicht gefunden – Installation wird gestartet.")

    # Installer entpacken und ausführen
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

        # Führe exe oder entpackte tar.gz aus
        for f in os.listdir(__DRIVER_FOLDER):
            abs_path = os.path.join(__DRIVER_FOLDER, f)
            if f.endswith(".exe") and platform.system().lower() == "windows":
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

    # Check nach Installation
    if callable(check_func):
        try:
            if check_func():
                logging.info(f"✅ {plan.get('installer_name') or 'Plan'} erfolgreich installiert und geprüft.")
            else:
                logging.error(f"❌ {plan.get('installer_name') or 'Plan'} Installation/Check fehlgeschlagen.")
        except Exception as e:
            logging.error(f"❌ Fehler beim Ausführen des Checks: {e}")


def initialize_drivers():
    """
    Initialisiert alle installierbaren Tools / Drivers in der Reihenfolge der Plans.
    """
    plans = [
        plan_nvcompress(),
        plan_cairosvg()
    ]

    for plan in plans:
        logging.info(f"🚀 Initialisierung starten: {plan.get('installer_name', 'Unbekannt')}")
        execute_plan(plan)
        logging.info(f"✅ Initialisierung abgeschlossen: {plan.get('installer_name', 'Unbekannt')}\n")

    if os.path.exists(__DRIVER_FOLDER):
        retries = [10, 15, 20]  # Sekunden
        for i, wait in enumerate(retries):
            try:
                shutil.rmtree(__DRIVER_FOLDER)
                logging.info("🧹 Temporäre Installations-Dateien entfernt.")
                break  # erfolgreich, Abbruch der Schleife
            except Exception as e:
                if i < len(retries) - 1:
                    logging.warning(f"❌ Versuch {i+1}: Konnte temporäre Installations-Dateien nicht entfernen: {e}. Neuer Versuch in {wait} Sekunden...")
                    time.sleep(wait)
                else:
                    logging.error(f"❌ Alle Versuche fehlgeschlagen: {e}")

if __name__ == "__main__":
    initialize_drivers()
