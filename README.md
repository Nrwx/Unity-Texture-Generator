# Unity Texture Generator

Unity Texture Generator ist eine lokale Web-App zum Erstellen, Bearbeiten,
Kombinieren und Exportieren von Texturen, Layern, Materialien und einfachen
Animationen. Das Projekt besteht aus einem Python/Flask-Backend und einem
Vue-3/Vuetify-Frontend.

## Absoluter Warnhinweis

Diese App ist nicht fertig und nicht als stabile Produktionssoftware zu
verstehen. Der aktuelle Stand kann lokal gestartet, gebaut und getestet werden,
enthaelt aber bekannte Einschraenkungen, Entwicklungsdefaults und
plattformabhaengige Abhaengigkeiten.

Vor einem oeffentlichen Release muessen mindestens Backend-Konfiguration,
Secrets, portable Python-Abhaengigkeiten, native Runtime-Pakete, Frontend-Build,
Export-Flows und die kompletten Editor-Workflows geprueft werden. Nicht blind in
produktiven Umgebungen betreiben.

## Projektstruktur

```text
Unity-Texture-Generator/
  backend/      Python/Flask API, Runtime-Generator, Assets und CLI
  frontend/     Vue/Vuetify Editor-Oberflaeche
  LICENSE       MIT License
  README.md     Diese Einstiegsdokumentation
```

Weitere Dokumentation:

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Backend CLI README](backend/cli/README.md)
- [License](LICENSE)

## Status

- App: nicht fertig, aber in Teilen lokal benutzbar.
- Backend: startet lokal als Flask-App und dient als API fuer Editor, Assets,
  Rendering, Exporte, Tasks, Plugins und AI-Routen.
- Frontend: baut mit `npm run build` und erwartet standardmaessig ein Backend
  unter `http://127.0.0.1:5000`.
- Release: noch nicht final. Siehe bekannte Hinweise in
  [backend/README.md](backend/README.md) und [frontend/README.md](frontend/README.md).

## Voraussetzungen

Allgemein:

- Git
- Python 3 mit `venv` und `pip`
- Node.js mit npm
- Ausreichend Speicherplatz fuer Python-, Node- und optionale GPU/AI-Pakete

Windows:

- PowerShell
- GTK+ 3 Runtime fuer Cairo/SVG/PDF-bezogene Funktionen
- Visual C++ Redistributable x86/x64, falls Intel GPU Pakete genutzt werden
- NVIDIA Texture Tools, falls DDS/NV-Kompression genutzt wird

Linux:

```bash
sudo apt install libcairo2
```

macOS:

```bash
brew install cairo
```

Conda/Anaconda-Umgebungen:

```bash
conda install -c conda-forge cairo pango gdk-pixbuf libxml2 libffi
```

Optionale Intel GPU Pakete:

```bash
pip install -i https://software.repos.intel.com/python/pypi dpctl dpnp
```

## Setup Reihenfolge

1. Backend-Abhaengigkeiten installieren.
2. Frontend-Abhaengigkeiten installieren.
3. Frontend bauen.
4. Backend starten.
5. App im Browser unter `http://localhost:5000` oder `http://127.0.0.1:5000`
   pruefen.

## Backend Setup

Windows PowerShell:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

Linux/macOS:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

Das Backend startet standardmaessig auf:

```text
http://localhost:5000
```

Alternativ kann die interaktive Backend-CLI verwendet werden:

```powershell
cd backend
.\venv\Scripts\activate
python cli.py
```

Wichtige CLI-Kommandos:

- `doctor` prueft Release- und Laufzeitrisiken.
- `doctor --strict` behandelt Warnungen als Fehlerstatus.
- `start`, `stop` und `restart` steuern den Backend-Prozess.

## Frontend Setup

```bash
cd frontend
npm ci
npm run build
```

Der Build schreibt die auslieferbaren Dateien nach:

```text
frontend/dist/
```

Das Backend dient anschliessend die gebaute App aus
`../frontend/dist/index.html` aus. Fuer lokale Frontend-Entwicklung kann der
Vue-CLI-Service direkt gestartet werden:

```bash
cd frontend
npx vue-cli-service serve
```

Hinweis: In `frontend/package.json` ist aktuell kein `serve`-Script definiert.
Das Frontend nutzt als Default-API:

```text
http://127.0.0.1:5000
```

Bei Bedarf kann die Backend-URL fuer Vue CLI gesetzt werden:

```bash
VUE_APP_API_BASE_URL=http://127.0.0.1:5000
```

## Entwicklung Und Build

Backend direkt starten:

```bash
cd backend
python app.py
```

Frontend Produktionsbuild:

```bash
cd frontend
npm run build
```

Frontend Lint:

```bash
cd frontend
npm run lint
```

Vor einem Release sollten mindestens diese Checks laufen:

- `python cli.py` und danach `doctor`
- `npm ci`
- `npm run build`
- Start des Backends mit `python app.py`
- Manueller Test von Upload, Layer-Bearbeitung, Modifiern, Material Editor,
  AI-Flow, Rendering und Export

## Wichtige Hinweise

- `backend/generated/` wird beim Start erzeugt und sollte nicht manuell als
  primaere Quelle bearbeitet werden.
- `backend/public/`, `backend/venv/`, `__pycache__/` und lokale Logs sind
  Runtime-Artefakte.
- `backend/requirements.txt` kann lokale `file:///C:/...` Referenzen enthalten.
  Fuer eine portable Release-Installation muss die Abhaengigkeitsliste bereinigt
  und in einer frischen Umgebung getestet werden.
- Development-Secrets wie `SECRET_KEY` muessen vor einem Release ersetzt werden.
- Das Frontend erzeugt aktuell Sass-Deprecation-Warnungen und Hinweise zu
  grossen Bundles; sie blockieren den Build nicht, sollten aber eingeplant
  werden.

## License

Dieses Projekt steht unter der MIT License. Details stehen in [LICENSE](LICENSE).
