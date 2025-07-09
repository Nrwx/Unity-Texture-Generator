import { ref } from 'vue';

export const pathLayer = ref({
    id: '',              // Eindeutige Kennung, z.B. layer_<timestamp>
    name: 'Form',        // Anzeigename
    type: 2,             // 1 = Text, 2 = Pfad
    order: 0,            // Z-Index/Reihenfolge
    hidden: 0,           // 0 = sichtbar, 1 = ausgeblendet
    closed: false,       // true, wenn der Pfad geschlossen wurde

    // Koordinaten-Daten
    points: [],          // [{ x: number, y: number, linear: boolean, bezier?: { cp1?, cp2? } }, ...]
    connections: [],     // [[idxA, idxB], ...] – Indizes in `points`

    // Style-Attribute für Stroke/Fill
    stroke: '#000000',   // Pfad-Kontur-Farbe
    strokeWidth: 1.5,    // Stärke der Kontur
    fill: '#ffffff',     // Füllfarbe (wenn geschlossen)
    fillOpacity: 1,      // Füll-Transparenz

    opacity: 1,          // Gesamte Transparenz
    mask: null,          // ggf. Masken-Referenz

    // Interne Initialwerte (falls du sie brauchst)
    initPoints: [],      // Kopie des ursprünglichen Punkt-Arrays
});