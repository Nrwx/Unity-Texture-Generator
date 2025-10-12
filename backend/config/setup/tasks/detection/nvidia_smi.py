import subprocess
import logging


def nvidia_smi():
    """
    NVIDIA GPU Detection via nvidia-smi.
    """
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        if result.returncode == 0:
            output = result.stdout.strip().split('\n')[0]
            gpu_name, gpu_memory_mb = output.split(", ")
            gpu_memory_mb = int(gpu_memory_mb)
            logging.info(f"nvidia-smi detected NVIDIA GPU: {gpu_name} ({gpu_memory_mb} MB)")
            return True, gpu_name, gpu_memory_mb
        return False, "No NVIDIA GPU Available", 0
    except FileNotFoundError:
        logging.error("nvidia-smi not found. Ensure NVIDIA drivers are installed.")
        return False, "nvidia-smi not found", 0
    except Exception as e:
        logging.error(f"Error during NVIDIA GPU detection via nvidia-smi: {e}")
        return False, "Error", 0
