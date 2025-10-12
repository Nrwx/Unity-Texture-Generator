import logging


def pytorch():
    """
    GPU Detection via PyTorch (CUDA-Verfügbarkeit prüfen).
    """
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory_mb = torch.cuda.get_device_properties(0).total_memory // (1024 ** 2)
            logging.info(f"PyTorch detected GPU: {gpu_name} ({gpu_memory_mb} MB)")
            return True, gpu_name, gpu_memory_mb
        else:
            logging.info("PyTorch: No CUDA GPU detected.")
            return False, "No GPU Available", 0
    except ImportError:
        logging.warning("PyTorch not installed.")
        return False, "PyTorch not installed", 0
    except Exception as e:
        logging.error(f"Error detecting GPU via PyTorch: {e}")
        return False, "Error", 0
