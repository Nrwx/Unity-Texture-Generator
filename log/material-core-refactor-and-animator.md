# Material Core Refactor + Animator Integration

Datum: 2026-05-24

## Analyse

- Reset-Zustand ist sauber.
- Animator ist relevant: `frontend/src/view/page/Material/Animator/Animator.vue` nutzt `frontend/src/view/models/page/material/animator/model.js`.
- Das Animator-Model enthaelt eigene Vektor-/Orbit-/Kameralogik (`normalizeVector3`, `add3`, `sub3`, `mul3`, `cross3`, `cameraVectorsFromSpherical`) und dupliziert damit `Vector`, `Camera` und `Orbit`.
- Die alten Engine-Klassen sind noch nicht projektfertig:
  - `Event` referenziert `EventLayer`, obwohl `Layer` importiert wird.
  - `Event` schreibt Debug-Ausgaben und verwirft Pointer bei `clientX === 0`.
  - `Collision/Layer/Layer.js` greift direkt auf `e._state.world` zu und kann ohne `_state` brechen.
  - `Accumulator` enthaelt alte Kommentare/Mojibake und gibt bei Mutationen kein `this` zurueck.
  - `Camera`/`Orbit` decken den Animator fachlich ab, brauchen aber stabilere Payload-/Setting-Kompatibilitaet fuer `orthographicScale`, min/max, Input-Geschwindigkeit und `backgroundGrid`.

## Ziel

1. Core-Klassen erst projektkompatibel refaktorisieren.
2. Animator an diese Klassen anbinden.
3. Danach erst Layer3D/WebGL sinnvoll und vorsichtig integrieren.

## Aenderungen

- `Accumulator` wurde auf eine kleine projektkompatible Runtime-Clock reduziert: numerische Normalisierung, fluent `update`/`reset`/`setSpeed`, `toPayload`.
- `Event` wurde von Engine-Resten befreit:
  - `EventLayer`-Referenz durch die vorhandene `Layer`-Klasse ersetzt.
  - Debug-Logging entfernt.
  - Pointer bei `clientX === 0` werden akzeptiert.
  - `event.path`/`event.consumed` werden sauber initialisiert.
  - `destroy()` entfernt registrierte Listener.
- `Event/Layer` initialisiert fehlende Event-Pfade defensiv und nutzt den korrekten Fehlernamen.
- `Collision/Layer` ist robuster gegen fehlende `_state`-Daten und nutzt einen 3D-Default statt Engine-spezifische Annahmen.
- `CollisionSystem` wurde neu gefasst: gleiche Grundfunktionen (`step`, `raycast`, Trigger, AABB/Sphere/Plane-Aufloesung), aber ohne alte Engine-Kommentare und mit defensiven Entity-/Physics-Zugriffen.
- `Camera` wurde fuer Projekt-/Animator-Payloads erweitert:
  - `orthographicScale` min/max.
  - snake_case/camelCase Payload-Kompatibilitaet.
  - Orbit-State aus Payloads wird nicht mehr durch die Default-Position ueberschrieben.
- `Orbit` wurde um `setOptions()` und `setState()` erweitert und gibt mehr Renderer-/Animator-Settings in `toPayload()` aus.
- `Animator` nutzt jetzt `Camera`, `Orbit`, `Vector` und `Accumulator` statt eigener Vektor-/Spherical-Camera-Helfer. Die bestehende Vue-/`eventRegister`-/`useMouse`-Integration bleibt erhalten.
- `Layer3D` nutzt `Accumulator` fuer den WebGL-Frame-Delta im Partikelpfad.
- `webglMaterialRenderer` nutzt `Camera` fuer View/Projection/ViewProjection und `Matrix`/`Quaternion` fuer die Model-Matrix.
- Hotfix nach Laufzeitmeldung: `Vector` kopiert bestehende `Vector`-Instanzen jetzt ohne Rekursion. `new Vector(existingVector)`, `Vector.from(existingVector)`, `clone()` und `copy(existingVector)` wurden gegen den `Maximum call stack size exceeded`-Pfad abgesichert.
- Layer3D-Kamera-Follow-up: Die normale Mesh-WebGL-Preview nutzt wieder die Standardkamera-Perspektive. Eingebettete `viewport_camera`-Payloads werden nur noch im Animator-Kontext (`animator_viewport`) verwendet, damit gespeicherte Runtime-Kamera-Daten die normale Layer3D-Ansicht nicht ueberschreiben.
- Animator-Orbit-Follow-up: Der Settings-Watcher reagiert nur noch auf echte Camera-/Orbit-Settings. Mesh-/Layer-Rotationen setzen die freie Animator-Kamera dadurch nicht mehr zurueck.
- Animator-Reparatur-Follow-up: WebGL nutzt fuer Animator-Kameras wieder den direkten freien Kamera-Pfad (`position`/`target`/`up`) statt die Payload im Renderer erneut als Orbit zu rekonstruieren. Layer3D beobachtet laufende Animator-`viewport_camera`-Aenderungen separat und haelt den Kamera-Renderloop aktiv.
- Mesh-Rotation-Follow-up: Die Z-Rotation im WebGL-Model-Matrix-Pfad wurde an die alte Renderer-Konvention angepasst, damit Mesh-Pan/-Pen-Richtungen nicht gespiegelt wirken.

## Build

- `npm run build` wurde in `frontend` ausgefuehrt und ist erfolgreich durchgelaufen.
- Ergebnis: Vue production build abgeschlossen, `dist` wurde erzeugt.
- Verbleibende Warnungen: 57 bekannte Build-Warnungen aus Sass-Deprecations (`@import`, Slash-Division), veralteten Browserslist/caniuse-lite-Daten und Webpack-Asset-/Entrypoint-Groessen. Keine neue Compile-Fehlermeldung aus den refaktorisierten Core-/Animator-/Layer3D-Dateien.
- Nach dem `Vector`-Hotfix wurde `npm run build` erneut erfolgreich ausgefuehrt. Zusaetzlich wurde der Vector-Kopierpfad per Node-Probe geprueft.
- Nach dem Layer3D-/Animator-Kamera-Follow-up wurde `npm run build` erneut erfolgreich ausgefuehrt. Verbleibende Warnungen bleiben unveraendert im bekannten Sass-/Browserslist-/Bundle-Size-Bereich.
- Nach der Animator-Reparatur wurde `npm run build` erneut erfolgreich ausgefuehrt. Verbleibende Warnungen bleiben unveraendert im bekannten Sass-/Browserslist-/Bundle-Size-Bereich.
