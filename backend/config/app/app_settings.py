import os
import json
import logging
import subprocess

# Optional für dxdiag (AMD unter Windows)
try:
    import chardet
except ImportError:
    chardet = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

CPU_THREADS = os.cpu_count()
DEFAULT_ANIMATION_SETTINGS = {
    "use_gpu": False,
    "gpu_name": "None",
    "gpu_memory_mb": 0,
    "cpu_threads": CPU_THREADS,
    "preferred_unit": "CPU",
}

SETTINGS_FILE_PATH = os.path.join(os.getenv("APP_CONFIG_PATH", "config/app"), "app_settings.json")

def detect_intel_gpu_windows():
    try:
        import tempfile
        if not chardet:
            logging.error("chardet not installed. Run 'pip install chardet'")
            return False, "chardet not installed", 0

        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
            temp_path = temp_file.name

        subprocess.run(["dxdiag", "/t", temp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        with open(temp_path, 'rb') as raw_file:
            raw_data = raw_file.read()
            detected = chardet.detect(raw_data)
            encoding = detected['encoding'] or 'utf-8'
            text = raw_data.decode(encoding)
        os.remove(temp_path)

        gpu_name = None
        gpu_memory_mb = 0

        for line in text.splitlines():
            if "Card name" in line and "Intel" in line:
                gpu_name = line.split(":")[1].strip()
            if "Display Memory" in line and "MB" in line:
                mem_str = ''.join(filter(str.isdigit, line))
                if mem_str.isdigit():
                    gpu_memory_mb = int(mem_str)

        if gpu_name:
            if gpu_memory_mb == 0:
                gpu_memory_mb = 1024  # typische Onboard-GPU RAM-Größe als Fallback
            logging.info(f"dxdiag detected Intel GPU: {gpu_name} with approx. {gpu_memory_mb} MB.")
            return True, gpu_name, gpu_memory_mb

        # Alternative mit WMIC
        result = subprocess.run(["wmic", "path", "win32_videocontroller", "get", "name,adapterram"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines():
            if "Intel" in line:
                parts = line.split()
                gpu_name = " ".join(parts[:-1])
                gpu_memory_mb = int(parts[-1]) // (1024**2)
                return True, gpu_name, gpu_memory_mb

        return False, "No Intel GPU Available", 0
    except Exception as e:
        logging.error(f"Error detecting Intel GPU: {e}")
        return False, "Error", 0


def detect_intel_gpu_linux():
    try:
        result = subprocess.run(["lspci"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines():
            if "VGA compatible controller" in line and "Intel" in line:
                gpu_name = line.split(":")[2].strip()
                gpu_memory_mb = 1024  # typischer Wert für Intel Onboard GPU
                logging.info(f"lspci detected Intel GPU: {gpu_name}")
                return True, gpu_name, gpu_memory_mb
        return False, "No Intel GPU Available", 0
    except FileNotFoundError:
        logging.warning("lspci not found, skipping Intel GPU detection.")
        return False, "lspci not found", 0
    except Exception as e:
        logging.error(f"Error detecting Intel GPU: {e}")
        return False, "Error", 0


def detect_gpu_with_rocm_smi():
    try:
        result = subprocess.run(["rocm-smi", "--showproductname", "--showmeminfo", "vram"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            gpu_name = "AMD GPU"
            gpu_memory_mb = 0
            for line in result.stdout.splitlines():
                if "Card series" in line or "GPU" in line:
                    gpu_name = line.split(":")[-1].strip()
                if "Total VRAM Memory" in line:
                    mem_str = ''.join(filter(str.isdigit, line))
                    if mem_str.isdigit():
                        gpu_memory_mb = int(mem_str)
            if gpu_memory_mb == 0:
                gpu_memory_mb = 4096  # Fallback
            logging.info(f"rocm-smi detected AMD GPU: {gpu_name} with approx. {gpu_memory_mb} MB memory.")
            return True, gpu_name, gpu_memory_mb
        return False, "No AMD GPU Available", 0
    except FileNotFoundError:
        logging.warning("rocm-smi not found.")
        return False, "rocm-smi not found", 0
    except Exception as e:
        logging.error(f"Error during AMD GPU detection via rocm-smi: {e}")
        return False, "Error", 0

def detect_gpu_with_nvidia_smi():
    """
    Erkennung der GPU mit dem nvidia-smi Kommandozeilenwerkzeug.
    """
    try:
        result = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            output = result.stdout.strip().split('\n')[0]  # Erster GPU-Eintrag
            gpu_name, gpu_memory_mb = output.split(", ")
            gpu_memory_mb = int(gpu_memory_mb)  # Speicher in MB konvertieren
            logging.info(f"nvidia-smi detected NVIDIA GPU: {gpu_name} with {gpu_memory_mb} MB memory.")
            return True, gpu_name, gpu_memory_mb
        else:
            logging.info("nvidia-smi command did not detect a GPU.")
            return False, "No GPU Available", 0
    except FileNotFoundError:
        logging.error("nvidia-smi not found. Ensure NVIDIA drivers are installed.")
        return False, "nvidia-smi not found", 0
    except Exception as e:
        logging.error(f"Error during nvidia-smi GPU detection: {e}")
        return False, "Error", 0

def detect_amd_gpu_with_dxdiag():
    try:
        import tempfile

        if not chardet:
            logging.error("chardet not installed. Run 'pip install chardet'")
            return False, "chardet not installed", 0

        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
            temp_path = temp_file.name

        result = subprocess.run(["dxdiag", "/t", temp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            with open(temp_path, 'rb') as raw_file:
                raw_data = raw_file.read()
                detected = chardet.detect(raw_data)
                encoding = detected['encoding'] or 'utf-8'
                text = raw_data.decode(encoding)

            os.remove(temp_path)

            gpu_name = None
            gpu_memory_mb = 0

            for line in text.splitlines():
                if "Card name" in line and ("Radeon" in line or "AMD" in line):
                    gpu_name = line.split(":")[1].strip()
                if "Display Memory" in line and "MB" in line:
                    mem_str = ''.join(filter(str.isdigit, line))
                    if mem_str.isdigit():
                        gpu_memory_mb = int(mem_str)

            if gpu_name:
                if gpu_memory_mb == 0:
                    gpu_memory_mb = 4096  # Fallback, falls Speicher nicht erkannt
                logging.info(f"dxdiag detected AMD GPU: {gpu_name} with approx. {gpu_memory_mb} MB.")
                return True, gpu_name, gpu_memory_mb

        return False, "No AMD GPU Available", 0
    except Exception as e:
        logging.error(f"Error during AMD GPU detection via dxdiag: {e}")
        return False, "Error", 0

def detect_gpu_with_pytorch():
    """
    Erkennung der GPU mit PyTorch, falls verfügbar.
    """
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory_mb = torch.cuda.get_device_properties(0).total_memory // (1024 ** 2)
            logging.info(f"PyTorch detected NVIDIA GPU: {gpu_name} with {gpu_memory_mb} MB memory.")
            return True, gpu_name, gpu_memory_mb
        else:
            logging.info("PyTorch: No CUDA GPU detected.")
            return False, "No GPU Available", 0
    except ImportError:
        logging.error("PyTorch is not installed. Skipping PyTorch detection.")
        return False, "PyTorch not installed", 0
    except Exception as e:
        logging.error(f"Unexpected error during PyTorch GPU detection: {e}")
        return False, "Error", 0


def detect_gpu_with_pycuda():
    """
    Erkennung der GPU mit der PyCUDA-Bibliothek.
    """
    try:
        import pycuda.driver as cuda
        cuda.init()
        device = cuda.Device(0)
        gpu_name = device.name()
        gpu_memory_mb = device.total_memory() // (1024 ** 2)
        logging.info(f"PyCUDA detected NVIDIA GPU: {gpu_name} with {gpu_memory_mb} MB memory.")
        return True, gpu_name, gpu_memory_mb
    except ImportError:
        logging.error("PyCUDA is not installed. Skipping PyCUDA detection.")
        return False, "PyCUDA not installed", 0
    except Exception as e:
        logging.error(f"Error during PyCUDA GPU detection: {e}")
        return False, "Error", 0

def detect_gpu():
    """
    Optimierte GPU-Erkennung:
    - Platformbasiert
    - Prüft zuerst Intel Onboard GPUs, da diese meist langsamer sind
    - Danach dedizierte GPUs (NVIDIA/AMD) für schnellere Detection
    """
    import platform
    system = platform.system()

    detection_methods = []

    if system == "Windows":
        # Intel Onboard zuerst prüfen
        detection_methods.append(detect_intel_gpu_windows)
        detection_methods.append(detect_amd_gpu_with_dxdiag)
        detection_methods.append(detect_gpu_with_nvidia_smi)
        detection_methods.append(detect_gpu_with_pytorch)
        detection_methods.append(detect_gpu_with_pycuda)
    elif system == "Linux":
        # Intel Onboard zuerst prüfen
        detection_methods.append(detect_intel_gpu_linux)
        detection_methods.append(detect_gpu_with_rocm_smi)
        detection_methods.append(detect_gpu_with_nvidia_smi)
        detection_methods.append(detect_gpu_with_pytorch)
        detection_methods.append(detect_gpu_with_pycuda)
    else:
        # Fallback für andere Plattformen
        detection_methods.extend([
            detect_gpu_with_nvidia_smi,
            detect_gpu_with_pytorch,
            detect_gpu_with_pycuda
        ])

    for method in detection_methods:
        gpu_available, gpu_name, gpu_memory_mb = method()
        if gpu_available:
            logging.info(f"GPU detected using {method.__name__}: {gpu_name} with {gpu_memory_mb} MB memory.")
            return True, gpu_name, gpu_memory_mb

    logging.info("No GPU detected after trying all available methods.")
    return False, "No GPU Available", 0



def load_app_settings():
    if os.path.exists(SETTINGS_FILE_PATH):
        with open(SETTINGS_FILE_PATH, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                logging.warning("Invalid JSON file format. Using default settings.")
    return DEFAULT_ANIMATION_SETTINGS.copy()


def save_app_settings(updated_settings):
    os.makedirs(os.path.dirname(SETTINGS_FILE_PATH), exist_ok=True)
    with open(SETTINGS_FILE_PATH, 'w') as f:
        json.dump(updated_settings, f, indent=4)
    logging.info("Settings saved successfully.")


def update_settings_if_changed():
    global ANIMATION_SETTINGS

    GPU_AVAILABLE, GPU_NAME, GPU_MEMORY_MB = detect_gpu()

    current_settings = load_app_settings()


    updated_settings = {
        "use_gpu": GPU_AVAILABLE,
        "gpu_name": GPU_NAME,
        "gpu_memory_mb": GPU_MEMORY_MB,
        "cpu_threads": CPU_THREADS,
        "preferred_unit": "GPU" if GPU_AVAILABLE else "CPU",
    }

    if current_settings != updated_settings:
        save_app_settings(updated_settings)

    ANIMATION_SETTINGS = updated_settings


def get_app_settings():
    GPU_AVAILABLE, GPU_NAME, GPU_MEMORY_MB = detect_gpu()
    current_settings = load_app_settings()
    save_app_settings(current_settings)
    return current_settings


# Initialisieren der Einstellungen
ANIMATION_SETTINGS = load_app_settings()
update_settings_if_changed()

if __name__ == "__main__":
    current_settings = get_app_settings()
    logging.info(f"Current App Settings: {current_settings}")
