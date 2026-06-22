# Unity Texture Generator Frontend

Frontend fuer den Unity Texture Generator. Die App ist ein Vue-3/Vuetify-basiertes
Werkzeug zum Erstellen, Bearbeiten, Kombinieren und Exportieren von Texturen,
Layern, Materialien und einfachen Animationen.

Der aktuelle Stand ist benutzbar, aber noch nicht final poliert. Diese README
beschreibt deshalb bewusst den Release-nahen Ist-Zustand statt eine fertige
Produktdokumentation vorzugeben.

## Status

- Produktion-Build funktioniert mit `npm run build`.
- Das Frontend erwartet ein laufendes Backend unter `http://127.0.0.1:5000`.
- Die Backend-Basis-URL liegt zentral in `src/dataLayer/local.js` unter
  `appData.apiBaseUrl`.
- Der Build erzeugt Sass-Deprecation-Warnungen und Webpack-Hinweise zu grossen
  Bundles. Das blockiert den Build nicht, sollte aber vor einem stabilen Release
  bereinigt werden.

## Hauptfunktionen

- Bild-Upload und Layer-basierte Bearbeitung
- Zeichen-, Pinsel-, Radierer-, Text-, Form- und Auswahlwerkzeuge
- Masken, Pfade, Guides, Kontextmenues und Transformationshilfen
- Modifier fuer Resize/Crop, Farbe, Details, Effekte und Distortion
- Channel Mixer und Shader-/Renderer-Anbindung
- Material Editor mit 3D-/Cube-/Mesh-bezogenen Einstellungen
- AI-Bildgenerierung ueber Backend-Routen
- Timeline, Mini-Timeline, Animation und Keyframe-nahe Workflows
- Screenshot-, Export- und MP4-Export-Flows
- Plugin-, Task-, Cache-, Backup- und Benachrichtigungssysteme
- Light/Dark Theme ueber Vuetify

## Tech Stack

- Vue 3
- Vue CLI 5
- Vuetify 3
- Sass
- Axios
- Day.js
- html2canvas
- Material Design Icons

## Projektstruktur

```text
frontend/
  public/                 Statische HTML- und Icon-Dateien
  src/
    App.vue               App-Shell, Fenster, Taskbars und globale Workflows
    main.js               Vue/Vuetify Einstiegspunkt
    assets/               Logos und statische Assets
    components/           Wiederverwendbare UI-Komponenten
    composables/          Vue-Composables
    dataLayer/            API-Client, Events, Routes, State und Settings
    models/               UI-, Tool-, Layer-, Timeline- und Domain-Modelle
    plugins/              Vuetify und Theme-Konfiguration
    utils/                Canvas-, DOM-, Math-, Screenshot- und Helper-Code
    view/                 Seiten, Panels, SCSS und View-Modelle
  dist/                   Generierter Produktions-Build
```

## Voraussetzungen

- Node.js mit npm
- Installierte npm-Abhaengigkeiten
- Laufendes Unity-Texture-Generator-Backend auf `127.0.0.1:5000`

Empfohlen ist die Installation ueber `npm ci`, weil ein `package-lock.json`
vorhanden ist.

## Installation

```bash
npm ci
```

Falls bewusst neue Dependency-Versionen aufgeloest werden sollen:

```bash
npm install
```

## Entwicklung

In `package.json` ist aktuell kein `serve`-Script definiert. Fuer einen lokalen
Vue-CLI-Dev-Server kann der Service direkt gestartet werden:

```bash
npx vue-cli-service serve
```

Das Frontend ruft das Backend unter `http://127.0.0.1:5000` auf. Ohne laufendes
Backend starten Teile der Oberflaeche, datenabhaengige Funktionen wie Upload,
Layer, AI, Renderer, Export, Tasks, Plugins und Settings schlagen dann aber fehl.

Die Backend-URL kann ueber Vue CLI Environment Variablen ueberschrieben werden:

```bash
VUE_APP_API_BASE_URL=http://127.0.0.1:5000
```

## Build

```bash
npm run build
```

Der Build schreibt die auslieferbaren Dateien nach `dist/`.

## Linting

```bash
npm run lint
```

## Release-Hinweise

Vor einem oeffentlichen Release sollten mindestens diese Punkte geprueft werden:

- Backend starten und Frontend gegen `http://127.0.0.1:5000` testen.
- `npm ci` auf einer frischen Umgebung ausfuehren.
- `npm run build` ausfuehren und `dist/` pruefen.
- Upload, Layer-Bearbeitung, Modifier, Material Editor, AI-Flow und Export manuell
  durchklicken.
- Sass-Warnungen zu `@import` und Slash-Division einplanen.
- Bundle-Groesse pruefen; aktuell empfiehlt Webpack Lazy Loading bzw. Code
  Splitting fuer groessere Teile der App.
- Backend-URL fuer Release-Umgebungen ueber `VUE_APP_API_BASE_URL` setzen.

## Bekannte Einschraenkungen

- Kein automatisiertes Test-Setup im Frontend-Repo erkennbar.
- Kein `serve`-Script in `package.json`.
- API-Basis-URL hat als Default `http://127.0.0.1:5000` und wird zentral ueber
  `appData.apiBaseUrl` verwaltet.
- Einzelne aeltere Komponenten verwenden noch direkte Axios-Aufrufe, beziehen
  ihre URLs aber ebenfalls ueber `appData.apiUrl(...)`.
- Die App ist funktionsreich, aber noch in einem unfertigen benutzbaren Zustand.

## Wichtige Dateien

- `src/main.js` initialisiert Vue und Vuetify.
- `src/App.vue` orchestriert Boot-Screen, Viewport, Taskbars, Drawers, Layer,
  Modifier, Material Editor, Notifications und Queue.
- `src/dataLayer/local.js` enthaelt `appData` mit Theme, App-ID und API-Basis-URL.
- `src/dataLayer/api.js` enthaelt den zentralen Axios-Client.
- `src/dataLayer/route/route.js` buendelt die Backend-Routen.
- `src/models/taskbar/config/model.js` definiert die Hauptwerkzeuge in den
  Taskbars.
- `vue.config.js` enthaelt die Vue-CLI-/Vuetify-Konfiguration.
