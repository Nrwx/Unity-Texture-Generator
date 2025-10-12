import os
import subprocess
import logging

try:
    import chardet
except ImportError:
    chardet = None


def intel_windows():
    """
    Intel GPU Detection unter Windows via dxdiag / WMIC.
    """
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
            gpu_memory_mb = gpu_memory_mb or 1024
            logging.info(f"dxdiag detected Intel GPU: {gpu_name} ({gpu_memory_mb} MB)")
            return True, gpu_name, gpu_memory_mb

        # Alternative mit WMIC
        result = subprocess.run(["wmic", "path", "win32_videocontroller", "get", "name,adapterram"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines():
            if "Intel" in line:
                parts = line.split()
                gpu_name = " ".join(parts[:-1])
                gpu_memory_mb = int(parts[-1]) // (1024 ** 2)
                return True, gpu_name, gpu_memory_mb

        return False, "No Intel GPU Available", 0
    except Exception as e:
        logging.error(f"Error detecting Intel GPU (Windows): {e}")
        return False, "Error", 0
