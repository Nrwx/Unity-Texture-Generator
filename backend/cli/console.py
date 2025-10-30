from datetime import datetime

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
        color = Console.COLORS.get(style, "")
        reset = Console.COLORS["reset"]
        instanceU = instance.upper()
        if icon != None:
            print(f"{reset}[{now}]-{icon} -[{instanceU}]-[{level}] {color}{msg}")
        else:
            print(f"{reset}[{now}]-[{instanceU}]-[{level}] {color}{msg}")
