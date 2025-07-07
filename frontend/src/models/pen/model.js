import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { eventRegister } from "@/dataLayer/event";

export function penModel(props, emit) {
    const canvas = ref(null);
    const ctx = ref(null);

    // Punkte und Verbindungen zwischen ihnen
    const points = reactive([]);
    const connections = reactive([]);

    // Menü für Ankerpunkte (Bezier-Kontrollpunkte)
    const anchorMenu = reactive({
        visible: false,
        points: [],
        midPoint: null,
        selectedAnchor: null,
        anchorArms: { cp1: null, cp2: null },
    });

    // Variablen für Dragging-Zustände
    let draggedAnchor = null;
    let draggingNewPoint = false;
    let draggedPointIdx = null;
    let draggedControlPoint = null;
    let previousMid = null;
    let cpOffsets = null;

    const emitEvent = (event, payload) => emit('update:component-event', event, payload);
    const { register } = eventRegister('listener:pen', emitEvent);

    // Helfer: Mausposition relativ zum Canvas
    const getMousePos = (e) => {
        const rect = canvas.value.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const isCtrlPressed = (e) => e.ctrlKey || e.metaKey;

    // 1. Laden des Anchor-Menus für die aktuell selektierte Verbindung
    const loadAnchorMenuFromSelection = () => {
        const selectedIdx = points.findIndex(p => p.selected);
        if (selectedIdx === -1) {
            anchorMenu.visible = false;
            return;
        }

        // Wir nehmen die erste Verbindung, die den selektierten Punkt enthält
        const connected = connections.find(([a, b]) =>
            a === selectedIdx || b === selectedIdx
        );
        if (!connected) {
            anchorMenu.visible = false;
            return;
        }

        const [idxA, idxB] = connected;
        const pA = points[idxA];
        const pB = points[idxB];

        // 1.1 Initialisiere anchor-Struktur, falls noch nicht vorhanden
        [pA, pB].forEach((p) => {
            if (!p.anchor) {
                p.anchor = {
                    start: { x: p.x, y: p.y },
                    end:   { x: p.x, y: p.y },
                    neighbors: {}
                };
            }
        });

        // 1.2 Für diese Nachbarschaft einen Eintrag anlegen, falls nötig
        if (!pA.anchor.neighbors[idxB]) {
            pA.anchor.neighbors[idxB] = {
                mid: calcMidAnchorPoint(pA, pB)
            };
        }
        if (!pB.anchor.neighbors[idxA]) {
            pB.anchor.neighbors[idxA] = {
                mid: calcMidAnchorPoint(pA, pB)
            };
        }

        // 1.3 Wiederherstellung des gespeicherten mid
        const midA = pA.anchor.neighbors[idxB].mid;
        const midB = pB.anchor.neighbors[idxA].mid;
        anchorMenu.midPoint = {
            x: (midA.x + midB.x) / 2,
            y: (midA.y + midB.y) / 2
        };

        // 1.4 Menü vorbereiten
        anchorMenu.visible = true;
        anchorMenu.points = [pA, pB];
        anchorMenu.selectedAnchor = null;

        // 1.5 Falls schon Bezier‑Kontrollpunkte da sind, nutze sie
        if (pA.bezier?.cp2 && pB.bezier?.cp1) {
            anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
            anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
        } else {
            updateBezierControls();
        }
    };




    // Punkt-Auswahl und Suche
    const selectPoint = (idx) => {
        points.forEach((p, i) => p.selected = i === idx);
        loadAnchorMenuFromSelection();
        draw();
    };

    const findPointAtPos = (pos, radius = 8) => {
        return points.findIndex(p => {
            const dx = p.x - pos.x;
            const dy = p.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
    };

    const isOnAnchorPoint = (pos, anchorPos, radius = 8) => {
        const dx = pos.x - anchorPos.x;
        const dy = pos.y - anchorPos.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    };

    const findControlPointAtPos = (pos, radius = 6) => {
        const [pA, pB] = anchorMenu.points;
        if (!pA?.bezier || !pB?.bezier) return null;

        if (isOnAnchorPoint(pos, pA.bezier.cp2, radius)) {
            anchorMenu.selectedAnchor = 'cp2';
            return { point: pA, control: 'cp2' };
        }
        if (isOnAnchorPoint(pos, pB.bezier.cp1, radius)) {
            anchorMenu.selectedAnchor = 'cp1';
            return { point: pB, control: 'cp1' };
        }
        return null;
    };

    const calcMidAnchorPoint = (pA, pB) => ({
        x: (pA.x + pB.x) / 2,
        y: (pA.y + pB.y) / 2,
    });


    // Update der Bezier-Kontrollpunkte
    const updateBezierControls = (force = false) => {
        if (!anchorMenu.visible || anchorMenu.points.length !== 2 || !anchorMenu.midPoint) return;

        const [pA, pB] = anchorMenu.points;
        const idxA = points.indexOf(pA);
        const idxB = points.indexOf(pB);
        const mid = anchorMenu.midPoint;

        // Nur initial oder bei force
        const need = force || !(pA.bezier?.cp2 && pB.bezier?.cp1);
        if (!need) return;

        // Neue Kontrollpunkte halbwegs zwischen Punkt und Mid
        const cp1 = { x: (pA.x + mid.x) / 2, y: (pA.y + mid.y) / 2 };
        const cp2 = { x: (pB.x + mid.x) / 2, y: (pB.y + mid.y) / 2 };

        pA.bezier = pA.bezier || {};
        pB.bezier = pB.bezier || {};
        pA.bezier.cp2 = cp1;
        pB.bezier.cp1 = cp2;

        anchorMenu.anchorArms.cp1 = cp1;
        anchorMenu.anchorArms.cp2 = cp2;

        // Mid in den beiden Nachbarschaft-Einträgen speichern
        pA.anchor.neighbors[idxB].mid = { ...mid };
        pB.anchor.neighbors[idxA].mid = { ...mid };
    };

    // Zeichnen des Canvas-Inhalts
    const draw = () => {
        if (!ctx.value) return;
        const c = ctx.value;
        const w = canvas.value.width;
        const h = canvas.value.height;

        // Canvas leeren
        c.clearRect(0, 0, w, h);

        // 1) Verbindungen (Linien oder Bezier-Kurven)
        connections.forEach(([a, b]) => {
            const pA = points[a];
            const pB = points[b];
            if (!pA || !pB) return;

            if (pA.bezier && pB.bezier) {
                // Bezier
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.bezierCurveTo(
                    pA.bezier.cp2.x, pA.bezier.cp2.y,
                    pB.bezier.cp1.x, pB.bezier.cp1.y,
                    pB.x, pB.y
                );
                c.strokeStyle = '#333';
                c.lineWidth = 2;
                c.stroke();
            } else {
                // Linie
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.lineTo(pB.x, pB.y);
                c.strokeStyle = '#888';
                c.lineWidth = 1;
                c.stroke();
            }
        });

        // 2) Punkte
        points.forEach((p, i) => {
            const isStart = i === 0;
            const isEnd = i === points.length - 1;
            c.beginPath();
            c.arc(p.x, p.y, 6, 0, Math.PI * 2);
            if (isStart) {
                c.fillStyle = '#00c853';
            } else if (isEnd) {
                c.fillStyle = '#00c853';
            } else {
                c.fillStyle = p.selected || anchorMenu.midPoint &&
                    (anchorMenu.points[0].selected || anchorMenu.points[1].selected) ? '#007bff' : '#555';
            }
            c.fill();
            c.strokeStyle = '#222';
            c.stroke();
        });

        // 3) Anker-Menü: Hauptanker und Linien nur wenn sichtbar UND ein Hauptpunkt selektiert
        if (
            anchorMenu.visible &&
            anchorMenu.points.length === 2 &&
            anchorMenu.midPoint &&
            (anchorMenu.points[0].selected || anchorMenu.points[1].selected)
        ) {
            const [pA, pB] = anchorMenu.points;
            const mid = anchorMenu.midPoint;

            // Mittelpunktsanker
            c.fillStyle = '#0a0';
            c.beginPath();
            c.arc(mid.x, mid.y, 8, 0, Math.PI * 2);
            c.fill();

            // Linien zu Mid
            c.strokeStyle = '#0a0';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(pA.x, pA.y);
            c.lineTo(mid.x, mid.y);
            c.lineTo(pB.x, pB.y);
            c.stroke();

            // 4) Hilfskontrollpunkte nur anzeigen, wenn beide Bezier-Kontrollen existieren
            if (pA.bezier?.cp2 && pB.bezier?.cp1) {
                // Kontrolllinien
                c.strokeStyle = '#aaa';
                c.lineWidth = 1;
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.lineTo(pA.bezier.cp2.x, pA.bezier.cp2.y);
                c.moveTo(pB.x, pB.y);
                c.lineTo(pB.bezier.cp1.x, pB.bezier.cp1.y);
                c.stroke();

                // Kontrollpunkte
                c.fillStyle = '#f0a';
                c.beginPath();
                c.arc(pA.bezier.cp2.x, pA.bezier.cp2.y, 5, 0, Math.PI * 2);
                c.fill();
                c.beginPath();
                c.arc(pB.bezier.cp1.x, pB.bezier.cp1.y, 5, 0, Math.PI * 2);
                c.fill();
            }
        }
    };

    // Event-Handler für Pointer (Maus/Touch)
    const onPointerDown = (e) => {
        if (!props.state) return;
        const pos = getMousePos(e);
        const ctrl = isCtrlPressed(e);

        // Reset Mid-Drag-Zustand
        draggedAnchor = null;
        draggedControlPoint = null;
        draggedPointIdx = null;
        anchorMenu.selectedAnchor = null;
        previousMid = null;
        cpOffsets = null;

        if (ctrl) {
            // Ankermenü-Bereiche (Start, End, Mid)
            if (anchorMenu.visible) {
                const [pA, pB] = anchorMenu.points;
                if (isOnAnchorPoint(pos, pA.anchor.start)) { draggedAnchor = 'start'; return; }
                if (isOnAnchorPoint(pos, pB.anchor.end))   { draggedAnchor = 'end';   return; }
                if (isOnAnchorPoint(pos, anchorMenu.midPoint)) { draggedAnchor = 'mid';   return; }
            }

            // Kontrollpunkt greifen?
            const controlHit = findControlPointAtPos(pos);
            if (controlHit) {
                draggedControlPoint = controlHit;
                return;
            }

            // Punkt-Auswahl
            const pointIdx = findPointAtPos(pos);
            if (pointIdx !== -1) {
                selectPoint(pointIdx);
                draggedPointIdx = pointIdx;
                loadAnchorMenuFromSelection();
                draw();
                return;
            }

            return;
        }

        // Neuer Punkt hinzufügen (ohne STRG)
        const isFirstPoint   = points.length === 0;
        const selectedPts   = points.filter(p => p.selected);
        const isOnlyOneSel  = selectedPts.length === 1;
        const isStartSel    = isOnlyOneSel && points[0].selected;
        const isEndSel      = isOnlyOneSel && points[points.length - 1].selected;

        if (isFirstPoint || isStartSel || isEndSel) {
            const newPoint = {
                x: pos.x, y: pos.y, selected: true, bezier: null,
                anchor: { start: { x: pos.x, y: pos.y }, end: { x: pos.x, y: pos.y }, neighbors: {} }
            };
            points.forEach(p => p.selected = false);

            if (isFirstPoint || isEndSel) {
                points.push(newPoint);
                if (!isFirstPoint) connections.push([points.length - 2, points.length - 1]);
            } else {
                points.unshift(newPoint);
                connections.forEach(c => { c[0]++; c[1]++; });
                connections.unshift([0,1]);
            }

            // Nachbarn initialisieren
            if (isStartSel) {
                const oldFirst = points[1];
                newPoint.anchor.neighbors[1] = { mid: { x: newPoint.x, y: newPoint.y } };
                oldFirst.anchor.neighbors[0] = { mid: { x: newPoint.x, y: newPoint.y } };
            } else if (isEndSel) {
                const oldLast = points[points.length - 2];
                newPoint.anchor.neighbors[points.length - 2] = { mid: { x: newPoint.x, y: newPoint.y } };
                oldLast.anchor.neighbors[points.length - 1] = { mid: { x: newPoint.x, y: newPoint.y } };
            }

            // Anchor‑Menu öffnen ab 2 Punkten
            if (points.length > 1) {
                const pA = isStartSel ? points[0] : points[points.length - 2];
                const pB = isStartSel ? points[1] : points[points.length - 1];
                anchorMenu.visible = true;
                anchorMenu.points = [pA, pB];
                anchorMenu.selectedAnchor = null;

                const idxA = points.indexOf(pA);
                const idxB = points.indexOf(pB);
                if (!pA.anchor.neighbors[idxB]) pA.anchor.neighbors[idxB] = { mid: calcMidAnchorPoint(pA,pB) };
                if (!pB.anchor.neighbors[idxA]) pB.anchor.neighbors[idxA] = { mid: calcMidAnchorPoint(pA,pB) };

                const mA = pA.anchor.neighbors[idxB].mid;
                const mB = pB.anchor.neighbors[idxA].mid;
                anchorMenu.midPoint = { x:(mA.x+mB.x)/2, y:(mA.y+mB.y)/2 };

                draggingNewPoint = true;
                updateBezierControls();
            } else {
                anchorMenu.visible = false;
                draggingNewPoint = false;
            }

            draw();
            return;
        }

        // Klick außerhalb
        points.forEach(p => p.selected = false);
        anchorMenu.visible = false;
        draw();
    };

    const onPointerMove = (e) => {
        if (!props.state) return;
        const pos = getMousePos(e);
        const ctrl = isCtrlPressed(e);

        // 1) Neuer Punkt Drag
        if (draggingNewPoint) {
            anchorMenu.visible = true;
            const [pA, pB] = anchorMenu.points;
            const idxA = points.indexOf(pA);
            const idxB = points.indexOf(pB);
            const mid = calcMidAnchorPoint(pA, pos);

            anchorMenu.midPoint = mid;
            pA.anchor.neighbors[idxB].mid = { ...mid };
            pB.anchor.neighbors[idxA].mid = { ...mid };

            updateBezierControls(true);
            draw();
            return;
        }

        // 2) Hauptpunkt verschieben (STRG + Drag)
        if (ctrl && draggedPointIdx !== null && !draggedControlPoint && !draggedAnchor) {
            anchorMenu.visible = true;
            const p = points[draggedPointIdx];
            const dx = pos.x - p.x;
            const dy = pos.y - p.y;

            p.x = pos.x; p.y = pos.y;
            if (p.bezier) {
                if (p.bezier.cp1) { p.bezier.cp1.x += dx; p.bezier.cp1.y += dy; }
                if (p.bezier.cp2) { p.bezier.cp2.x += dx; p.bezier.cp2.y += dy; }
            }

            Object.entries(p.anchor.neighbors).forEach(([nbrIdx, data]) => {
                data.mid.x += dx; data.mid.y += dy;
                const nb = points[Number(nbrIdx)];
                if (nb.anchor?.neighbors?.[draggedPointIdx]) {
                    nb.anchor.neighbors[draggedPointIdx].mid.x += dx;
                    nb.anchor.neighbors[draggedPointIdx].mid.y += dy;
                }
            });

            if (anchorMenu.points.includes(p)) {
                const [pA,pB] = anchorMenu.points;
                const mA = pA.anchor.neighbors[points.indexOf(pB)].mid;
                const mB = pB.anchor.neighbors[points.indexOf(pA)].mid;
                anchorMenu.midPoint = { x:(mA.x+mB.x)/2, y:(mA.y+mB.y)/2 };
                updateBezierControls();
            }

            draw();
            return;
        }

        // 3) Kontrollpunkt verschieben
        if (draggedControlPoint) {
            const { point, control } = draggedControlPoint;
            const bez = point.bezier[control];
            const neighbor = anchorMenu.points.find(p => p !== point);
            const idxP = points.indexOf(point);
            const idxN = points.indexOf(neighbor);
            const dx = pos.x - bez.x;
            const dy = pos.y - bez.y;

            bez.x = pos.x; bez.y = pos.y;

            point.anchor.neighbors[idxN].mid.x += dx/2;
            point.anchor.neighbors[idxN].mid.y += dy/2;
            neighbor.anchor.neighbors[idxP].mid.x += dx/2;
            neighbor.anchor.neighbors[idxP].mid.y += dy/2;

            const e1 = point.anchor.neighbors[idxN].mid;
            const e2 = neighbor.anchor.neighbors[idxP].mid;
            anchorMenu.midPoint = { x:(e1.x+e2.x)/2, y:(e1.y+e2.y)/2 };

            updateBezierControls();
            draw();
            return;
        }

        // 4) Anker verschieben
        if (!anchorMenu.visible || !draggedAnchor) return;
        const [pA, pB] = anchorMenu.points;
        const idxA = points.indexOf(pA);
        const idxB = points.indexOf(pB);

        // 4.1) Mid-Anchor
        if (draggedAnchor === 'mid') {
            // Offsets merken
            if (!previousMid) {
                previousMid = { ...anchorMenu.midPoint };
                cpOffsets = {
                    offsetA: { x:(pA.bezier.cp2.x||0)-previousMid.x, y:(pA.bezier.cp2.y||0)-previousMid.y },
                    offsetB: { x:(pB.bezier.cp1.x||0)-previousMid.x, y:(pB.bezier.cp1.y||0)-previousMid.y },
                };
            }

            const newMid = { x:pos.x, y:pos.y };
            anchorMenu.midPoint = newMid;
            pA.anchor.neighbors[idxB].mid = { ...newMid };
            pB.anchor.neighbors[idxA].mid = { ...newMid };

            if (pA.bezier) {
                pA.bezier.cp2 = {
                    x: newMid.x + cpOffsets.offsetA.x,
                    y: newMid.y + cpOffsets.offsetA.y
                };
                anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
            }
            if (pB.bezier) {
                pB.bezier.cp1 = {
                    x: newMid.x + cpOffsets.offsetB.x,
                    y: newMid.y + cpOffsets.offsetB.y
                };
                anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
            }

            draw();
            return;
        }

        // 4.2) Start-Anker
        if (draggedAnchor === 'start') {
            pA.anchor.start = { ...pos };
            pA.x = pos.x; pA.y = pos.y;
            updateBezierControls();
            draw();
            return;
        }

        // 4.3) End-Anker
        if (draggedAnchor === 'end') {
            pB.anchor.end = { ...pos };
            pB.x = pos.x; pB.y = pos.y;
            updateBezierControls();
            draw();
            return;
        }
    };


    const onPointerUp = () => {
        draggedAnchor = null;
        draggingNewPoint = false;
        draggedPointIdx = null;
        draggedControlPoint = null;
        anchorMenu.selectedAnchor = null;
        previousMid = null;
        cpOffsets = null;

        updateBezierControls();
        draw();
    };

    // Wrapper-Click für Deselect
    const onWrapperClick = (e) => {
        if (canvas.value && canvas.value.contains(e.target)) return;
        anchorMenu.visible = false;
        draggedAnchor = null;
        anchorMenu.selectedAnchor = null;
        draggingNewPoint = false;
        draggedPointIdx = null;
        draggedControlPoint = null;
        previousMid = null;
        cpOffsets = null;
        updateBezierControls();
        draw();
    };

    // Canvas initialisieren (Größe setzen, Kontext holen)
    const initCanvas = () => {
        if (!canvas.value) return;
        const el = canvas.value;
        const { width, height } = props.viewport;
        Object.assign(el, { width, height });
        ctx.value = el.getContext('2d');
        Object.assign(ctx.value, { lineCap: 'round', lineJoin: 'round' });
        draw();
    };

    // Lifecycle-Hooks
    onMounted(() => {
        initCanvas();
        loadAnchorMenuFromSelection();
        register('add', document, 'resize', initCanvas);
        register('pause');
    });

    onBeforeUnmount(() => {
        register('remove', document, 'resize', initCanvas);
    });

    return {
        canvas,
        points,
        connections,
        anchorMenu,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onWrapperClick,
        emitEvent,
    };
}

export const penProps = {
    state: { type: Boolean, required: true },
    drawing: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
};
