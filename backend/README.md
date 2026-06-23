# Unity Texture Generator - Backend

Python/Flask backend for the Unity Texture Generator app. The backend serves the built frontend, generates runtime controller/view/model modules, manages texture-processing assets, and exposes the API routes used by the editor.

Current backend version: `1.0.0`

## Contents

- [Purpose](#purpose)
- [Runtime Flow](#runtime-flow)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Start](#start)
- [Configuration](#configuration)
- [API Routes](#api-routes)
- [Assets And Runtime Data](#assets-and-runtime-data)
- [Release Checklist](#release-checklist)
- [Known Release Notes](#known-release-notes)

## Purpose

The backend is responsible for:

- serving the frontend build from `../frontend/dist/index.html`
- registering Flask blueprints from `build.json`
- generating the runtime `generated/` package from `view/`, `controller/`, and `model/`
- processing uploads, layers, channels, modifiers, render previews, exports, shaders, fonts, brushes, paths, meshes, materials, plugins, tasks, and backups
- managing app startup, boot tasks, local paths, drivers, GPU detection, and package setup
- synchronizing configured Python libraries through the internal `LibraryManager`

## Runtime Flow

1. `app.py` loads `build.json`.
2. `_integrity_check()` initializes `Config` and `LibraryManager`.
3. Flask is created and passed into `Core`.
4. `Core` creates the secure store, registry, system link, task manager, bootloader, parser, API injector, generator, and router.
5. `Boot` runs the configured startup tasks.
6. `Generate` writes `generated/view`, `generated/controller`, and `generated/model` from the source modules.
7. `Router` imports the generated modules and registers all configured Flask blueprints.
8. `APP.before_request` forwards supported requests through the queue controller, except the `/queue` endpoint itself.

## Project Structure

```text
backend/
|-- app.py                  # Flask entrypoint and request queue interception
|-- cli.py                  # Interactive backend CLI entrypoint
|-- build.json              # Main backend config: mode, CLI log, routes, modules, dependencies
|-- requirements.txt        # Current environment freeze
|-- version.txt             # Backend version
|-- library_report.json     # LibraryManager sync report
|-- assets/                 # Bundled brushes, fonts, paths, shaders, drivers, plugins
|-- cli/                    # CLI command registration and backend process helpers
|-- components/             # Texture maps, modifiers, animation and simulation helpers
|-- config/                 # App constants and configuration data
|-- controller/             # Source controllers
|-- core/                   # Core boot, routing, generation, config, task and registry system
|-- generated/              # Runtime-generated package, ignored by git
|-- model/                  # Source models
|-- public/                 # Runtime/public output data, ignored by git
|-- utils/                  # API and RGBA utility helpers
`-- view/                   # Source Flask blueprint templates/views
```

### Important Source Areas

| Path | Role |
| --- | --- |
| `app.py` | Main application bootstrap and Flask server start. |
| `core/main.py` | Central container for boot, registry, generator, router, parser and API injection. |
| `core/generate/main.py` | Builds the ignored `generated/` runtime package from source modules. |
| `core/router/main.py` | Imports generated modules and registers blueprints from `build.json`. |
| `core/library/main.py` | Synchronizes configured dependencies and writes `library_report.json`. |
| `core/boot/tasks/` | Startup tasks for system checks, GPU/driver detection, storage, plugins and paths. |
| `controller/`, `model/`, `view/` | Editable source modules used by the generator. |
| `components/maps/` | Texture map generators such as diffuse, normal, bump, alpha, DDS, PDF, SVG and thumbnails. |
| `components/modifiers/` | Image modifier pipeline such as blur, crop, resize, invert, noise, pixelate, wave and tiling. |
| `assets/` | Bundled release assets: brushes, fonts, paths, shaders, driver installers and plugin archives. |

## Setup

Use a virtual environment for release builds.

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Linux/macOS:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Native Packages

Some exports and SVG/PDF operations need Cairo/GTK-related runtime libraries.

Windows:

- GTK+ 3 Runtime
- Visual C++ Redistributable x86/x64 when Intel GPU packages are used
- NVIDIA Texture Tools when DDS/NV compression is used

Linux:

```bash
sudo apt install libcairo2
```

macOS:

```bash
brew install cairo
```

Anaconda/conda environments:

```bash
conda install -c conda-forge cairo pango gdk-pixbuf libxml2 libffi
```

Intel GPU support:

```bash
pip install -i https://software.repos.intel.com/python/pypi dpctl dpnp
```

## Start

Direct Flask start:

```powershell
cd backend
.\venv\Scripts\activate
python app.py
```

Default development server:

```text
http://127.0.0.1:5000
```

Optional runtime environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `FLASK_HOST` | `127.0.0.1` | Local bind host. Use `0.0.0.0` only when external access is intended. |
| `FLASK_PORT` | `5000` | Local Flask port. |
| `FLASK_DEBUG` | `false` | Enables Flask debug mode only when explicitly set to `1`, `true`, `yes`, or `on`. |

Use `backend/.env.example` as the template for local runtime configuration.
The real `backend/.env` file is ignored by git and should contain local secrets
only on the developer machine.

Interactive CLI:

```powershell
python cli.py
```

Useful CLI commands:

| Command | Description |
| --- | --- |
| `help` | Shows CLI commands and terminal behavior. |
| `pwd` / `cd` / `ls` | Basic terminal navigation. |
| `start` | Starts Flask in the background. |
| `start --wait` | Starts Flask and waits in the CLI. |
| `start --external` | Starts Flask in an external terminal. |
| `restart` | Restarts the backend process. |
| `stop` | Requests backend stop; Flask may still need Ctrl+C. |
| `doctor` | Runs release checks for config, requirements, secrets, routes and runtime files. |
| `doctor --strict` | Returns a non-zero status when warnings are present. |
| any shell command | Unknown commands are passed through to the host shell. |

## Configuration

### `build.json`

Main release configuration. Important fields:

| Field | Description |
| --- | --- |
| `project_name` | Backend project identifier. |
| `auto_sequence` | Optional CLI sequence. Empty by default. |
| `flask_mode` | Flask/CLI mode. Use `development` for the local server and `production` for external hosting. |
| `log_file` | CLI log file, default `cli.log`. |
| `plugin_path` | Base path used for plugin discovery. |
| `secure` | Secure storage and optional keyring settings. |
| `dependencies` | LibraryManager policy and managed library versions. |
| `modules` | Package generation rules for core modules. |
| `router` | Blueprint, route, controller, model and method-map definitions. |

`config.json` is no longer required. The CLI reads `flask_mode`, `log_file`,
and `auto_sequence` from `build.json`. Flask secrets should be supplied through
environment-specific configuration such as `SECRET_KEY`.

### Frontend Serving

The backend serves:

```text
../frontend/dist/index.html
```

Build the frontend before release so this path exists.

## API Routes

Routes are configured in `build.json` and registered as Flask blueprints at startup.

| Blueprint | Prefix | Methods | Actions |
| --- | --- | --- | --- |
| `app` | `/` | `GET` | frontend index, static files, downloads |
| `ai` | `/ai/generateImage/` | `POST` | `prompt_img` |
| `local_ai` | `/local-ai/generateImage/` | `POST` | `prompt_img` |
| `backup` | `/backup` | `GET`, `POST` | `create`, `jump` |
| `brush` | `/brush` | `GET`, `POST` | `upload`, `delete` |
| `channel` | `/channel` | `POST` | `fetch`, `setting`, `toggle` |
| `cursor` | `/cursor` | `POST` | `create` |
| `export` | `/export` | `POST` | `update`, `start-mp4`, `append-mp4-frame`, `finish-mp4` |
| `fonts` | `/fonts` | `GET`, `POST` | `upload`, `update`, `delete` |
| `layer` | `/layer` | `GET`, `POST` | `add`, `addText`, `updateText`, `addPath`, `update`, `delete`, `group`, `order`, `hide`, `blend`, `paste`, `mask`, `masked` |
| `material` | `/material` | `GET`, `POST` | `create-cube`, `update`, `export-blender` |
| `mesh` | `/mesh` | `GET`, `POST` | `create`, `fetch`, `update`, `delete` |
| `modifier` | `/modifier` | `POST` | `color`, `details`, `effects`, `distort`, `fill`, `resize` |
| `path` | `/path` | `GET`, `POST` | `add`, `update`, `delete` |
| `plugin` | `/plugin` | `GET`, `POST` | `fetch`, `scan`, `install`, `installAll`, `pause`, `repair`, `status`, `update` |
| `queue` | `/queue` | `GET` | queue status |
| `render` | `/renderer` | `POST` | `preview`, `color-preview`, `details-preview`, `effects-preview`, `distort-preview`, `material-preview`, `thumbnail`, `text-path`, `base64`, `blob` |
| `settings` | `/settings` | `GET`, `POST` | `update`, `clear` |
| `shader` | `/shader` | `GET`, `POST` | `upload`, `update`, `delete` |
| `task` | `/task` | `GET`, `POST` | `create`, `update`, `delete`, `run`, `schedule`, `stop` |
| `tile` | `/tile` | `POST` | `generate` |
| `upload` | `/upload` | `POST` | image upload and map generation |
| `viewport` | `/viewport` | `GET`, `POST` | `set` |

## Assets And Runtime Data

Bundled assets:

| Path | Contents |
| --- | --- |
| `assets/brush/` | Brush packages. |
| `assets/font/` | Font packages. |
| `assets/path/` | Shape/path packages. |
| `assets/shader/` | Shader packages. |
| `assets/plugin/` | Plugin archives. |
| `assets/driver/` | Platform driver/tool archives. |
| `assets/wave/` | Wave texture asset. |

Runtime/generated folders:

| Path | Release handling |
| --- | --- |
| `generated/` | Generated on backend startup; ignored by git. |
| `public/` | Runtime output/public files; ignored by git. |
| `__pycache__/` | Python cache; ignored by git. |
| `venv/` | Local virtual environment; ignored by git. |
| `cli.log` | Runtime log; do not ship as release metadata unless needed for debugging. |
| `library_report.json` | Dependency sync report; useful for diagnostics. |

## Release Checklist

Before publishing a release:

- Build the frontend so `../frontend/dist/index.html` exists.
- Verify `version.txt` contains the intended release version.
- Review `build.json` for release values, especially `flask_mode`, `log_file`, `secure`, `plugin_path`, and `dependencies`.
- Supply secrets such as `SECRET_KEY` through environment-specific configuration.
- Start the backend with `python app.py` and confirm `http://127.0.0.1:5000` serves the app.
- Check `/queue` after startup to confirm the queue route is registered.
- Run the main editor flows: upload, layer edit, render preview, export, shader/font/brush loading, and material creation.
- Confirm native runtime requirements are installed on the target OS.
- Run `python cli.py` and then `doctor` before packaging.
- Remove or ignore local runtime files: `cli.log`, `__pycache__/`, `generated/`, `public/`, and `venv/`.
- Check that release assets in `assets/` are present and readable.

## Known Release Notes

- `requirements.txt` currently looks like a full local environment freeze and contains many `file:///C:/...` package references. That can break installation on other machines. For a portable release, create a clean requirements file from only the packages listed under `build.json -> dependencies -> libraries`.
- `generated/` is ignored and recreated at runtime. Edit source files in `view/`, `controller/`, and `model/`, not the generated copies.
- The backend defaults to development mode in the current configuration.
- `app.py` keeps Flask debug mode disabled by default. Set `FLASK_DEBUG=true` only for trusted local debugging.
- The frontend path is relative: `../frontend/dist/index.html`.
- Some modules depend on platform-specific GPU, Cairo, GTK, NVIDIA Texture Tools or Intel packages.

## Minimal Portable Requirements Draft

The managed dependency list in `build.json` currently contains:

```text
accelerate==1.13.0
cairosvg==2.8.2
chardet==5.2.0
cryptography==46.0.3
diffusers==0.38.0
dpnp==0.18.1
fastapi==0.138.0
flask==3.0.3
flask-cors==6.0.1
fonttools==4.63.0
keyring==25.7.0
matplotlib==3.10.0
nvidia-ml-py==13.580.82
openai==1.97.0
opencv-python==4.10.0.84
pandas==2.3.3
pillow==12.2.0
psutil==7.1.0
pydantic-settings==2.5.2
python-dotenv==1.1.1
reportlab==4.4.3
requests==2.32.5
safetensors==0.8.0rc0
scipy==1.15.2
starlette==1.3.1
svgwrite==1.4.3
torch==2.7.1+cu118
torchaudio==2.7.1+cu118
torchvision==0.22.1+cu118
transformers==5.8.0
tzlocal==5.3.1
uvicorn==0.32.0
```

Use this as the basis for a portable release requirements file after testing the full app flow in a clean environment.
