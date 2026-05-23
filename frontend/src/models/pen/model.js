import {computed, onBeforeUnmount, onMounted, reactive, ref} from 'vue';
import {eventRegister} from "@/dataLayer/event";
import {number} from "@/utils/math";

export function penModel(props, emit) {
    const wrapper = ref(null);
    const canvas = ref(null);
    const ctx = ref(null);

    const draggedAnchor = ref(null);
    const draggingNewPoint = ref(false);
    const draggedPointIdx = ref(null);
    const draggedControlPoint = ref(null);
    const previousMid = ref(null);
    const cpOffsets = ref(null);

    const config = ref({
        maxWidth: 500,
        class: 'dialog-dimm',
        emit: 'pen:path-state',
        hideClose: true
    });

    const anchorMenu = reactive({
        visible: false,
        points: [],
        midPoint: null,
        selectedAnchor: null,
        anchorArms: { cp1: null, cp2: null },
    });

    const pointsLength = computed(() => props.pathLayer.points.length);

    const emitEvent = (event, payload) => emit('update:component-event', event, payload);
    const { register } = eventRegister('listener:pen', emitEvent);

    const isCtrlPressed = (e) => e.ctrlKey || e.metaKey;

    const updatePathLayer = () => {
        const layer = props.pathLayer;
        layer.points     = JSON.parse(JSON.stringify(props.pathLayer.points));
        layer.connections= JSON.parse(JSON.stringify(props.pathLayer.connections));
        emitEvent('update:path-layer', layer);
    };

    const handleClosePath = (pos) => {
        if (props.pathLayer.closed) return false;
        if (props.pathLayer.points.length < 3) return false;

        // Nur prüfen, ob wir den ersten Punkt treffen
        return findPointAtPos(pos) === 0;
    };

    const handleAltClick = () => {
        const idx = findPointAtPos({ x: props.mouse.x, y: props.mouse.y });
        if (idx === -1) return;

        toggleBezierWithNeighbors(idx);
        draw();
    };

    const toggleBezierWithNeighbors = (idx) => {
        const p = props.pathLayer.points[idx];
        if (!p) return;

        const prev = props.pathLayer.points[idx - 1];
        const next = props.pathLayer.points[idx + 1];

        p.linear = !p.linear;

        if (p.linear) {
            // Zurück zu linear – alles entfernen
            p.bezier = null;
            if (prev?.bezier) prev.bezier.cp2 = null;
            if (next?.bezier) next.bezier.cp1 = null;

            anchorMenu.visible = false;
            anchorMenu.points = null;
            anchorMenu.midPoint = null;
        } else {
            // Initiale Bézier-Daten
            const cpDistance = 40;
            p.bezier = {
                cp1: { x: p.x - cpDistance, y: p.y },
                cp2: { x: p.x + cpDistance, y: p.y }
            };

            // Ensure anchor object exists
            p.anchor = p.anchor || { start: { x: p.x, y: p.y }, end: { x: p.x, y: p.y }, neighbors: {} };


            setupNeighbor(prev, true, cpDistance, p);
            setupNeighbor(next, false, cpDistance, p);
        }
    };


    const setupNeighbor = (neighbor, isPrev, cpDistance, self) => {
        if (!neighbor) return;

        const idxSelf = props.pathLayer.points.indexOf(self);
        const idxNeighbor = props.pathLayer.points.indexOf(neighbor);
        if (idxSelf === -1 || idxNeighbor === -1) return;

        neighbor.anchor = neighbor.anchor || {
            start: { x: neighbor.x, y: neighbor.y },
            end: { x: neighbor.x, y: neighbor.y },
            neighbors: {}
        };

        if (neighbor.linear === true) {
            neighbor.linear = false;
            neighbor.bezier = {
                cp1: { x: neighbor.x - cpDistance, y: neighbor.y },
                cp2: { x: neighbor.x + cpDistance, y: neighbor.y }
            };
        }

        // Midpoint berechnen
        const mid = calcMidAnchorPoint(self, neighbor);

        // Neighbors setzen
        self.anchor.neighbors[idxNeighbor] = { mid };
        neighbor.anchor.neighbors[idxSelf] = { mid };

        // anchorMenu setzen, wenn ein Punkt ausgewählt ist
        if (self.selected || neighbor.selected) {
            anchorMenu.visible = true;
            anchorMenu.points = isPrev ? [neighbor, self] : [self, neighbor];
            anchorMenu.midPoint = mid;
            anchorMenu.selectedAnchor = null;
            updateBezierControls(true);
        }
    };


    const handleCtrlRightClick = () => {
        const idx = findPointAtPos({ x: props.mouse.x, y: props.mouse.y });
        if (idx !== -1) {
            if (anchorMenu.visible) {
                const affected = anchorMenu.points.some(p => props.pathLayer.points.indexOf(p) === idx);
                if (affected || anchorMenu.midPoint?.idx === idx || anchorMenu.selectedAnchor?.idx === idx) {
                    anchorMenu.visible = false;
                    anchorMenu.selectedAnchor = null;
                    anchorMenu.points = [];
                    anchorMenu.midPoint = null;
                    anchorMenu.anchorArms = { cp1: null, cp2: null };
                }
            }

            if (idx > 0 && idx < props.pathLayer.points.length - 1) {
                const prevIdx = idx - 1;
                const nextIdx = idx + 1;

                const exists = props.pathLayer.connections.some(([a, b]) =>
                    (a === prevIdx && b === nextIdx) || (a === nextIdx && b === prevIdx)
                );

                if (!exists) {
                    props.pathLayer.connections.push([prevIdx, nextIdx]);
                }
            }

            for (let i = props.pathLayer.connections.length - 1; i >= 0; i--) {
                if (props.pathLayer.connections[i][0] === idx || props.pathLayer.connections[i][1] === idx) {
                    props.pathLayer.connections.splice(i, 1);
                }
            }

            props.pathLayer.points.splice(idx, 1);

            for (let i = 0; i < props.pathLayer.connections.length; i++) {
                props.pathLayer.connections[i][0] = props.pathLayer.connections[i][0] > idx ? props.pathLayer.connections[i][0] - 1 : props.pathLayer.connections[i][0];
                props.pathLayer.connections[i][1] = props.pathLayer.connections[i][1] > idx ? props.pathLayer.connections[i][1] - 1 : props.pathLayer.connections[i][1];
            }

            // Nachbarn updaten
            props.pathLayer.points.forEach((p) => {
                const newNeighbors = {};
                for (const [nbrIdxStr, data] of Object.entries(p.anchor.neighbors)) {
                    let nbrIdx = number(nbrIdxStr);
                    if (nbrIdx === idx) continue;  // Gelöschter Nachbar weg
                    if (nbrIdx > idx) nbrIdx--;
                    newNeighbors[nbrIdx] = data;
                }
                p.anchor.neighbors = newNeighbors;
            });

            draw();
        }
    };




    /**
     * Beschränkt cp auf maximal `maxRatio` der Länge von A nach B.
     */
    const clampControlPoint = (A, B, cp, maxRatio = 0.5) => {
        const dx = cp.x - A.x;
        const dy = cp.y - A.y;
        const segDx = B.x - A.x;
        const segDy = B.y - A.y;
        const segLen = Math.hypot(segDx, segDy);
        if (segLen === 0) return cp;

        // Projektion der Kontrolle auf das Segment
        const t = (dx * segDx + dy * segDy) / (segLen * segLen);
        // Abstandskomponente orthogonal zum Segment
        const perpX = dx - t * segDx;
        const perpY = dy - t * segDy;
        const perpDist = Math.hypot(perpX, perpY);

        // Maximal erlaubter orthogonaler Versatz
        const maxPerp = segLen * maxRatio;
        if (perpDist > maxPerp) {
            // Normalisiere und clampe
            const scale = maxPerp / perpDist;
            return {
                x: A.x + t * segDx + perpX * scale,
                y: A.y + t * segDy + perpY * scale
            };
        }
        return cp;
    };


    const loadAnchorMenuFromSelection = () => {
        const sel = props.pathLayer.points.findIndex(p => p.selected);
        if (sel === -1) { anchorMenu.visible = false; return; }

        const conn = props.pathLayer.connections.find(([a, b]) => a === sel || b === sel);
        if (!conn) { anchorMenu.visible = false; return; }

        const [iA, iB] = conn;
        const pA = props.pathLayer.points[iA];
        const pB = props.pathLayer.points[iB];

        if (!pA || !pB) {
            anchorMenu.visible = false;
            return;
        }

        if (pA.linear || pB.linear) {
            anchorMenu.visible = false;
            return;
        }

        [pA, pB].forEach(p => {
            if (!p.anchor) {
                p.anchor = {
                    start: { x: p.x, y: p.y },
                    end: { x: p.x, y: p.y },
                    neighbors: {}
                };
            }
        });

        if (!pA.anchor.neighbors[iB]) {
            pA.anchor.neighbors[iB] = { mid: calcMidAnchorPoint(pA, pB) };
        }
        if (!pB.anchor.neighbors[iA]) {
            pB.anchor.neighbors[iA] = { mid: calcMidAnchorPoint(pA, pB) };
        }

        const mA = pA.anchor.neighbors[iB]?.mid;
        const mB = pB.anchor.neighbors[iA]?.mid;

        if (!mA || !mB || mA.x == null || mB.x == null) {
            anchorMenu.visible = false;
            return;
        }

        anchorMenu.midPoint = {
            x: (mA.x + mB.x) / 2,
            y: (mA.y + mB.y) / 2
        };

        anchorMenu.visible = true;
        anchorMenu.points = [pA, pB];
        anchorMenu.selectedAnchor = null;

        if (pA.bezier?.cp2 && pB.bezier?.cp1) {
            anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
            anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
        } else {
            updateBezierControls();
        }
    };

    const selectPoint = (idx) => {
        props.pathLayer.points.forEach((p, i) => p.selected = i === idx);
        loadAnchorMenuFromSelection();
        const p = props.pathLayer.points[idx];
        p.selected = true;
        p.pulseAt = Date.now();

        draggedPointIdx.value = idx;
        draggedControlPoint.value = null;
        draggedAnchor.value = null;
        draw();
    };

    const findPointAtPos = (pos, radius = 8) => {
        return props.pathLayer.points.findIndex(p => {
            const dx = p.x - pos.x;
            const dy = p.y - pos.y;
            return dx * dx + dy * dy <= radius * radius;
        });
    };

    const isOnAnchorPoint = (pos, anchorPos, radius = 6) => {
        const dx = pos.x - anchorPos.x;
        const dy = pos.y - anchorPos.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    };

    const findControlPointAtPos = (pos, radius = 6) => {
        if(anchorMenu.visible &&
            Array.isArray(anchorMenu.points) &&
            anchorMenu.points.length >= 2) {
            const [pA, pB] = anchorMenu.points;
            if (!pA?.bezier || !pB?.bezier) return null;

            // Nur prüfen, wenn cp2 wirklich da ist
            if (pA.bezier.cp2 && isOnAnchorPoint(pos, pA.bezier.cp2, radius)) {
                anchorMenu.selectedAnchor = 'cp2';
                return { point: pA, control: 'cp2' };
            }
            // Dasselbe für cp1
            if (pB.bezier.cp1 && isOnAnchorPoint(pos, pB.bezier.cp1, radius)) {
                anchorMenu.selectedAnchor = 'cp1';
                return { point: pB, control: 'cp1' };
            }
        }

        return null;
    };

    const calcMidAnchorPoint = (pA, pB) => ({
        x: (pA.x + pB.x) / 2,
        y: (pA.y + pB.y) / 2,
    });


    // Update der Bezier-Kontrollpunkte
    const updateBezierControls = (force = false) => {
        if (!anchorMenu.visible || !anchorMenu.midPoint || !Array.isArray(anchorMenu.points)) return;
        if (anchorMenu.points.length !== 2) return;

        const [pA, pB] = anchorMenu.points;
        if (!pA || !pB) return;

        const idxA = props.pathLayer.points.indexOf(pA);
        const idxB = props.pathLayer.points.indexOf(pB);
        const mid = anchorMenu.midPoint;

        const aIsLinear = pA.linear === true;
        const bIsLinear = pB.linear === true;

        if (aIsLinear && bIsLinear) return;

        const need = force || !(pA.bezier?.cp2 || pB.bezier?.cp1);
        if (!need) return;

        pA.bezier = pA.bezier || {};
        pB.bezier = pB.bezier || {};

        // Nur pB ist bezier
        if (aIsLinear && !bIsLinear) {
            const dx = mid.x - pA.x;
            const dy = mid.y - pA.y;
            pB.bezier.cp1 = { x: mid.x + dx * 0.5, y: mid.y + dy * 0.5 };
            pA.bezier.cp2 = null;
            delete anchorMenu.anchorArms.cp1;
            anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
        }

        // Nur pA ist bezier
        else if (!aIsLinear && bIsLinear) {
            const dx = mid.x - pB.x;
            const dy = mid.y - pB.y;
            pA.bezier.cp2 = { x: mid.x + dx * 0.5, y: mid.y + dy * 0.5 };
            pB.bezier.cp1 = null;
            anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
            delete anchorMenu.anchorArms.cp2;
        }

        // Beide sind bezier
        else {
            const cp1 = { x: (pA.x + mid.x) / 2, y: (pA.y + mid.y) / 2 };
            const cp2 = { x: (pB.x + mid.x) / 2, y: (pB.y + mid.y) / 2 };

            pA.bezier.cp2 = cp1;
            pB.bezier.cp1 = cp2;

            anchorMenu.anchorArms.cp1 = cp1;
            anchorMenu.anchorArms.cp2 = cp2;
        }

        if (pA.anchor?.neighbors?.[idxB]) {
            pA.anchor.neighbors[idxB].mid = { ...mid };
        }

        if (pB.anchor?.neighbors?.[idxA]) {
            pB.anchor.neighbors[idxA].mid = { ...mid };
        }
    };


    // Zeichnen des Canvas-Inhalts
    const draw = () => {
        if (!ctx.value) return;
        const c = ctx.value;
        const w = canvas.value.width;
        const h = canvas.value.height;

        c.clearRect(0, 0, w, h);

        // === 1) Pfade ===
        props.pathLayer.connections.forEach(([a, b]) => {
            const pA = props.pathLayer.points[a];
            const pB = props.pathLayer.points[b];
            if (!pA || !pB) return;

            const linearA = !!pA.linear;
            const linearB = !!pB.linear;
            const bezA    = pA.bezier || {};
            const bezB    = pB.bezier || {};

            const hasCP2 = !!bezA.cp2;
            const hasCP1 = !!bezB.cp1;
            const isCubic = !linearA && !linearB && hasCP2 && hasCP1;
            const isQuadA = !linearA && hasCP2 && !isCubic;
            const isQuadB = !linearB && hasCP1 && !isCubic;

            c.beginPath();
            c.moveTo(pA.x, pA.y);

            if (isCubic) {
                // Volle Cubic Bézier
                c.bezierCurveTo(
                    bezA.cp2.x, bezA.cp2.y,
                    bezB.cp1.x, bezB.cp1.y,
                    pB.x,       pB.y
                );
                c.strokeStyle = '#6cf';
                c.lineWidth   = 1.5;
            }
            else if (isQuadA) {
                // Quadratic von pA zu pB mit cp2
                c.quadraticCurveTo(
                    bezA.cp2.x, bezA.cp2.y,
                    pB.x,       pB.y
                );
                c.strokeStyle = '#6cf';
                c.lineWidth   = 1.5;
            }
            else if (isQuadB) {
                // Quadratic von pA zu pB mit cp1
                c.quadraticCurveTo(
                    bezB.cp1.x, bezB.cp1.y,
                    pB.x,       pB.y
                );
                c.strokeStyle = '#6cf';
                c.lineWidth   = 1.5;
            }
            else {
                // Linie
                c.lineTo(pB.x, pB.y);
                c.strokeStyle = '#aaf';
                c.lineWidth   = 1;
            }

            c.stroke();
        });


        // === 2) Punkte ===
        props.pathLayer.points.forEach((p, i) => {
            const isStart = i === 0;
            const isEnd = i === props.pathLayer.points.length - 1;
            const isSelected = p.selected;
            const size = 6;

            if (p.pulseAt) {
                const elapsed = Date.now() - p.pulseAt;
                const duration = 300; // ms
                if (elapsed < duration) {
                    const progress = elapsed / duration;
                    const pulseRadius = 10 + progress * 10;
                    const alpha = 1 - progress;

                    c.beginPath();
                    c.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
                    c.strokeStyle = `rgba(0, 255, 255, ${alpha})`; // Cyan transparent
                    c.lineWidth = 2;
                    c.stroke();

                    requestAnimationFrame(draw); // Weiterzeichnen während der Animation
                } else {
                    p.pulseAt = null; // Animation beenden
                }
            }

            if (isStart || isEnd) {
                // Quadrat für Start-/Endpunkte
                c.beginPath();
                c.fillStyle = '#0ff';
                c.strokeStyle = '#06c';
                c.lineWidth = 1.5;
                c.rect(p.x - size / 2, p.y - size / 2, size, size);
                c.fill();
                c.stroke();
            } else {
                // Runde Punkte
                c.beginPath();
                const radius = isSelected ? 5 : 3;
                c.arc(p.x, p.y, radius, 0, Math.PI * 2);
                if (isSelected) {
                    c.fillStyle = '#0ff';
                    c.fill();
                    c.strokeStyle = '#06c';
                    c.lineWidth = 1.5;
                    c.stroke();
                } else {
                    c.fillStyle = '#fff';
                    c.fill();
                    c.strokeStyle = '#6cf';
                    c.lineWidth = 1;
                    c.stroke();
                }
            }
        });

        // === 3) Midpoint & Kontrollpunkte ===
        if (isValidAnchorMenu()) {
            const [pA, pB] = anchorMenu.points;
            const mid = anchorMenu.midPoint;

            // Midpoint – Quadrat & Magenta
            const size = 7;
            c.beginPath();
            c.fillStyle = '#f0f';
            c.strokeStyle = '#a0a';
            c.lineWidth = 1.2;
            c.rect(mid.x - size / 2, mid.y - size / 2, size, size);
            c.fill();
            c.stroke();

            // Linien zu Midpoint – dezent
            c.strokeStyle = '#ccc';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(pA.x, pA.y);
            c.lineTo(mid.x, mid.y);
            c.lineTo(pB.x, pB.y);
            c.stroke();

            // Kontrollpunkte und Linien
            if (pA.bezier?.cp2 || pB.bezier?.cp1) {
                c.strokeStyle = '#ccc';
                c.lineWidth = 1;

                if (pA.bezier?.cp2) {
                    c.beginPath();
                    c.moveTo(pA.x, pA.y);
                    c.lineTo(pA.bezier.cp2.x, pA.bezier.cp2.y);
                    c.stroke();

                    c.fillStyle = '#f0f';
                    c.beginPath();
                    c.arc(pA.bezier.cp2.x, pA.bezier.cp2.y, 3.5, 0, Math.PI * 2);
                    c.fill();
                }

                if (pB.bezier?.cp1) {
                    c.beginPath();
                    c.moveTo(pB.x, pB.y);
                    c.lineTo(pB.bezier.cp1.x, pB.bezier.cp1.y);
                    c.stroke();

                    c.fillStyle = '#f0f';
                    c.beginPath();
                    c.arc(pB.bezier.cp1.x, pB.bezier.cp1.y, 3.5, 0, Math.PI * 2);
                    c.fill();
                }
            }
        }
    };


    const isValidAnchorMenu = () => {
        if (!Array.isArray(anchorMenu.points) || anchorMenu.points.length < 2) return false;

        const [pA, pB] = anchorMenu.points;
        const mid = anchorMenu.midPoint;

        return (
            anchorMenu.visible &&
            pA && pB && mid &&
            [pA.x, pA.y, pB.x, pB.y, mid.x, mid.y].every(v => typeof v === 'number') &&
            (pA.selected || pB.selected)
        );
    };

    const onPointerDown = (e) => {
        if (!props.state) return;

        const pos = {x: props.mouse.x, y: props.mouse.y};
        const ctrl = isCtrlPressed(e);

        if (props.pathLayer.closed && !props.pathLayer.edit) return;

        // Pointer-Zustände zurücksetzen
        reset(false, true);

        register('add', canvas.value, 'pointermove', onPointerMove);
        register('add', canvas.value, 'pointerup', onPointerUp);

        // Alt+Linksklick: Spezialaktion
        if (e.altKey && e.button === 0) {
            handleAltClick(e);
            return;
        }

        // Strg+Rechtsklick: Spezialaktion
        if (ctrl && e.button === 2) {
            handleCtrlRightClick(e);
            return;
        }

        // Strg gedrückt → Anker-/Kontrollpunkt-Modus
        if (ctrl) {
            if (
                anchorMenu.visible &&
                Array.isArray(anchorMenu.points) &&
                anchorMenu.points.length >= 2
            ) {
                const [pA, pB] = anchorMenu.points;
                if (pA?.anchor && isOnAnchorPoint(pos, pA.anchor.start)) {
                    draggedAnchor.value = 'start';
                    return;
                }
                if (pB?.anchor && isOnAnchorPoint(pos, pB.anchor.end)) {
                    draggedAnchor.value = 'end';
                    return;
                }
                if (anchorMenu.midPoint && isOnAnchorPoint(pos, anchorMenu.midPoint)) {
                    draggedAnchor.value = 'mid';
                    return;
                }
            }

            const controlHit = findControlPointAtPos(pos);
            if (controlHit) {
                draggedControlPoint.value = controlHit;
                return;
            }

            const pointIdx = findPointAtPos(pos);
            if (pointIdx !== -1) {
                selectPoint(pointIdx);
                draggedPointIdx.value = pointIdx;
                loadAnchorMenuFromSelection();
                draw();
                return;
            }

            return;
        }

        // Punkt hinzufügen: erster oder selektierter Randpunkt
        const isFirstPoint = props.pathLayer.points.length === 0;
        const selectedPts = props.pathLayer.points.filter(p => p.selected);
        const isOnlyOneSel = selectedPts.length === 1;
        const isStartSel = isOnlyOneSel && props.pathLayer.points[0]?.selected;
        const isEndSel = isOnlyOneSel && props.pathLayer.points[props.pathLayer.points.length - 1]?.selected;

        if (isFirstPoint || isStartSel || isEndSel) {
            const newPoint = {
                x: pos.x,
                y: pos.y,
                selected: true,
                linear: props.bezier === 'linear',
                bezier: props.bezier === 'linear' ? null : {
                    cp1: { x: pos.x, y: pos.y },
                    cp2: { x: pos.x, y: pos.y },
                },
                pulseAt: null,
                anchor: {
                    start: { x: pos.x, y: pos.y },
                    end: { x: pos.x, y: pos.y },
                    neighbors: {}
                }
            };

            props.pathLayer.points.forEach(p => p.selected = false);

            if (isFirstPoint || isEndSel) {
                props.pathLayer.points.push(newPoint);
                if (!isFirstPoint) {
                    props.pathLayer.connections.push([props.pathLayer.points.length - 2, props.pathLayer.points.length - 1]);
                }
            } else {
                props.pathLayer.points.unshift(newPoint);
                props.pathLayer.connections.forEach(c => {
                    c[0]++;
                    c[1]++;
                });
                props.pathLayer.connections.unshift([0, 1]);
            }

            // Mid-Anchor berechnen
            if (!newPoint.linear && props.pathLayer.points.length > 1) {
                const pA = isStartSel ? props.pathLayer.points[0] : props.pathLayer.points[props.pathLayer.points.length - 2];
                const pB = isStartSel ? props.pathLayer.points[1] : props.pathLayer.points[props.pathLayer.points.length - 1];
                if (!pA?.anchor || !pB?.anchor) return;

                const idxA = props.pathLayer.points.indexOf(pA);
                const idxB = props.pathLayer.points.indexOf(pB);
                if (idxA === -1 || idxB === -1) return;

                if (!pA.anchor.neighbors[idxB]) {
                    pA.anchor.neighbors[idxB] = { mid: calcMidAnchorPoint(pA, pB) };
                }
                if (!pB.anchor.neighbors[idxA]) {
                    pB.anchor.neighbors[idxA] = { mid: calcMidAnchorPoint(pA, pB) };
                }

                const mA = pA.anchor.neighbors[idxB]?.mid;
                const mB = pB.anchor.neighbors[idxA]?.mid;
                if (!mA || !mB) return;

                anchorMenu.visible = true;
                anchorMenu.points = [pA, pB];
                anchorMenu.selectedAnchor = null;
                anchorMenu.midPoint = {
                    x: (mA.x + mB.x) / 2,
                    y: (mA.y + mB.y) / 2
                };

                draggingNewPoint.value = true;
                updateBezierControls();
            } else {
                anchorMenu.visible = false;
                draggingNewPoint.value = false;
            }
            draw();
            return;
        }

        props.pathLayer.points.forEach(p => p.selected = false);
        anchorMenu.visible = false;
        draw();
    };

    const onPointerMove = (e) => {
        if (!props.state) return;

        const pos = {x: props.mouse.x, y: props.mouse.y};
        const ctrl = isCtrlPressed(e);

        // 1) Neuer Punkt Drag
        if (draggingNewPoint.value) {
            if (!anchorMenu.points || anchorMenu.points.length < 2) return;
            const [pA, pB] = anchorMenu.points;
            const idxA = props.pathLayer.points.indexOf(pA);
            const idxB = props.pathLayer.points.indexOf(pB);
            if (idxA === -1 || idxB === -1) return;

            const mid = calcMidAnchorPoint(pA, pos);
            anchorMenu.midPoint = mid;
            pA.anchor.neighbors[idxB].mid = { ...mid };
            pB.anchor.neighbors[idxA].mid = { ...mid };

            updateBezierControls(true);
            draw();
        }

        // 2) Punkt verschieben
        else if (ctrl && draggedPointIdx.value !== null && !draggedControlPoint.value && !draggedAnchor.value) {
            const p = props.pathLayer.points[draggedPointIdx.value];
            if (!p) return;

            anchorMenu.visible = !p?.linear;

            const dx = pos.x - p.x;
            const dy = pos.y - p.y;

            p.x = pos.x;
            p.y = pos.y;

            if (p.bezier) {
                if (p.bezier.cp1) {
                    p.bezier.cp1.x += dx;
                    p.bezier.cp1.y += dy;
                }
                if (p.bezier.cp2) {
                    p.bezier.cp2.x += dx;
                    p.bezier.cp2.y += dy;
                }
            }

            Object.entries(p.anchor.neighbors).forEach(([nbrIdx, data]) => {
                if (!data.mid) return;
                data.mid.x += dx;
                data.mid.y += dy;

                const nb = props.pathLayer.points[number(nbrIdx)];
                if (nb?.anchor?.neighbors?.[draggedPointIdx.value]) {
                    nb.anchor.neighbors[draggedPointIdx.value].mid.x += dx;
                    nb.anchor.neighbors[draggedPointIdx.value].mid.y += dy;
                }
            });

            if (anchorMenu.points?.length >= 2 && anchorMenu.points.includes(p)) {
                const [pA, pB] = anchorMenu.points;
                if (!pA || !pB) return;

                const mA = pA.anchor.neighbors[props.pathLayer.points.indexOf(pB)]?.mid;
                const mB = pB.anchor.neighbors[props.pathLayer.points.indexOf(pA)]?.mid;
                if (!mA || !mB) return;

                anchorMenu.midPoint = {
                    x: (mA.x + mB.x) / 2,
                    y: (mA.y + mB.y) / 2
                };

                updateBezierControls();
            }

            draw();
        }

        // 3) Kontrollpunkt verschieben
        else if (draggedControlPoint.value) {
            if (!anchorMenu.points) return;
            const [pA, pB] = anchorMenu.points;
            if (pA?.linear && pB?.linear) {
                anchorMenu.visible = false;
                return;
            }

            anchorMenu.visible = true;

            const { point, control } = draggedControlPoint.value;
            const bez = point.bezier?.[control];
            if (!bez) return;

            const neighbor = anchorMenu.points.find(p => p !== point);
            if (!neighbor) return;

            const idxP = props.pathLayer.points.indexOf(point);
            const idxN = props.pathLayer.points.indexOf(neighbor);
            if (idxP === -1 || idxN === -1) return;
            if (!point.anchor?.neighbors?.[idxN] || !neighbor.anchor?.neighbors?.[idxP]) return;

            const dx = pos.x - bez.x;
            const dy = pos.y - bez.y;

            bez.x = pos.x;
            bez.y = pos.y;

            point.bezier[control] = clampControlPoint(point, neighbor, point.bezier[control], 0.5);

            point.anchor.neighbors[idxN].mid.x += dx / 2;
            point.anchor.neighbors[idxN].mid.y += dy / 2;
            neighbor.anchor.neighbors[idxP].mid.x += dx / 2;
            neighbor.anchor.neighbors[idxP].mid.y += dy / 2;

            const e1 = point.anchor.neighbors[idxN].mid;
            const e2 = neighbor.anchor.neighbors[idxP].mid;
            anchorMenu.midPoint = {
                x: (e1.x + e2.x) / 2,
                y: (e1.y + e2.y) / 2
            };

            updateBezierControls();
            draw();
        }

        // 4) Anker verschieben
        else if (anchorMenu.visible && draggedAnchor.value && anchorMenu.points?.length >= 2) {
            const [pA, pB] = anchorMenu.points;
            if (!pA || !pB || (pA.linear && pB.linear)) {
                anchorMenu.visible = false;
                return;
            }

            const idxA = props.pathLayer.points.indexOf(pA);
            const idxB = props.pathLayer.points.indexOf(pB);

            if (draggedAnchor.value === 'mid') {
                if (!anchorMenu.midPoint) return;

                if (!previousMid.value) {
                    previousMid.value = { ...anchorMenu.midPoint };
                    cpOffsets.value = {
                        offsetA: {
                            x: (pA?.bezier?.cp2?.x ?? 0) - previousMid.value.x,
                            y: (pA?.bezier?.cp2?.y ?? 0) - previousMid.value.y
                        },
                        offsetB: {
                            x: (pB?.bezier?.cp1?.x ?? 0) - previousMid.value.x,
                            y: (pB?.bezier?.cp1?.y ?? 0) - previousMid.value.y
                        }
                    };
                }

                if (!cpOffsets.value) return;

                const newMid = { x: pos.x, y: pos.y };
                anchorMenu.midPoint = newMid;

                if (pA.anchor?.neighbors?.[idxB]) pA.anchor.neighbors[idxB].mid = { ...newMid };
                if (pB.anchor?.neighbors?.[idxA]) pB.anchor.neighbors[idxA].mid = { ...newMid };

                const aIsLinear = pA.linear === true;
                const bIsLinear = pB.linear === true;

                if (pA?.bezier && cpOffsets.value.offsetA) {
                    let offsetAx = cpOffsets.value.offsetA.x;
                    let offsetAy = cpOffsets.value.offsetA.y;
                    if (aIsLinear) {
                        offsetAx = 0;
                        offsetAy = 0;
                    } else if (bIsLinear) {
                        offsetAx *= 0.5;
                        offsetAy *= 0.5;
                    }

                    pA.bezier.cp2 = {
                        x: newMid.x + offsetAx,
                        y: newMid.y + offsetAy
                    };
                    anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
                }

                if (pB?.bezier && cpOffsets.value.offsetB) {
                    let offsetBx = cpOffsets.value.offsetB.x;
                    let offsetBy = cpOffsets.value.offsetB.y;
                    if (bIsLinear) {
                        offsetBx = 0;
                        offsetBy = 0;
                    } else if (aIsLinear) {
                        offsetBx *= 0.5;
                        offsetBy *= 0.5;
                    }

                    pB.bezier.cp1 = {
                        x: newMid.x + offsetBx,
                        y: newMid.y + offsetBy
                    };
                    anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
                }

                draw();
            }

            else if (draggedAnchor.value === 'start') {
                pA.anchor.start = { ...pos };
                pA.x = pos.x;
                pA.y = pos.y;
                updateBezierControls();
                draw();
            }

            else if (draggedAnchor.value === 'end') {
                pB.anchor.end = { ...pos };
                pB.x = pos.x;
                pB.y = pos.y;
                updateBezierControls();
                draw();
            }
        }
    };



    const onPointerUp = (e) => {
        if (!isCtrlPressed(e) && !draggingNewPoint.value && handleClosePath({ x: props.mouse.x, y: props.mouse.y }) && props.pathLayer.points.length >= 3) {
            emitEvent('pen:path-state', true);
        }
        reset(false, true, {drag: true})
        updateBezierControls();
        draw();
        register('remove', canvas.value, 'pointerup', onPointerUp);
        register('remove', canvas.value, 'pointermove', onPointerMove);
    };

    // Wrapper-Click für Deselect
    const onWrapperClick = (e) => {
        if (canvas.value && wrapper.value && wrapper.value?.contains(e.target) && e.target !== canvas.value){
            reset(true)
            updateBezierControls(true);
            draw();
            register('remove', canvas.value, 'pointerup', onPointerUp);
            register('remove', canvas.value, 'pointermove', onPointerMove);
        }
    };

    // Canvas initialisieren (Größe setzen, Kontext holen)
    const initCanvas = () => {
        if (!canvas.value || !wrapper.value) return;
        const el = canvas.value;
        const { width, height } = props.viewport;
        Object.assign(el, { width, height });
        ctx.value = el.getContext('2d');
        Object.assign(ctx.value, { lineCap: 'round', lineJoin: 'round' });
        draw();
    };

    // Canvas initialisieren (Größe setzen, Kontext holen)
    const reset = (force = false, pointer = false, state = {}) => {
        if(force || state.anchor) anchorMenu.visible = false;
        if(force || state.drag) draggingNewPoint.value = false;
        if(force || pointer) {
            anchorMenu.selectedAnchor = null;
            draggedAnchor.value = null;
            draggedPointIdx.value = null;
            draggedControlPoint.value = null;
            previousMid.value = null;
            cpOffsets.value = null;
        }
    };

    const cancel = () => {
        emitEvent('path:reset', false)
        resetCanvas()
    };

    const resetCanvas = () => {
        if (!ctx.value || !canvas.value) return;

        const w = canvas.value.width;
        const h = canvas.value.height;

        ctx.value.clearRect(0, 0, w, h);
    };

    const handlePath = (payload) => {
        if (payload.edit) {
            props.pathLayer.closed = false;
            props.pathLayer.edit = true;
            emitEvent('path:edit', true)
            emitEvent('path:lock', false)
        } else {
            props.pathLayer.closed = true;
            props.pathLayer.edit = false;

            if (props.pathLayer.points.length >= 3) {
                const first = props.pathLayer.points[0];
                const lastIndex = props.pathLayer.points.length - 1;
                const last = props.pathLayer.points[lastIndex];

                const alreadyClosed = props.pathLayer.connections.some(
                    ([a, b]) => a === lastIndex && b === 0
                );

                if (!alreadyClosed) {
                    props.pathLayer.connections.push([lastIndex, 0]);
                }

                // Pulse am ersten Punkt auslösen
                first.pulseAt = Date.now();

                // Anker vorbereiten (falls nicht vorhanden)
                if (!first.anchor) {
                    first.anchor = {
                        start: { x: first.x, y: first.y },
                        end: { x: first.x, y: first.y },
                        neighbors: {}
                    };
                }
                if (!last.anchor) {
                    last.anchor = {
                        start: { x: last.x, y: last.y },
                        end: { x: last.x, y: last.y },
                        neighbors: {}
                    };
                }

                updatePathLayer();
                reset(true)
                draw();

                emitEvent('path:edit', false)
                emitEvent('path:lock', true)
            }
        }
        emitEvent('pen:path-state', false)
    };


    onMounted(() => {
        wrapper.value = document.querySelector('.viewport-wrapper')
        initCanvas();
        loadAnchorMenuFromSelection();
        register('add', document, 'resize', initCanvas);
        register('add', wrapper.value, 'click', onWrapperClick);
        register('add', canvas.value, 'pointerdown', onPointerDown);
        register('pause');
    });

    onBeforeUnmount(() => {
        register('remove', document, 'resize', initCanvas);
    });

    return {
        canvas,
        config,
        pointsLength,
        anchorMenu,
        cancel,
        handlePath,
        emitEvent
    };
}

export const penProps = {
    state: { type: Boolean, required: true },
    pathState: { type: Boolean, required: true },
    pathImport: { type: Boolean, required: true },
    viewport: { type: Object, required: true },
    pathLayer: { type: Object, required: true },
    loading: { type: Boolean, required: true },
    theme: { type: String, required: true },
    mouse: { type: Object, required: true },
    bezier: { type: String, required: true },
};
