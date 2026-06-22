from datetime import datetime
import sys

class Console:
    COLORS = {
        "reset": "\033[0m",
        "info": "\033[94m",
        "success": "\033[92m",
        "warning": "\033[93m",
        "error": "\033[91m",
        "title": "\033[95m",
    }

    @staticmethod
    def print(msg: str, instance:str, level:str, icon:str=None, style: str=None):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        use_color = bool(getattr(sys.stdout, "isatty", lambda: False)())
        color = Console.COLORS.get(style, "") if use_color else ""
        reset = Console.COLORS["reset"] if use_color else ""
        instanceU = instance.upper()
        encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
        if icon is not None:
            try:
                icon.encode(encoding)
            except Exception:
                icon = None

        if icon != None:
            text = f"{reset}[{now}]-{icon} -[{instanceU}]-[{level}] {color}{msg}{reset}"
        else:
            text = f"{reset}[{now}]-[{instanceU}]-[{level}] {color}{msg}{reset}"

        print(text.encode(encoding, errors="replace").decode(encoding, errors="replace"), flush=True)
