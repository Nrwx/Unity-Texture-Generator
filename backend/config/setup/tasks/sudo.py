def sudo(development: bool = True, log_level: int = 3):
    """
    Initialisiert die SUDO-/Debug-Konfiguration und gibt sie im Set-Format zurück.

    :param development: Aktiviert/Deaktiviert Debug-Ausgaben
    :param log_level: LogLevel (1=normal, 2=verbose, 3=SUDO/Max)
    :return: Dict im Set-Format
             {
                 "DEVELOPMENT": {"value": True, "type": bool},
                 "LOG_LEVEL": {"value": 3, "type": int}
             }
    """
    if not isinstance(development, bool):
        raise TypeError("development muss ein bool sein")
    if not isinstance(log_level, int) or not (1 <= log_level <= 3):
        raise ValueError("log_level muss ein Integer zwischen 1 und 3 sein")

    config_set = {
        "DEVELOPMENT": {"value": development, "type": bool},
        "LOG_LEVEL": {"value": log_level, "type": int}
    }

    # Saubere Ausgabe beim Init
    print("=== SUDO / Debug-Konfiguration initialisiert ===")
    print(f"DEVELOPMENT : {development}")
    print(f"LOG_LEVEL   : {log_level}")
    print("===============================================")

    return config_set

def main():
    return sudo(development=True, log_level=3)