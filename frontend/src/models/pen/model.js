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

    const emitEvent = (event, payload) => emit('update:component-event', event, payload);
    const { register } = eventRegister('listener:pen', emitEvent);

    // Helfer: Mausposition relativ zum Canvas
    const getMousePos = (e) => {
        const rect = canvas.value.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const isCtrlPressed = (e) => e.ctrlKey || e.metaKey;

    const loadAnchorMenuFromSelection = () => {
        const selectedIdx = points.findIndex(p => p.selected);
        if (selectedIdx === -1) {
            anchorMenu.visible = false;
            return;
        }

        const connected = connections.find(([a, b]) =>
            a === selectedIdx || b === selectedIdx
        );

        if (!connected) {
            anchorMenu.visible = false;
            return;
        }

        const [a, b] = connected;
        const pA = points[a];
        const pB = points[b];

        // 🆕 Ankerstruktur initialisieren, falls nicht vorhanden
        [pA, pB].forEach(p => {
            if (!p.anchor) {
                p.anchor = {
                    start: { x: p.x, y: p.y },
                    end: { x: p.x, y: p.y },
                    mid: { x: p.x, y: p.y }
                };
            }
        });

        anchorMenu.visible = true;
        anchorMenu.points = [pA, pB];
        anchorMenu.midPoint = pA.anchor?.mid || calcMidAnchorPoint(pA, pB);
        anchorMenu.selectedAnchor = null;

        if (pA.bezier?.cp2 && pB.bezier?.cp1) {
            anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
            anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
        } else {
            updateBezierControls();  // Bezier erzeugen
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

        if (isOnAnchorPoint(pos, pA.bezier.cp2, radius)) return { point: pA, control: 'cp2' };
        if (isOnAnchorPoint(pos, pB.bezier.cp1, radius)) return { point: pB, control: 'cp1' };
        return null;
    };

    const calcMidAnchorPoint = (pA, pB) => ({
        x: (pA.x + pB.x) / 2,
        y: (pA.y + pB.y) / 2,
    });

    // Zeichnen des Canvas-Inhalts
    const draw = () => {
        if (!ctx.value) return;
        const c = ctx.value;
        const w = canvas.value.width;
        const h = canvas.value.height;

        c.clearRect(0, 0, w, h);

        // Verbindungen (Linien oder Bezier-Kurven)
        connections.forEach(([a, b]) => {
            const pA = points[a];
            const pB = points[b];

            if (pA.bezier && pB.bezier) {
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

                // Kontrolllinien
                c.strokeStyle = '#aaa';
                c.lineWidth = 1;
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.lineTo(pA.bezier.cp2.x, pA.bezier.cp2.y);
                c.moveTo(pB.x, pB.y);
                c.lineTo(pB.bezier.cp1.x, pB.bezier.cp1.y);
                c.stroke();

                // Kontrollpunkte zeichnen
                c.fillStyle = '#f0a';
                c.beginPath();
                c.arc(pA.bezier.cp2.x, pA.bezier.cp2.y, 5, 0, Math.PI * 2);
                c.fill();
                c.beginPath();
                c.arc(pB.bezier.cp1.x, pB.bezier.cp1.y, 5, 0, Math.PI * 2);
                c.fill();
            } else {
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.lineTo(pB.x, pB.y);
                c.strokeStyle = '#888';
                c.lineWidth = 1;
                c.stroke();
            }
        });

        // Punkte zeichnen
        points.forEach((p, i) => {
            const isStart = i === 0;
            const isEnd = i === points.length - 1;
            c.beginPath();
            c.arc(p.x, p.y, 6, 0, Math.PI * 2);
            if (isStart) {
                c.fillStyle = '#00c853'; // Grün für Startpunkt
            } else if (isEnd) {
                c.fillStyle = '#d50000'; // Rot für Endpunkt
            } else {
                c.fillStyle = p.selected ? '#007bff' : '#555';
            }
            c.fill();
            c.strokeStyle = '#222';
            c.stroke();
        });

        // Anker-Menü (falls sichtbar)
        if (
            anchorMenu.visible &&
            anchorMenu.points.length === 2 &&
            anchorMenu.midPoint &&
            anchorMenu.points[0].selected || anchorMenu.points[1].selected
        ) {
            const [pA, pB] = anchorMenu.points;
            const mid = anchorMenu.midPoint;

            c.fillStyle = '#f00';
            c.beginPath();
            c.arc(pA.x, pA.y, 8, 0, Math.PI * 2);
            c.fill();

            c.beginPath();
            c.arc(pB.x, pB.y, 8, 0, Math.PI * 2);
            c.fill();

            c.fillStyle = '#0a0';
            c.beginPath();
            c.arc(mid.x, mid.y, 8, 0, Math.PI * 2);
            c.fill();

            c.strokeStyle = '#0a0';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(pA.x, pA.y);
            c.lineTo(mid.x, mid.y);
            c.lineTo(pB.x, pB.y);
            c.stroke();
        }
    };

    // Update der Bezier-Kontrollpunkte
    const updateBezierControls = (force = false) => {
        if (
            !anchorMenu.visible ||
            anchorMenu.points.length !== 2 ||
            !anchorMenu.midPoint
        ) return;

        const [pA, pB] = anchorMenu.points;
        const mid = anchorMenu.midPoint;

        const shouldUpdate = force || !(pA.bezier?.cp2 && pB.bezier?.cp1);
        if (!shouldUpdate) return;

        const cp1 = { x: (pA.x + mid.x) / 2, y: (pA.y + mid.y) / 2 };
        const cp2 = { x: (pB.x + mid.x) / 2, y: (pB.y + mid.y) / 2 };

        pA.bezier = pA.bezier || {};
        pB.bezier = pB.bezier || {};
        pA.bezier.cp2 = cp1;
        pB.bezier.cp1 = cp2;
        pA.anchor.mid = calcMidAnchorPoint(pA, pB);
        pB.anchor.mid = calcMidAnchorPoint(pA, pB);

        anchorMenu.anchorArms.cp1 = cp1;
        anchorMenu.anchorArms.cp2 = cp2;
    };

    // Event-Handler für Pointer (Maus/Touch)
    const onPointerDown = (e) => {
        if (!props.state) return;
        const pos = getMousePos(e);
        const ctrl = isCtrlPressed(e);

        if (ctrl) {
            // STRG-Modus: Kontrollpunkte oder Ankerpunkte verschieben

            // Ankerpunkte (Start, End, Mid) verschieben
            if (anchorMenu.visible) {
                const pA = anchorMenu.points[0];
                const pB = anchorMenu.points[1];

                if (isOnAnchorPoint(pos, pA.anchor.start)) {
                    draggedAnchor = 'start';
                    return;
                }
                if (isOnAnchorPoint(pos, pB.anchor.end)) {
                    draggedAnchor = 'end';
                    return;
                }
                if (isOnAnchorPoint(pos, anchorMenu.midPoint)) {
                    draggedAnchor = 'mid';
                    return;
                }
            }

            const controlHit = findControlPointAtPos(pos);
            if (controlHit) {
                draggedControlPoint = controlHit;
                return;
            }

            // Punkte auswählen und ggf. Ankermenü anzeigen
            const pointIdx = findPointAtPos(pos);
            if (pointIdx !== -1) {
                selectPoint(pointIdx);
                draggedPointIdx = pointIdx;

                loadAnchorMenuFromSelection();
                const selectedIdx = points.findIndex(p => p?.selected === true);

                if (selectedIdx !== -1) {
                    const connected = connections.find(([a, b]) =>
                        (a === selectedIdx && b === pointIdx) || (b === selectedIdx && a === pointIdx)
                    );

                    if (connected) {
                        const pA = points[selectedIdx];
                        const pB = points[pointIdx];
                        anchorMenu.visible = true;
                        anchorMenu.points = [pA, pB];
                        anchorMenu.midPoint = calcMidAnchorPoint(pA, pB);
                        anchorMenu.selectedAnchor = null;
                        updateBezierControls();
                    } else {
                        anchorMenu.visible = false;
                    }
                } else {
                    anchorMenu.visible = false;
                }

                draw();
                return;
            }

            // Kein neuer Punkt bei STRG gedrückt
            return;
        }

        // Normaler Modus: Neuer Punkt hinzufügen

        const isFirstPoint = points.length === 0;
        const selectedPoints = points.filter(p => p.selected);
        const isOnlyOneSelected = selectedPoints.length === 1;
        const isStartSelected = isOnlyOneSelected && points[0]?.selected;
        const isEndSelected = isOnlyOneSelected && points[points.length - 1]?.selected;

        if (isFirstPoint || isStartSelected || isEndSelected) {
            const newPoint = {
                x: pos.x,
                y: pos.y,
                selected: true,
                bezier: null,
                anchor: {
                    start: { x: pos.x, y: pos.y },
                    end: { x: pos.x, y: pos.y },
                    mid: { x: pos.x, y: pos.y }
                }
            };
            points.forEach(p => p.selected = false);

            if (isFirstPoint || isEndSelected) {
                points.push(newPoint);
                if (!isFirstPoint) {
                    connections.push([points.length - 2, points.length - 1]);
                }
            } else if (isStartSelected) {
                points.unshift(newPoint);
                connections.forEach(conn => {
                    conn[0]++;
                    conn[1]++;
                });
                connections.unshift([0, 1]);
            }

            if (points.length > 1) {
                const pA = isStartSelected ? points[0] : points[points.length - 2];
                const pB = isStartSelected ? points[1] : points[points.length - 1];
                anchorMenu.visible = true;
                anchorMenu.points = [pA, pB];
                anchorMenu.midPoint = calcMidAnchorPoint(pA, pB);
                anchorMenu.selectedAnchor = null;
                draggingNewPoint = true;
                updateBezierControls();
            } else {
                anchorMenu.visible = false;
                draggingNewPoint = false;
            }

            draw();
            return;
        }

        // Klick auf leeren Bereich: Auswahl aufheben
        points.forEach(p => p.selected = false);
        anchorMenu.visible = false;
        draw();
    };

    const onPointerMove = (e) => {
        if (!props.state) return;
        const pos = getMousePos(e);
        const ctrl = isCtrlPressed(e);

        if (draggingNewPoint) {
            anchorMenu.midPoint = calcMidAnchorPoint(anchorMenu.points[0], pos);
            updateBezierControls(true);
            draw();
            return;
        }

        if (ctrl && draggedPointIdx !== null) {
            // Nur mit STRG dürfen Punkte bewegt werden
            points[draggedPointIdx].x = pos.x;
            points[draggedPointIdx].y = pos.y;

            if (anchorMenu.visible) {
                const [pA, pB] = anchorMenu.points;
                anchorMenu.midPoint = calcMidAnchorPoint(pA, pB);
                updateBezierControls();
            }

            draw();
            return;
        }

        if (draggedControlPoint) {
            const { point, control } = draggedControlPoint;
            point.bezier[control].x = pos.x;
            point.bezier[control].y = pos.y;
            draw();
            return;
        }

        if (!anchorMenu.visible || !draggedAnchor) return;

        if (draggedAnchor === 'mid') {
            const pA = anchorMenu.points[0];
            anchorMenu.midPoint = { ...pos };
            pA.anchor.mid = { ...pos };
            updateBezierControls(true);
        } else if (draggedAnchor === 'start') {
            const pA = anchorMenu.points[0];
            pA.anchor.start = { ...pos };
            pA.x = pos.x;
            pA.y = pos.y;
            pA.anchor.mid = calcMidAnchorPoint(pA, anchorMenu.points[1]);
        } else if (draggedAnchor === 'end') {
            const pB = anchorMenu.points[1];
            pB.anchor.end = { ...pos };
            pB.x = pos.x;
            pB.y = pos.y;
            anchorMenu.points[0].anchor.mid = calcMidAnchorPoint(anchorMenu.points[0], pB);
        }

        updateBezierControls();
        draw();
    };


    const onPointerUp = () => {
        draggedAnchor = null;
        draggingNewPoint = false;
        draggedPointIdx = null;
        draggedControlPoint = null;
        draw();
    };

    // Wrapper-Click für Deselect
    const onWrapperClick = (e) => {
        if (canvas.value && canvas.value.contains(e.target)) return;
        anchorMenu.visible = false;
        draggedAnchor = null;
        draggingNewPoint = false;
        draggedPointIdx = null;
        draggedControlPoint = null;
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
