import { ref } from 'vue';

export const pathLayer = ref({
    name: 'Form',        // Anzeigename
    closed: false,
    edit: true,          // true, wenn der Pfad bearbeitet wurde

    width: 0,            // Path Points[connections], Breite
    height: 0,           // Path Points[connections], Höhe

    // Koordinaten-Daten
    points: [],          // [{ x: number, y: number, linear: boolean, bezier?: { cp1?, cp2? } }, ...]
    connections: [],     // [[idxA, idxB], ...] – Indizes in `points`

    // Style-Attribute für Stroke/Fill
    stroke: '#000000',   // Pfad-Kontur-Farbe
    strokeWidth: 1,    // Stärke der Kontur
    strokeDash: 0,     // Kontur Abstände
    strokeDashArray: [], // Kontur Abstände Array
    strokeDashType: '',  // Kontur Type
    fill: '#ffffff',     // Füllfarbe (wenn geschlossen)
    fillOpacity: 1,      // Füll-Transparenz
    gradient: {
        type: 'linear',
        angle: 90,
        stops: [],
    }
});