import os
import platform
import psutil

def generate_system_data(development=True, log_level=1):
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

    if development and log_level >= 2:
        print("=== Systeminformationen erkannt ===")
        print(f"OS_TYPE         : {system}")
        print(f"OS_ARCH         : {arch}")
        print(f"OS_CPU          : {cpu}")
        print(f"OS_THREADS      : {threads}")
        print(f"OS_MEMORY       : {total_memory_gb} GB")
        if development and log_level == 3:
            print(f"OS_SYSTEM_NAME  : {node}")
        print("==================================")

    return config_set


def main(development=True, log_level=1):
    return generate_system_data(development=development, log_level=log_level)


if __name__ == "__main__":
    main(development=True, log_level=3)
