import os
import platform
import psutil

def generate_system_data(development, log_level):
    """
    Erkennt grundlegende Systeminformationen und gibt sie
    im Set-Format Dict zurück (inkl. Gesamt-RAM).
    """
    system = platform.system().lower()
    arch = platform.machine().lower()
    cpu = platform.processor()
    threads = os.cpu_count()
    node = platform.node()

    # Nur Gesamt-RAM
    memory = psutil.virtual_memory()
    total_memory_gb = round(memory.total / (1024 ** 3), 2)

    config_set = {
        "OS_TYPE": {"value": system, "type": str},
        "OS_ARCH": {"value": arch, "type": str},
        "OS_CPU": {"value": cpu, "type": str},
        "OS_THREADS": {"value": threads, "type": int},
        "OS_SYSTEM_NAME": {"value": node, "type": str},
        "OS_MEMORY": {"value": total_memory_gb, "type": float},
    }

    return config_set


def main(development=True, log_level=1):
    return generate_system_data(development, log_level)