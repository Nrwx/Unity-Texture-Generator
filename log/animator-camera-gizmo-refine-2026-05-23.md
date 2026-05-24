# Animator Camera/Gizmo Refinement - 2026-05-23

## Ziel
- Camera als eigenstaendige rechte Taskbar-Drawer-Komponente.
- Transformation im Layer-Tab belassen und fuer 2D/3D Layer-Matrix nutzbar machen.
- Gizmo als eigenstaendige Komponente aufbauen.
- Animator-Orbit von normalen UI-Buttons freihalten.
- Grid-Container-Transform im Animator neutralisieren, damit Layer3D im Orbit nicht verschoben wird.

## Umgesetzt
- Neue `Camera` Komponente mit Animator-Kamera, Perspektiven, Frame/Reset und Layer-Kamera-Persistenz.
- Neue `Gizmo` Komponente mit Panel-Modus und Objekt-Achsen im Animator-Viewport.
- Neue gemeinsame Animator-State-Datei fuer Kamera, aktiven Layer, Objekt-Gizmo und Gizmo-Werkzeug.
- `Transformation` Komponente auf Matrix + 3D Material Transform reduziert; Kamera ausgelagert.
- Layer-Drawer zeigt Transformation nun auch ausserhalb des Animator-Modus fuer 2D Layer.
- Animator unterscheidet Layer-Auswahl und Objekt-Gizmo-Auswahl.
- Objekt-Gizmo wird erst nach Objekt-Klick aktiv; Klick in leeren Orbit entfernt die Objekt-Gizmo-Auswahl.
- Grid nutzt im Animator eine neutrale Container-Style-Matrix und deaktiviert Container-Control.
- Material-Preview-Control-Block schaltet im Animator auf Perspektiv-Schnellzugriffe.
- Layer-Update-Payload und Backend-Layer-Update akzeptieren persistente 3D JSON-Felder.

## Verifikation
- `npm run build` im `frontend` Verzeichnis erfolgreich.
- Build meldet 60 bekannte Warnungen zu Sass-Imports, Browserslist und Asset-Groessen.

## Feinschliff 2
- Gizmo-Toolauswahl aus dem Layer-Transformation-Tab entfernt.
- `Gizmo` wird im `Grid` als Animator-Gegenstueck zum `Control` eingeblendet.
- Viewport-Gizmo zeigt je nach Tool nur Translate-, Rotate- oder Scale-Handles.
- Material Transform aus dem Layer-Transform-Tab entfernt; Material/Texture-Werte gehoeren in Shader Nodes.
- Shader-Node-Inputs erhalten bei aktivem Timeline-Record einen kleinen Keyframe-Button.
- Explizite UV-Map-Inputs (`offset_x`, `offset_y`, `rotate`) erhalten ebenfalls Keyframe-Buttons.
- Material-Keyframes werden als `keyframe.material.nodes[nodeId].settings[field]` gespeichert.
- Layer3D wertet Material-Node-Keyframes pro Frame vor Renderer/Particles/Physics aus.
- Export-Pipeline interpoliert dieselben Material-Node-Keyframes fuer gerenderte Frames.
- `python -m py_compile backend/model/export_model.py backend/model/layer_model.py backend/config/api/parameter.py` erfolgreich.
- `npm run build` im `frontend` Verzeichnis erneut erfolgreich nach UV-Map-Keyframe-Buttons.

## Hinweis
- Backend-Dateien wurden angepasst; Backend bitte manuell neu starten.

## Feinschliff 3
- Animator-Viewport: Linksklick hebt die optische Objekt-Gizmo-Auswahl auf und bleibt frei fuer Face/Vertex/Box-Selection.
- Animator-Viewport: Transform-/Scale-/Rotate-Gizmo-Handles reagieren nur noch auf Rechtsklick; Rechtsklick ausserhalb steuert weiter die World-Kamera.
- Ohne aktive Objekt-Gizmo-Auswahl rotiert die Kamera wieder um den World-Pivot `[0, 0, 0]`.
- Objekt-Gizmo zeigt im Orbit-Modus Translate, Rotate und Scale gleichzeitig; Einzelmodi blenden die anderen Handle-Gruppen aus.
- Gizmo-Achsen wurden visuell korrigiert: X horizontal, Y vertikal, Z als klare obere Achse.
- Gizmo-Panel-Styling wurde an Animator/Material-Editor angeglichen.
- UV Map und UV CubeMap verwenden jetzt die normalen Shader-Node-Fields fuer Mode, Offset, Scale und Rotate.
- Material-Keyframe-Buttons stehen inline vor dem jeweiligen Input-Feld.
- Material-Node-Inspector zeigt ein Time-Input-Feld und liest vorhandene Material-Keyframes interpoliert zum aktuellen Timeline-Zeitpunkt.
- Material-Preview bleibt im Animator-Modus auch fuer Shader/UV sichtbar, damit die Canvas-/Orbit-Controls nicht verschwinden.
- `npm run build` im `frontend` Verzeichnis erfolgreich; es bleiben die bekannten 60 Warnungen zu Sass-Imports, Browserslist und Asset-Groessen.

## Feinschliff 4
- Aktuellen Git-Status gelesen und bestehende Zwischenarbeit erhalten.
- Animator und Objekt-Gizmo auf Composable-Mouse-Fluss geprueft; Gizmo-Release leitet Pointer-Events jetzt sauber durch.
- Neue Camera-/Transformation-Modelle nutzen keine direkten `localData`-Imports mehr; App/Drawer reichen Layer-Props weiter.
- Material-Time-Input aus dem Node-Inspector entfernt und einmalig in die unteren Material-Actions gesetzt.
- `/mesh` Backend-Route als CRUD-Adapter fuer Layer `type == 5` angelegt.
- Mesh-CRUD nutzt weiter den bestehenden Shared-Layer-Holder fuer `hidden`, `order`, `opacity`, Matrix und Auswahlkompatibilitaet.
- Frontend-Route `mesh.js` und Event-Schema `mesh:*` ergaenzt.
- `update-layer` delegiert 3D-Layer-Payloads an `mesh:update`; normale Layer gehen weiter ueber `/layer`.
- `delete-layer` trennt gemischte 2D/3D-Auswahl und nutzt fuer 3D-Layer `mesh:delete`.
- Render-Model loest fuer `type == 5` vorhandene Layer-Snapshots, Material-Preview-URLs oder Texture-URLs fuer Preview/Thumbnails auf.
- Animator-Gizmo-Achsen nach DCC-Konvention korrigiert: X horizontal, Z vertikal, Y als Tiefenachse.
- Gizmo-Handle-Erkennung liest das Werkzeug direkt vom angeklickten Handle, damit Orbit-Modus mit sichtbaren Multi-Gizmos bedienbar bleibt.
- `python -m py_compile` fuer Mesh-/Render-/Parameter-Dateien erfolgreich.
- `python -m json.tool backend/build.json` erfolgreich.
- `npm run build` im `frontend` Verzeichnis erfolgreich; es bleiben die bekannten 60 Warnungen zu Sass-Imports, Browserslist und Asset-Groessen.
- Backend-Dateien geaendert; Backend nach Build/Pruefung manuell neu starten.

## Feinschliff 5
- Koordinatensystem recherchiert und auf DCC-/Game-Export-Konventionen abgeglichen.
- Scene-Koordinate festgelegt: `X = rechts`, `Y = Tiefe/Forward`, `Z = oben`.
- WebGL-Renderer bekommt eine zentrale Scene-to-Renderer-Konvertierung, damit internes Y-up Rendering weiter funktioniert, aber Editor/Export Z-up sprechen.
- Geometry-Position, Pivot, Rotation, Scale, Camera, Light-Position und Light-Richtung werden vor WebGL einheitlich von Scene nach Renderer gemappt.
- Animator-Camera/Orbit auf Z-up World-Orbit umgestellt.
- Ohne aktive Objekt-Gizmo-Auswahl bleibt der Orbit auf dem World-Pivot `[0, 0, 0]`; Objekt-Auswahl framed erst nach aktivem Objekt-Gizmo.
- Grid reicht `mainId`, `canvasId` und Container-Matrix an den Animator durch; Animator-Mouse nutzt nun World-Mapping gegen den Grid-Container.
- Gizmo nutzt `eventRegister` statt Dummy-Register und emittiert Second-Level-Events ueber `update:component-event`.
- Objekt-Pivot ist sichtbar, wenn das Objekt-Gizmo aktiv ist und der Pivot-Modus auf `Object` steht.
- `npm run build` im `frontend` Verzeichnis erfolgreich; bekannte 60 Sass-/Browserslist-/Asset-Warnungen bleiben.
