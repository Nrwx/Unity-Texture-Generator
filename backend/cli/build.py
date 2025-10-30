import json
from pathlib import Path
from typing import Optional, Any, Callable
from .console import Console

def _normalize_modules_count(result: Any) -> int:
    """
    Normalisiert Rückgaben von generate_init / write_combined_init:
      - int -> int
      - (written, skipped) -> written
      - tuple/list -> sum der int-Elemente (Fallback)
    """
    if result is None:
        return 0
    if isinstance(result, int):
        return result
    if isinstance(result, (list, tuple)):
        if len(result) >= 1 and isinstance(result[0], int):
            return result[0]
        # fallback: summe aller int-elemente
        s = 0
        for x in result:
            if isinstance(x, int):
                s += x
        return s
    try:
        return int(result)
    except Exception:
        return 0

def load_build_config(config_path: str = "build.json") -> dict:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Build-Konfiguration '{config_path}' nicht gefunden.")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def build_project(config_path: str = "build.json", target_core_path: Optional[str] = None, log: Optional[Callable] = None) -> int:
    """
    Führt build auf Basis der JSON-Konfiguration aus.
    Wenn config_path fehlt, wird target_core_path direkt verarbeitet.
    base path is cwd.
    Returns total modules initialized.
    """
    base_path = Path.cwd()
    total_modules = 0

    if target_core_path:
        core_full = (base_path / target_core_path).resolve()
        from core.utils.generate_init import generate_init
        # Create __init__ for the whole core tree
        result = generate_init(
            path=str(core_full),
            lazy=True,
            direct_imports=[],
            ignore=[],
            log=log or (lambda m: Console.print(m, 'info'))
        )
        modules_count = _normalize_modules_count(result)
        total_modules += modules_count
        if log:
            log(f"[BUILD] Wrote __init__ files under: {core_full} -> {modules_count} packages initialized")
        else:
            Console.print(f"[BUILD] Wrote __init__ files under: {core_full} -> {modules_count} packages initialized", 'success')
        return total_modules

    # fallback to config path
    try:
        config = load_build_config(config_path)
    except FileNotFoundError as e:
        if log:
            log(str(e))
        else:
            Console.print(str(e), 'error')
        return 0

    for entry in config.get("modules", []):
        rel_path = entry.get("path")
        if not rel_path:
            if log:
                log(f"[BUILD] Pfad fehlt für Eintrag: {entry}")
            continue

        full_path = (base_path / rel_path).resolve()
        lazy = entry.get("lazy", True)
        direct_imports = entry.get("direct_imports", [])
        ignore = entry.get("ignore", [])

        from core.utils.generate_init import generate_init
        result = generate_init(
            path=str(full_path),
            lazy=lazy,
            direct_imports=direct_imports,
            ignore=ignore,
            log=log
        )
        modules_count = _normalize_modules_count(result)
        total_modules += modules_count

    if log:
        log(f"[BUILD] Build abgeschlossen. Insgesamt {total_modules} Module/Ordner initialisiert.")
    else:
        Console.print(f"[BUILD] Build abgeschlossen. Insgesamt {total_modules} Module/Ordner initialisiert.", 'success')

    return total_modules

if __name__ == '__main__':
    build_project(target_core_path='core', log=print)
