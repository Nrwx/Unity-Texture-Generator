from .console import Console

def register_backend_commands(manager, backend):
    def start_backend_cmd(*args):
        wait = any(a in ("-w", "--wait") for a in args)
        external = any(a in ("-x", "--external") for a in args)
        backend.start(wait=wait, external=external)

    def restart_backend_cmd(*args):
        wait = any(a in ("-w", "--wait") for a in args)
        external = any(a in ("-x", "--external") for a in args)
        backend.restart(wait=wait, external=external)

    manager.register_command(
        "start-backend",
        start_backend_cmd,
        "Startet das Flask Backend (-w / --wait, -x / --external)"
    )
    manager.register_command(
        "stop-backend",
        backend.stop,
        "Stoppt das Flask Backend"
    )
    manager.register_command(
        "restart-backend",
        restart_backend_cmd,
        "Restartet das Flask Backend (-w / --wait, -x / --external)"
    )
    manager.register_command(
        "build-backend",
        lambda: backend.build(),
        "Erstellt __init__.py für core modules (via cli.build)"
    )
