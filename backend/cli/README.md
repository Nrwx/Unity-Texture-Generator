# Backend CLI

## CLI setup
```
backend/
├── cli.py
├── app.py
├── config.json
├── version.txt
├── patch.txt
└── cli/
    ├── __init__.py
    ├── console.py
    ├── logger.py
    ├── flask_config.py
    ├── backend_app.py
    ├── config_loader.py
    ├── cli_manager.py
    ├── backend.py
    ├── config.py
    ├── doctor.py
    └── version.py
```

## Commands

| Command | Description |
| --- | --- |
| `doctor` | Runs backend release checks. |
| `doctor --strict` | Treats warnings as non-zero status. |
| `start` / `stop` / `restart` | Controls the backend server. |
| `cd`, `pwd`, `ls`, `history` | Built-in terminal helpers. |
