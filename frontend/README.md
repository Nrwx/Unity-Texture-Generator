# frontend

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

# Canvas Environment System 

```
Dieses Dokument beschreibt das Canvas-System bestehend aus:

- `createCanvasEnvironment`
- `canvasEvent`
- `canvasRegister`
- Canvas Model Configuration
- Grid System
- Segment System
- Fullscreen Feature
- Renderer
- Update Flow
- Pause/Resume Steuerung

```

## 1. Übersicht
```
Das System unterstützt:

- mehrere Canvas-Instanzen
- flexibles Grid Layout
- automatische Segment-Generierung
- individuell steuerbare Segmente
- Segment-Updates und Renderer
- Fullscreen je Segment
- globale und lokale Pause/Resume
- eventbasierte Kommunikation zwischen Frontend und Canvas Controller

```

## 2. createCanvasEnvironment
```
`createCanvasEnvironment()` erstellt eine Controller-Instanz.  
Diese verwaltet:

- Canvas Modelle
- Segmente
- RAF-Loops pro Canvas *und* pro Segment
- Fullscreen-Steuerung
- Background Renderer
- Grid und Layoutsystem

### Methoden

### `register(canvasId, config)`
Registriert eine neue Canvas-Instanz.

### `remove(canvasId)`
Löscht eine Canvas-Instanz inkl. Segment-RAF-Loops.

### `destroy()`
Leert alle Modelle (`models.clear()`).

### `update(canvasId, loopFunction, payload)`
Startet oder triggert ein Update.

### `pause(canvasId)`
Pausiert exakt diese Canvas-Instanz.

### `resume(canvasId)`
Hebt die Pause der Instanz wieder auf.

### `pauseAll()`
Stoppt **alle** Canvas Instanzen & Segmente.

### `resumeAll()`
Reaktiviert das gesamte System.

### `setFullscreen(canvasId, segmentId)`
Aktiviert Fullscreen für ein Segment und deaktiviert alle anderen.

### `clearFullscreen(canvasId)`
Stellt das ursprüngliche Grid wieder her.

### `getLayers(canvasId)`
Gibt alle Segmente zurück.

### `addLayer(canvasId, segmentConfig)`
Erstellt ein neues Segment.

### `removeLayer(canvasId, segmentId)`
Entfernt ein Segment.

### `isActive(canvasId)`
Prüft, ob Canvas aktiv ist.

### `count()`
Gibt die Anzahl der Modelle zurück.

```

## 3. Canvas Config Struktur
```
js
{
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,

  rows: number | null,
  columns: number | null,

  fixed: {
    rows: number[] | null,
    columns: number[] | null
  },

  showGrid: boolean,

  background: {
    color: string,
    raster: boolean
  },

  beforeUpdate: function | null,
  afterUpdate: function | null,
  renderer: function | null,

  segments: [ ... ],
  fullscreenSegment: string | null,

  _paused: boolean,
  _rafId: number | null,
  _segmentRaf: Map<string, number>
}
```

## 4. Segment Struktur
```
js
{
  id: string,
  row: number,
  column: number,

  x: number,
  y: number,
  width: number,
  height: number,

  active: boolean,

  data: any,
  update: function | null,
  renderer: function | null,

  _paused: boolean,
  _rafId: number | null
}
```

## 5. canvasEvent
```
Event-Helper der Controller-Funktionen abbildet:

- `canvas:register`
- `canvas:update-request`
- `canvas:pause`
- `canvas:resume`
- `canvas:destroy`
- `canvas:pauseAll`
- `canvas:resumeAll`
- `canvas:fullscreen`
- `canvas:fullscreen-exit`

```

## 6. canvasRegister

```
Frontend-Helper zum Triggern der Events aus Vue (oder anderem Framework).

### Register Modi:

- `register`
- `update`
- `pause`
- `resume`
- `destroy`
- `pauseAll`
- `resumeAll`
- `fullscreen`
- `fullscreenExit`

```

## 7. Fullscreen Logik
```
### Fullscreen aktivieren:
- setzt alle Segmente auf `active = false`
- ein Segment übernimmt `width = canvas.width`, `height = canvas.height`

### Fullscreen verlassen:
- Segment Layouts werden neu berechnet
- Grid wird wiederhergestellt

```

## 8. Grid Modi

### Single Mode
```
- `rows = null`
- `columns = null`
- ein großes Segment
```
### Dynamic Mode
```
- `rows` und `columns` gesetzt
- **keine fixed sizes**
- automatische Aufteilung
```
### Mixed Mode
```
- Kombination aus fixed und dynamic
```
### Full Fixed Mode
```
- komplette manuelle Kontrolle über alle Segmentgrößen
```

## 9. Background Optionen
```
- `color`: Canvas Hintergrund
- `raster`: Schachbrettmuster (Transparenzhilfe)
```

## 10. Update Ablauf
```
1. beforeUpdate Hook
2. Layout berechnen
3. Hintergrund zeichnen
4. Segment Updates
5. Segment Renderer
6. Haupt Renderer
7. afterUpdate Hook
```
