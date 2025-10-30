from .console import Console

def register_setup(manager):
    def setup_command():
        # placeholder for real setup actions
        Console.print("Setup ausgeführt.", "success", "✅")
    manager.register_command("setup", setup_command, "System Setup ausführen")
