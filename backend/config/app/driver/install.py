import os
import platform
import shutil
import subprocess
import tarfile
import zipfile
import logging
import ctypes
import ctypes.wintypes
import cairosvg
import logging

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


def detect_cairosvg():
    try:
        cairosvg.svg2png(bytestring=b"<svg><rect width='100' height='100' fill='red'/></svg>", write_to="test.png")
        logging.info("✅ CairoSVG funktioniert korrekt (test.png erstellt).")
    except Exception as e:
        logging.error(f"❌ CairoSVG Fehler: {e}")


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

def detect_cairosvg_or_install():
    """
    Stellt sicher, dass CairoSVG und GTK3 Runtime korrekt installiert und in PATH registriert sind.
    Funktioniert auf Windows, Linux und Arch.
    """
    system = platform.system().lower()

    # --- Prüfe CairoSVG (Python-Paket)
    try:
        import cairosvg
        logging.info("✅ CairoSVG ist installiert.")
    except ImportError:
        logging.info("📦 CairoSVG wird installiert ...")
        subprocess.run(["pip", "install", "--upgrade", "cairosvg"], check=True)

    # --- Windows: GTK3 Runtime prüfen
    if system == "windows":
        gtk_base = r"C:\Program Files\GTK3-Runtime Win64"
        gtk_bin = os.path.join(gtk_base, "bin")
        gtk_lib = os.path.join(gtk_base, "lib")

        # Prüfe, ob GTK installiert ist
        gtk_dll = os.path.join(gtk_bin, "libcairo-2.dll")
        if not os.path.exists(gtk_dll):
            logging.warning("⚠️ GTK3 Runtime nicht gefunden – versuche, Installer auszuführen ...")

            # Suche nach Installer im Treiber-Ordner
            from generated.paths import ASSETS_DRIVER_WINDOWS_FOLDER
            from config.app.app_settings import run_installer_as_admin_and_wait

            installer_name = "gtk3-runtime-3.24.31-2022-01-04-ts-win64.exe"
            installer_path = os.path.join(ASSETS_DRIVER_WINDOWS_FOLDER, installer_name)

            if os.path.exists(installer_path):
                logging.info(f"🚀 Starte GTK3 Runtime Installer: {installer_path}")
                run_installer_as_admin_and_wait(installer_path, "/S")
            else:
                logging.error(f"❌ GTK3 Runtime Installer nicht gefunden unter: {installer_path}")
        else:
            logging.info("✅ GTK3 Runtime ist bereits installiert.")

        # PATH prüfen & ggf. hinzufügen
        path_env = os.environ.get("PATH", "")
        paths_to_add = []
        for p in [gtk_bin, gtk_lib]:
            if os.path.exists(p) and p not in path_env:
                paths_to_add.append(p)

        if paths_to_add:
            new_path = os.pathsep.join(paths_to_add + [path_env])
            os.environ["PATH"] = new_path
            logging.info(f"🔧 GTK3-Pfade temporär zu PATH hinzugefügt: {paths_to_add}")

            # Optional: dauerhaft in Windows-Systemvariablen schreiben
            try:
                subprocess.run(
                    [
                        "setx",
                        "PATH",
                        f"{new_path}",
                    ],
                    shell=True,
                    check=False,
                )
                logging.info("✅ PATH dauerhaft aktualisiert (setx).")
            except Exception as e:
                logging.warning(f"⚠️ Konnte PATH nicht dauerhaft setzen: {e}")

    # --- Linux / Arch
    elif system == "linux":
        logging.info("🐧 Prüfe Cairo- und GTK-Abhängigkeiten unter Linux ...")
        # Prüfe ob libcairo2 vorhanden ist
        if shutil.which("cairo-trace") or os.path.exists("/usr/lib/libcairo.so"):
            logging.info("✅ Cairo ist installiert.")
        else:
            logging.warning("⚠️ Cairo fehlt – Installation wird versucht.")
            try:
                subprocess.run(["sudo", "apt", "install", "-y", "libcairo2"], check=True)
            except Exception:
                logging.warning("⚠️ Automatische Installation von libcairo2 fehlgeschlagen. Bitte manuell installieren.")


if __name__ == "__main__":
    detect_nvcompress_or_install()
    detect_cairosvg_or_install()
