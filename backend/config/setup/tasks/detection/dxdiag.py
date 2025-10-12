import os
import subprocess
import logging

try:
    import chardet
except ImportError:
    chardet = None


def dxdiag():
    """
    AMD GPU Detection unter Windows via dxdiag.
    """
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
                gpu_memory_mb = gpu_memory_mb or 4096
                logging.info(f"dxdiag detected AMD GPU: {gpu_name} ({gpu_memory_mb} MB)")
                return True, gpu_name, gpu_memory_mb

        return False, "No AMD GPU Available", 0
    except Exception as e:
        logging.error(f"Error detecting AMD GPU (dxdiag): {e}")
        return False, "Error", 0
