# Backend CLI

## CLI Setup

```text
backend/
|-- cli.py
|-- app.py
|-- build.json
|-- version.txt
|-- patch.txt
`-- cli/
    |-- __init__.py
    |-- console.py
    |-- logger.py
    |-- flask_config.py
    |-- backend_app.py
    |-- config_loader.py
    |-- cli_manager.py
    |-- backend.py
    |-- config.py
    |-- doctor.py
    `-- version.py
```

Runtime CLI values are read from `build.json`:

- `flask_mode`
- `log_file`
- `auto_sequence`

## Commands

| Command | Description |
| --- | --- |
| `doctor` | Runs backend release checks. |
| `doctor --strict` | Treats warnings as non-zero status. |
| `start` / `stop` / `restart` | Controls the backend server. |
| `config` | Edits CLI runtime values in `build.json`. |
| `cd`, `pwd`, `ls`, `history` | Built-in terminal helpers. |
