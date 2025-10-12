import subprocess
import logging


def intel_linux():
    """
    Intel GPU Detection unter Linux via lspci.
    """
    try:
        result = subprocess.run(["lspci"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines():
            if "VGA compatible controller" in line and "Intel" in line:
                gpu_name = line.split(":")[2].strip()
                gpu_memory_mb = 1024
                logging.info(f"lspci detected Intel GPU: {gpu_name}")
                return True, gpu_name, gpu_memory_mb
        return False, "No Intel GPU Available", 0
    except FileNotFoundError:
        logging.warning("lspci not found, skipping Intel GPU detection.")
        return False, "lspci not found", 0
    except Exception as e:
        logging.error(f"Error detecting Intel GPU (Linux): {e}")
        return False, "Error", 0
