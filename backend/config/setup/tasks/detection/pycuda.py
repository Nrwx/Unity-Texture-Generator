import logging


def pycuda():
    """
    GPU Detection via PyCUDA.
    """
    try:
        import pycuda.driver as cuda
        cuda.init()
        device = cuda.Device(0)
        gpu_name = device.name()
        gpu_memory_mb = device.total_memory() // (1024 ** 2)
        logging.info(f"PyCUDA detected GPU: {gpu_name} ({gpu_memory_mb} MB)")
        return True, gpu_name, gpu_memory_mb
    except ImportError:
        logging.warning("PyCUDA not installed.")
        return False, "PyCUDA not installed", 0
    except Exception as e:
        logging.error(f"Error detecting GPU via PyCUDA: {e}")
        return False, "Error", 0
