# Unity Texture Generator Frontend

Frontend for the Unity Texture Generator. The app is a Vue 3/Vuetify-based tool for creating, editing, combining, and exporting textures, layers, materials, and simple animations.

The current state is usable, but not finally polished yet. This README therefore intentionally describes the near-release current state instead of presenting finished product documentation.

Current frontend version: 1.0.0
## Status

* The production build works with `npm run build`.
* The frontend expects a running backend at `http://127.0.0.1:5000`.
* The backend base URL is defined centrally in `src/dataLayer/local.js` under `appData.apiBaseUrl`.
* The build produces Sass deprecation warnings and Webpack notices about large bundles. These do not block the build, but should be cleaned up before a stable release.

## Main Features

* Image upload and layer-based editing
* Drawing, brush, eraser, text, shape, and selection tools
* Masks, paths, guides, context menus, and transformation helpers
* Modifiers for resize/crop, color, details, effects, and distortion
* Channel mixer and shader/renderer integration
* Material editor with 3D, cube, and mesh-related settings
* AI image generation through backend routes
* Timeline, mini timeline, animation, and keyframe-related workflows
* Screenshot, export, and MP4 export flows
* Plugin, task, cache, backup, and notification systems
* Light/dark theme through Vuetify

## Tech Stack

* Vue 3
* Vue CLI 5
* Vuetify 3
* Sass
* Axios
* Day.js
* html2canvas
* Material Design Icons

## Project Structure

```text
frontend/
  public/                 Static HTML and icon files
  src/
    App.vue               App shell, windows, taskbars, and global workflows
    main.js               Vue/Vuetify entry point
    assets/               Logos and static assets
    components/           Reusable UI components
    composables/          Vue composables
    dataLayer/            API client, events, routes, state, and settings
    models/               UI, tool, layer, timeline, and domain models
    plugins/              Vuetify and theme configuration
    utils/                Canvas, DOM, math, screenshot, and helper code
    view/                 Pages, panels, SCSS, and view models
  dist/                   Generated production build
```

## Requirements

* Node.js with npm
* Installed npm dependencies
* Running Unity Texture Generator backend on `127.0.0.1:5000`

Installation via `npm ci` is recommended because a `package-lock.json` is present.

## Installation

```bash
npm ci
```

If new dependency versions should intentionally be resolved:

```bash
npm install
```

## Development

There is currently no `serve` script defined in `package.json`. For a local Vue CLI development server, the service can be started directly:

```bash
npx vue-cli-service serve
```

The frontend calls the backend at `http://127.0.0.1:5000`. Without a running backend, parts of the interface may start, but data-dependent functions such as upload, layers, AI, renderer, export, tasks, plugins, and settings will fail.

The backend URL can be overridden through Vue CLI environment variables:

```bash
VUE_APP_API_BASE_URL=http://127.0.0.1:5000
```

## Build

```bash
npm run build
```

The build writes the distributable files to `dist/`.

## Linting

```bash
npm run lint
```

## Release Notes

Before a public release, at least the following points should be checked:

* Start the backend and test the frontend against `http://127.0.0.1:5000`.
* Run `npm ci` in a fresh environment.
* Run `npm run build` and check `dist/`.
* Manually test upload, layer editing, modifiers, material editor, AI flow, and export.
* Account for Sass warnings related to `@import` and slash division.
* Check bundle size; Webpack currently recommends lazy loading or code splitting for larger parts of the app.
* Set the backend URL for release environments through `VUE_APP_API_BASE_URL`.

## Known Limitations

* No automated test setup is currently recognizable in the frontend repository.
* No `serve` script in `package.json`.
* The API base URL defaults to `http://127.0.0.1:5000` and is managed centrally through `appData.apiBaseUrl`.
* Some older components still use direct Axios calls, but their URLs are also derived through `appData.apiUrl(...)`.
* The app is feature-rich, but still in an unfinished usable state.

## Important Files

* `src/main.js` initializes Vue and Vuetify.
* `src/App.vue` orchestrates the boot screen, viewport, taskbars, drawers, layers, modifiers, material editor, notifications, and queue.
* `src/dataLayer/local.js` contains `appData` with theme, app ID, and API base URL.
* `src/dataLayer/api.js` contains the central Axios client.
* `src/dataLayer/route/route.js` bundles the backend routes.
* `src/models/taskbar/config/model.js` defines the main tools in the taskbars.
* `vue.config.js` contains the Vue CLI/Vuetify configuration.
