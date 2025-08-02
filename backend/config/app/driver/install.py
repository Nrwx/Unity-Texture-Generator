import os
import platform
import shutil
import subprocess
import tarfile
import zipfile
import logging
import ctypes
import ctypes.wintypes

from generated.paths import (
    ASSETS_DRIVER_AARCH64_FOLDER,
    ASSETS_DRIVER_LINUX_FOLDER,
    ASSETS_DRIVER_WINDOWS_FOLDER,
    __DRIVER_FOLDER,
)

from config.app.app_settings import detect_gpu_with_nvidia_smi
from config.data.constant import ( set_nvcompress )

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def detect_nvcompress():
    # 1. Prüfe via PATH
    path = shutil.which("nvcompress")
    if path:
        return os.path.abspath(path)

    # 2. Bekannte Orte prüfen
    if platform.system().lower() == "windows":
        possible_paths = [
            os.path.expandvars(r"%ProgramFiles%\NVIDIA Corporation\NVIDIA Texture Tools\nvcompress.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\NVIDIA Corporation\NVIDIA Texture Tools\nvcompress.exe"),
            os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "nvcompress.exe"),
        ]
    else:
        possible_paths = [
            "/usr/bin/nvcompress",
            "/usr/local/bin/nvcompress",
            "/opt/nvidia/nvcompress",
            os.path.expanduser("~/.local/bin/nvcompress"),
        ]

    for path in possible_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return os.path.abspath(path)

    return None


def detect_platform_driver_folder():
    system = platform.system().lower()
    arch = platform.machine().lower()

    if system == "windows":
        return ASSETS_DRIVER_WINDOWS_FOLDER
    elif "arm" in arch or "aarch64" in arch:
        return ASSETS_DRIVER_AARCH64_FOLDER
    elif system == "linux":
        return ASSETS_DRIVER_LINUX_FOLDER
    else:
        raise RuntimeError(f"❌ Nicht unterstütztes System: {system} ({arch})")


def run_installer_as_admin_and_wait(exe_path, params="/S"):
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

    logging.info("🟢 Installer gestartet, warte bis er beendet ist ...")
    ctypes.windll.kernel32.WaitForSingleObject(sei.hProcess, -1)
    ctypes.windll.kernel32.CloseHandle(sei.hProcess)
    logging.info("🟢 Installer beendet.")
    return True


def try_register_nvcompress_windows():
    known_dirs = [
        os.path.expandvars(r"%ProgramFiles%\NVIDIA Corporation\NVIDIA Texture Tools\nvcompress.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\NVIDIA Corporation\NVIDIA Texture Tools\nvcompress.exe"),
        os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "nvcompress.exe"),
    ]
    for directory in known_dirs:
        exe_path = os.path.join(directory, "nvcompress.exe")
        if os.path.isfile(exe_path):
            dst_path = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "nvcompress.exe")
            try:
                shutil.copy(exe_path, dst_path)
                logging.info(f"📁 nvcompress nach {dst_path} kopiert.")
                return True
            except Exception as e:
                logging.warning(f"⚠️ Konnte nvcompress nicht in PATH kopieren: {e}")
    return False


def install_nvcompress():
    driver_folder = detect_platform_driver_folder()
    os.makedirs(__DRIVER_FOLDER, exist_ok=True)

    zip_files = [f for f in os.listdir(driver_folder) if f.endswith(".zip")]
    if not zip_files:
        logging.warning("⚠️ Keine ZIP-Datei in Treiberverzeichnis gefunden.")
        return False

    for zip_name in zip_files:
        zip_path = os.path.join(driver_folder, zip_name)
        logging.info(f"📦 Entpacke {zip_name} ...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(__DRIVER_FOLDER)

        system = platform.system().lower()

        if system == "windows":
            exe_path = next(
                (os.path.abspath(os.path.join(__DRIVER_FOLDER, f)) for f in os.listdir(__DRIVER_FOLDER) if f.endswith(".exe")),
                None
            )
            if not exe_path:
                logging.error("❌ Keine .exe Installationsdatei gefunden.")
                return False

            logging.info(f"🚀 Starte Installer mit Administratorrechten: {exe_path}")
            try:
                run_installer_as_admin_and_wait(exe_path, "/S")
                try_register_nvcompress_windows()
            except Exception as e:
                logging.error(f"❌ Fehler beim Starten mit Adminrechten: {e}")
                return False

        else:  # Linux / AARCH64
            for file in os.listdir(__DRIVER_FOLDER):
                if file.endswith(".tar.gz"):
                    tar_path = os.path.join(__DRIVER_FOLDER, file)
                    logging.info(f"📦 Entpacke tar.gz: {tar_path}")
                    with tarfile.open(tar_path, "r:gz") as tar:
                        tar.extractall(__DRIVER_FOLDER)

            for root, _, files in os.walk(__DRIVER_FOLDER):
                for name in files:
                    if name == "nvcompress":
                        src_path = os.path.join(root, name)
                        dst_path = "/usr/local/bin/nvcompress"
                        logging.info(f"📁 Kopiere nvcompress → {dst_path}")
                        try:
                            shutil.copy(src_path, dst_path)
                            os.chmod(dst_path, 0o755)
                        except PermissionError:
                            logging.error("❌ Keine Berechtigung zum Schreiben nach /usr/local/bin – bitte mit sudo ausführen.")
                            return False
                        except Exception as e:
                            logging.error(f"❌ Fehler beim Kopieren: {e}")
                            return False

    try:
        shutil.rmtree(__DRIVER_FOLDER)
        logging.info("🧹 Temporärer Ordner entfernt.")
    except Exception as e:
        logging.warning(f"Konnte __DRIVER_FOLDER nicht löschen: {e}")

    return True


def detect_nvcompress_or_install():
    nvcompress_path = detect_nvcompress()
    if nvcompress_path:
        set_nvcompress(nvcompress_path)
        logging.info(f"✅ nvcompress ist bereits installiert unter: {nvcompress_path}")
        if os.path.exists(__DRIVER_FOLDER):
            try:
                shutil.rmtree(__DRIVER_FOLDER)
                logging.info("🧹 Temporärer Ordner entfernt (nach Prüfung).")
            except Exception as e:
                logging.warning(f"Konnte __DRIVER_FOLDER nicht löschen: {e}")
        return True

    gpu_available, gpu_name, _ = detect_gpu_with_nvidia_smi()
    if not gpu_available:
        logging.warning("❌ Keine NVIDIA-GPU erkannt – nvcompress wird übersprungen.")
        return False

    logging.info(f"🛠️ NVIDIA-GPU erkannt ({gpu_name}). Installation von nvcompress wird gestartet ...")
    success = install_nvcompress()

    if success:
        nvcompress_path = detect_nvcompress()
        if nvcompress_path:
            set_nvcompress(nvcompress_path)
            logging.info(f"✅ nvcompress erfolgreich installiert unter: {nvcompress_path}")
            return True
        else:
            logging.error("❌ nvcompress wurde installiert, aber Pfad konnte nicht ermittelt werden.")
            return False
    else:
        logging.error("❌ nvcompress konnte nicht installiert werden.")
        return False


if __name__ == "__main__":
    detect_nvcompress_or_install()
