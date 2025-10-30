from pathlib import Path
from typing import List, Optional, Callable, Tuple, Set

def _is_package(p: Path, ignore: Set[str]) -> bool:
    """
    True wenn p ein Paket ist — also mindestens:
      - eine .py Datei enthält (außer __init__.py)
      - oder eine Unterordner hat, der selbst ein Paket ist.
    Diese Prüfung schließt __pycache__ und andere ignorierte Ordner aus.
    """
    try:
        for child in p.iterdir():
            name = child.name
            if name in ignore or name.startswith("."):
                continue
            if child.is_file() and child.suffix == ".py" and child.stem != "__init__":
                return True
            if child.is_dir():
                # rekursiv prüfen, aber begrenzt auf 1 Ebene zur Performance
                # Wenn tiefer nötig, kann man Rekursion erlauben.
                for sub in child.iterdir():
                    if sub.is_file() and sub.suffix == ".py":
                        return True
        return False
    except Exception:
        return False

def _gather_modules(p: Path, ignore: Set[str]) -> List[str]:
    """
    Sammle alle 'sichtbaren' Submodule in p.
    - Python-Dateien (ohne __init__.py) -> name.stem
    - Unterverzeichnisse nur, wenn _is_package() True
    """
    mods: List[str] = []
    try:
        for child in sorted(p.iterdir(), key=lambda x: x.name):
            name = child.name
            # global ignore & hidden
            if name in ignore or name.startswith("."):
                continue

            if child.is_dir():
                # skip bytecode-cache, venv, git, etc. — nur echte Pakete hinzufügen
                if not _is_package(child, ignore):
                    continue
                mods.append(name)
            elif child.is_file() and child.suffix == ".py" and child.stem != "__init__":
                mods.append(child.stem)
    except Exception:
        pass
    return mods

def generate_init(
    path: str,
    lazy: bool = True,
    direct_imports: Optional[List[str]] = None,
    ignore: Optional[List[str]] = None,
    log: Optional[Callable[[str], None]] = None,
    overwrite: bool = False
) -> Tuple[int, int]:
    """
    Generiert rekursiv __init__.py in path.
    - ignore: Liste (Strings) die global angewendet werden (z.B. ["__pycache__", ".git"])
      Moduleinträge ignorieren Einträge in ignore.
    - Rückgabe: (written_count, skipped_count)
    """
    base = Path(path)
    direct_imports = direct_imports or []
    ignore_set: Set[str] = set(ignore or [])

    if not base.exists() or not base.is_dir():
        if log:
            log(f"[GENERATE-INIT] Pfad existiert nicht oder ist kein Verzeichnis: {base}")
        return 0, 0

    written = 0
    skipped = 0

    # alle Ordner (inkl. root), sortiert für deterministische Ausgabe
    folders = [base] + [d for d in sorted(base.rglob("*")) if d.is_dir()]

    for folder in folders:
        # skip hidden or ignored directories
        if folder.name.startswith(".") or folder.name in ignore_set:
            continue

        # Sammle Module (Dateien & Unterpakete), wende ignore_set an
        mods = _gather_modules(folder, ignore_set)

        # Wenn kein Modul vorhanden ist, schreibe trotzdem __init__.py mit empty __all__
        init_file = folder / "__init__.py"
        try:
            lines: List[str] = []
            lines.append("# Auto-generated __init__.py")
            lines.append(f"# Path: {folder}")

            if direct_imports:
                for imp in direct_imports:
                    lines.append(f"import {imp}")

            if mods:
                all_list = ", ".join([f"'{m}'" for m in mods])
                lines.append(f"__all__ = [{all_list}]")
                if not lazy:
                    for m in mods:
                        lines.append(f"from . import {m}")
            else:
                lines.append("__all__ = []")

            content = "\n".join(lines) + "\n"

            write_file = True
            if init_file.exists() and not overwrite:
                try:
                    old = init_file.read_text(encoding="utf-8")
                    if old == content:
                        write_file = False
                except Exception:
                    write_file = True

            if write_file:
                init_file.parent.mkdir(parents=True, exist_ok=True)
                init_file.write_text(content, encoding="utf-8")
                written += 1
                if log:
                    log(f"[GENERATE-INIT] Wrote __init__.py in: {folder}")
            else:
                skipped += 1
        except Exception as e:
            if log:
                log(f"[GENERATE-INIT] Error writing in {folder}: {e}")

    return written, skipped
