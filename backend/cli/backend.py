def register_backend_commands(manager, backend):
    def start_backend_cmd(*args):
        wait = any(a in ("-w", "--wait") for a in args)
        external = any(a in ("-x", "--external") for a in args)
        backend.start(wait=wait, external=external)
        return 0

    def restart_backend_cmd(*args):
        wait = any(a in ("-w", "--wait") for a in args)
        external = any(a in ("-x", "--external") for a in args)
        backend.restart(wait=wait, external=external)
        return 0

    def stop_backend_cmd(*args):
        backend.stop()
        return 0

    manager.register_command(
        "start",
        start_backend_cmd,
        "Start the Flask backend (-w/--wait, -x/--external)"
    )
    manager.register_command(
        "start-backend",
        start_backend_cmd,
        "Alias for start"
    )
    manager.register_command(
        "stop",
        stop_backend_cmd,
        "Stop the Flask backend"
    )
    manager.register_command(
        "stop-backend",
        stop_backend_cmd,
        "Alias for stop"
    )
    manager.register_command(
        "restart",
        restart_backend_cmd,
        "Restart the Flask backend (-w/--wait, -x/--external)"
    )
    manager.register_command(
        "restart-backend",
        restart_backend_cmd,
        "Alias for restart"
    )
