def calculate_system_score(cpu_threads: int, total_memory_gb: float, gpu_memory_gb: float):
    """
    Berechnet einen Hardware-Leistungsindex (0–100) anhand von CPU, RAM und GPU.
    Gewichtung: CPU 50%, RAM 30%, GPU 20%.
    """
    cpu_score = min(cpu_threads / 32 * 50, 50)
    ram_score = min(total_memory_gb / 32 * 30, 30)
    gpu_score = min(gpu_memory_gb / 16 * 20, 20)  # 16 GB GPU RAM als Maximum für volle Punktzahl

    total_score = round(cpu_score + ram_score + gpu_score, 2)

    if total_score >= 70:
        rating = "HIGH"
    elif total_score >= 40:
        rating = "MEDIUM"
    else:
        rating = "LOW"

    return total_score, rating


def estimate_project_requirements(project_complexity: float = 1.0):
    """
    Schätzt empfohlene Systemressourcen (RAM, CPU, GPU) basierend auf Projektkomplexität.
    project_complexity: float (0.5 – 2.0)
    """
    base_ram_gb = round(4 * project_complexity, 1)
    base_threads = int(2 * project_complexity)
    base_gpu_mb = int(2048 * project_complexity)  # 2 GB Basis GPU in MB
    base_gpu_gb = round(base_gpu_mb / 1024, 2)    # Umrechnung in GB
    return base_ram_gb, base_threads, base_gpu_gb


def measure(os_type: str,
            os_arch: str,
            os_cpu: str,
            os_threads: int,
            os_memory: float,
            gpu_name: str = "None",
            gpu_memory_mb: int = 0,
            development: bool = True,
            log_level: int = 2):
    """
    Berechnet den Measure Index basierend auf System- und GPU-Parametern.
    Liefert ein kombiniertes Set im einheitlichen Format zurück.
    """

    gpu_memory_gb = round(gpu_memory_mb / 1024, 2)

    # Bewertung und Empfehlung berechnen
    score, rating = calculate_system_score(os_threads, os_memory, gpu_memory_gb)
    recommended_ram, recommended_threads, recommended_gpu_gb = estimate_project_requirements(1.0)

    measure_index = {
        "SYSTEM_SCORE": {"value": score, "type": float},
        "SYSTEM_RATING": {"value": rating, "type": str},
        "RECOMMENDED_RAM_GB": {"value": recommended_ram, "type": float},
        "RECOMMENDED_CPU_THREADS": {"value": recommended_threads, "type": int},
        "RECOMMENDED_GPU_GB": {"value": recommended_gpu_gb, "type": float}
    }

    return measure_index


def main(os_type: str,
         os_arch: str,
         os_cpu: str,
         os_threads: int,
         os_memory: float,
         gpu_name: str = "None",
         gpu_memory_mb: int = 0,
         development: bool = True,
         log_level: int = 2):
    """
    Hauptschnittstelle – nimmt alle System- und GPU-Parameter direkt entgegen
    und gibt das vollständige Bewertungs-Set zurück.
    """
    return measure(os_type, os_arch, os_cpu, os_threads, os_memory,
                   gpu_name, gpu_memory_mb, development, log_level)