# Material Normalization Cleanup

## Ziel
- Backend normalisiert Material-Payloads und erzeugt das wahrhaftige Package.
- Frontend liest Backend-Packages direkt und normalisiert nicht mehr fuer API-Fallbacks.
- WebGL-/Canvas-Laufzeit darf weiterhin rendernahe Daten vorbereiten, weil das keine API-Schema-Normalisierung ist.

## Ausgangslage
- Backend-Parameterquelle: `backend/config/api/parameter.py`.
- Backend-Normalisierung sitzt in `backend/model/material_model.py` und wird durch `backend/model/render_model.py::material_preview` genutzt.
- Frontend dupliziert Payload-Normalisierung in `frontend/src/dataLayer/route/material.js`.
- MaterialEditor enthaelt viele `normalize*`-Pfadstellen; ein Teil ist UI-/Graph-/Renderer-Laufzeitlogik, ein Teil API-Payload-Fallback.
- `frontend/src/dataLayer/webgl.js` enthaelt lokale Defaults und Renderer-Konstanten. Das bleibt vorsichtig behandelt, weil viele Material-Views daraus UI-Optionen und Runtime-Objekte erzeugen.

## Arbeitsregeln
- Keine breitflaechige Entfernung von WebGL-/Mesh-/UV-/Node-/ParticleSystem-Normalisierung, solange sie fuer Renderer oder Editor-Interaktionen gebraucht wird.
- API-Fallbacks im Frontend abbauen und Backend als Quelle erzwingen.
- Imports nach jeder Aenderung pruefen.
- Frontend nur mit `npm run build` verifizieren.
- Backend muss danach manuell neu gestartet werden.

## Offene Schritte
- Material API Route umbauen: FormData ohne Frontend-Normalisierung, keine doppelten Defaults. **Erledigt:** `frontend/src/dataLayer/route/material.js` nutzt nur noch JSON-Transport und haengt vorhandene Felder an.
- Backend `unpack_material_values` gegen vollstaendiges Package-Schema absichern. **Erledigt:** liest Top-Level, `settings` und `preview` und persistiert `light`, `physics`, Render-Settings und Texture-Lod im Package.
- MaterialEditor-Hydration pruefen: beim vorhandenen Material Package bevorzugen. **Erledigt:** Package-Daten ueberschreiben Layer-Fallbacks in `resolveMaterialEditSource`.
- Build ausfuehren. **Erledigt:** `npm run build` erfolgreich, mit bestehenden Sass-/Bundle-Size-Warnungen.

## Entscheidungen
- Renderer-/Editor-Runtime-Normalisierung in `Node`, `UV`, `Mesh`, `ParticleSystem`, `Volume`, `Fluid` bleibt unangetastet, weil sie Laufzeitdaten fuer Canvas/WebGL erzeugt.
- API-Normalisierung im Frontend wurde entfernt. Backend-Defaults aus `backend/config/api/parameter.py` und `MaterialModel` sind massgeblich.
- `backend/build.json` wurde passend zur Parameterliste erweitert, damit direkte FormData-Keys nicht von der Method-Map abgeschnitten werden.
- Frontend-Hydration behaelt Layer-Fallbacks fuer bestehende/alte Materialien, priorisiert aber das Backend-Package, wenn es vorhanden und ladbar ist.
- `MaterialEditor.normalizeValues` wurde in `buildMaterialDraft` umbenannt. Diese Stelle baut nur noch den Editor-Draft fuer Preview/Submit; Backend-normalisierte Packages bleiben die Wahrheit.
