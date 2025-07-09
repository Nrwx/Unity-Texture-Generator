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

    const updatePathLayer = () => {
        // props.pathLayer ist das reactive-Object von außen
        const layer = props.pathLayer;
        layer.points     = JSON.parse(JSON.stringify(points));
        layer.connections= JSON.parse(JSON.stringify(connections));
        layer.closed     = !!layer.pathClosed;
        layer.edit       = !!layer.pathEdit;
        // gib die aktualisierten Daten nach außen
        emit('layer:path', layer);
    };

    const closePath = (pos) => {
        const hitIdx = findPointAtPos(pos);

        // Nur schließen, wenn mehr als 2 Punkte existieren und auf Punkt 0 geklickt wurde
        if (points.length > 1 && hitIdx === 0) {
            const first = points[0];
            const last  = points[points.length - 1];

            // 1. Letzten Punkt auf Position von erstem setzen
            last.x = first.x;
            last.y = first.y;

            // 2. Anker synchronisieren (Position & Struktur)
            if (last.anchor && first.anchor) {
                last.anchor.start = { ...first.anchor.start };
                last.anchor.end   = { ...first.anchor.end };

                // Erstellt gegenseitige Nachbarschaft, falls sie fehlt
                const firstIdx = 0;
                const lastIdx  = points.length - 1;

                if (!first.anchor.neighbors[lastIdx]) {
                    first.anchor.neighbors[lastIdx] = { mid: { x: first.x, y: first.y } };
                }

                if (!last.anchor.neighbors[firstIdx]) {
                    last.anchor.neighbors[firstIdx] = { mid: { x: last.x, y: last.y } };
                }
            }

            // 3. Bezier-Kontrollpunkte kopieren (optional)
            if (last.bezier && first.bezier) {
                last.bezier.cp1 = { ...first.bezier.cp1 };
                last.bezier.cp2 = { ...first.bezier.cp2 };
            }

            // 4. Status aktualisieren
            props.pathLayer.pathClosed = true;
            props.pathLayer.pathEdit   = false;

            updatePathLayer();
            return true;
        }

        return false;
    };



    // Shortcut: Alt + Linksklick auf Hauptpunkt → Linie statt Bezier
    const handleAltClick = (e) => {
        const pos = getMousePos(e);
        const idx = findPointAtPos(pos);
        if (idx === -1) return;
        const p = points[idx];

        p.linear = !p.linear;

        if (p.linear) {
            // Bezier-Daten löschen
            p.bezier = null;
            anchorMenu.visible = false;
        } else {
            // Wenn nicht linear → Menü öffnen (falls Nachbarn vorhanden)
            const selected = points.find(p => p.selected);
            if (selected) {
                const idxSelected = points.indexOf(selected);
                const idxP = idx;
                const neighbor = idxSelected !== idxP ? selected : points[idxP + 1] || points[idxP - 1];

                if (neighbor) {
                    anchorMenu.visible = true;
                    anchorMenu.points = [p, neighbor];
                    anchorMenu.midPoint = calcMidAnchorPoint(p, neighbor);
                    updateBezierControls(true);
                }
            }
        }

        draw(); // Aktualisiere die Darstellung
    };



    // Shortcut: Strg + Rechtsklick auf Hauptpunkt → Punkt löschen
    const handleCtrlRightClick = (e) => {
        const pos = getMousePos(e);
        const idx = findPointAtPos(pos);
        if (idx !== -1) {
            if (anchorMenu.visible) {
                const affected = anchorMenu.points.some(p => points.indexOf(p) === idx);
                if (affected || anchorMenu.midPoint?.idx === idx || anchorMenu.selectedAnchor?.idx === idx) {
                    anchorMenu.visible = false;
                    anchorMenu.selectedAnchor = null;
                    anchorMenu.points = [];
                    anchorMenu.midPoint = null;
                    anchorMenu.anchorArms = { cp1: null, cp2: null };
                }
            }

            // Verbindungen löschen, die den Punkt enthalten
            for (let i = connections.length - 1; i >= 0; i--) {
                if (connections[i][0] === idx || connections[i][1] === idx) {
                    connections.splice(i, 1);
                }
            }

            // Punkt löschen
            points.splice(idx, 1);

            // Verbindungen anpassen (Indexshift)
            for (let i = 0; i < connections.length; i++) {
                connections[i][0] = connections[i][0] > idx ? connections[i][0] - 1 : connections[i][0];
                connections[i][1] = connections[i][1] > idx ? connections[i][1] - 1 : connections[i][1];
            }

            // Nachbarn updaten
            points.forEach((p) => {
                const newNeighbors = {};
                for (const [nbrIdxStr, data] of Object.entries(p.anchor.neighbors)) {
                    let nbrIdx = Number(nbrIdxStr);
                    if (nbrIdx === idx) continue;  // Gelöschter Nachbar weg
                    if (nbrIdx > idx) nbrIdx--;
                    newNeighbors[nbrIdx] = data;
                }
                p.anchor.neighbors = newNeighbors;
            });

            draw();
        }
    };


    // Anchor-Menus für die aktuell selektierte Verbindung
    const loadAnchorMenuFromSelection = () => {
        const sel = points.findIndex(p => p.selected);
        if (sel === -1) { anchorMenu.visible = false; return; }

        const conn = connections.find(([a, b]) => a === sel || b === sel);
        if (!conn) { anchorMenu.visible = false; return; }

        const [iA, iB] = conn;
        const pA = points[iA];
        const pB = points[iB];

        // Sicherheitsprüfung: könnten durch Punkt-Löschen undefiniert sein
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






    // Punkt-Auswahl und Suche
    const selectPoint = (idx) => {
        points.forEach((p, i) => p.selected = i === idx);
        loadAnchorMenuFromSelection();
        const p = points[idx];
        p.selected = true;
        p.pulseAt = Date.now();

        // 🔧 Direkt aktivieren, damit Bewegung sofort möglich ist
        draggedPointIdx = idx;
        draggedControlPoint = null;
        draggedAnchor = null;
        draw();
    };

    const findPointAtPos = (pos, radius = 8) => {
        return points.findIndex(p => {
            const dx = p.x - pos.x;
            const dy = p.y - pos.y;
            return dx * dx + dy * dy <= radius * radius;
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

        // Sicherheitscheck
        if (!pA || !pB || !mid) return;

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
            anchorMenu.anchorArms.cp1 = null;
            anchorMenu.anchorArms.cp2 = pB.bezier.cp1;
        }

        // Nur pA ist bezier
        else if (!aIsLinear && bIsLinear) {
            const dx = mid.x - pB.x;
            const dy = mid.y - pB.y;
            pA.bezier.cp2 = { x: mid.x + dx * 0.5, y: mid.y + dy * 0.5 };
            pB.bezier.cp1 = null;
            anchorMenu.anchorArms.cp1 = pA.bezier.cp2;
            anchorMenu.anchorArms.cp2 = null;
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

        if (pA.anchor?.neighbors) pA.anchor.neighbors[idxB].mid = { ...mid };
        if (pB.anchor?.neighbors) pB.anchor.neighbors[idxA].mid = { ...mid };
    };


    // Zeichnen des Canvas-Inhalts
    const draw = () => {
        if (!ctx.value) return;
        const c = ctx.value;
        const w = canvas.value.width;
        const h = canvas.value.height;

        c.clearRect(0, 0, w, h);

        // === 1) Pfade ===
        connections.forEach(([a, b]) => {
            const pA = points[a];
            const pB = points[b];
            if (!pA || !pB) return;

            if (pA.linear || pB.linear || !(pA.bezier?.cp2 && pB.bezier?.cp1)) {
                // Linie zeichnen
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.lineTo(pB.x, pB.y);
                c.strokeStyle = '#aaf';
                c.lineWidth = 1;
                c.stroke();
            } else {
                // Bezier zeichnen
                c.beginPath();
                c.moveTo(pA.x, pA.y);
                c.bezierCurveTo(
                    pA.bezier.cp2.x, pA.bezier.cp2.y,
                    pB.bezier.cp1.x, pB.bezier.cp1.y,
                    pB.x, pB.y
                );
                c.strokeStyle = '#6cf';
                c.lineWidth = 1.5;
                c.stroke();
            }
        });

        // === 2) Punkte ===
        points.forEach((p, i) => {
            const isStart = i === 0;
            const isEnd = i === points.length - 1;
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
        if (
            anchorMenu.visible &&
            anchorMenu.points.length === 2 &&
            anchorMenu.midPoint &&
            anchorMenu.points[0] && anchorMenu.points[1] &&
            typeof anchorMenu.points[0].x === 'number' &&
            typeof anchorMenu.points[0].y === 'number' &&
            typeof anchorMenu.points[1].x === 'number' &&
            typeof anchorMenu.points[1].y === 'number' &&
            typeof anchorMenu.midPoint.x === 'number' &&
            typeof anchorMenu.midPoint.y === 'number' &&
            (anchorMenu.points[0].selected || anchorMenu.points[1].selected)
        ) {
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



    // Event-Handler für Pointer (Maus/Touch)
    const onPointerDown = (e) => {
        if (!props.state) return;

        const pos = getMousePos(e);
        const ctrl = isCtrlPressed(e);

        // Komplett gesperrt: Pfad ist geschlossen und nicht editierbar
        if (props.pathLayer.pathClosed && !props.pathLayer.pathEdit) {
            return;
        }

        // Pointer-Zustände zurücksetzen
        draggedAnchor = null;
        draggedControlPoint = null;
        draggedPointIdx = null;
        anchorMenu.selectedAnchor = null;
        previousMid = null;
        cpOffsets = null;

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

        // Strg gedrückt: Anker-/Kontrollpunkt-Modus
        if (ctrl) {
            if (anchorMenu.visible && anchorMenu.points?.length >= 2) {
                const [pA, pB] = anchorMenu.points;

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

        // Punkt hinzufügen: Entweder erster Punkt oder Anfang/Ende ist ausgewählt
        const isFirstPoint = points.length === 0;
        const selectedPts = points.filter(p => p.selected);
        const isOnlyOneSel = selectedPts.length === 1;
        const isStartSel = isOnlyOneSel && points[0].selected;
        const isEndSel = isOnlyOneSel && points[points.length - 1].selected;

        if (isFirstPoint || isStartSel || isEndSel) {
            const newPoint = {
                x: pos.x,
                y: pos.y,
                selected: true,
                bezier: null,
                pulseAt: 0 | null,
                anchor: {
                    start: { x: pos.x, y: pos.y },
                    end: { x: pos.x, y: pos.y },
                    neighbors: {}
                }
            };

            // Vorherige Auswahl aufheben
            points.forEach(p => p.selected = false);

            if (isFirstPoint || isEndSel) {
                points.push(newPoint);
                if (!isFirstPoint) {
                    connections.push([points.length - 2, points.length - 1]);
                }
            } else {
                points.unshift(newPoint);
                connections.forEach(c => {
                    c[0]++;
                    c[1]++;
                });
                connections.unshift([0, 1]);
            }

            // Verbindung herstellen und Mid-Anchor berechnen
            if (points.length > 1) {
                const pA = isStartSel ? points[0] : points[points.length - 2];
                const pB = isStartSel ? points[1] : points[points.length - 1];

                if (!pA || !pB || !pA.anchor || !pB.anchor) return;

                anchorMenu.visible = true;
                anchorMenu.points = [pA, pB];
                anchorMenu.selectedAnchor = null;

                const idxA = points.indexOf(pA);
                const idxB = points.indexOf(pB);

                if (!pA.anchor.neighbors[idxB]) {
                    pA.anchor.neighbors[idxB] = { mid: calcMidAnchorPoint(pA, pB) };
                }
                if (!pB.anchor.neighbors[idxA]) {
                    pB.anchor.neighbors[idxA] = { mid: calcMidAnchorPoint(pA, pB) };
                }

                const mA = pA.anchor.neighbors[idxB].mid;
                const mB = pB.anchor.neighbors[idxA].mid;

                anchorMenu.midPoint = {
                    x: (mA.x + mB.x) / 2,
                    y: (mA.y + mB.y) / 2
                };

                draggingNewPoint = true;
                updateBezierControls();
            } else {
                anchorMenu.visible = false;
                draggingNewPoint = false;
            }

            register('add', document, 'pointerup', onPointerUp)
            draw();
            return;
        }

        // Nichts ausgewählt: Auswahl aufheben und Anker-Menü verbergen
        points.forEach(p => p.selected = false);
        anchorMenu.visible = false;
        draw();
        register('add', document, 'pointerup', onPointerUp)
    };


    const onPointerMove = (e) => {
        if (!props.state) return;
        const pos = getMousePos(e);
        const ctrl = isCtrlPressed(e);

        // 1) Neuer Punkt Drag
        if (draggingNewPoint) {
            if (!anchorMenu.points || anchorMenu.points.length < 2) return;
            const [pA, pB] = anchorMenu.points;
            const idxA = points.indexOf(pA);
            const idxB = points.indexOf(pB);
            if (idxA === -1 || idxB === -1) return;

            const mid = calcMidAnchorPoint(pA, pos);

            anchorMenu.midPoint = mid;
            pA.anchor.neighbors[idxB].mid = { ...mid };
            pB.anchor.neighbors[idxA].mid = { ...mid };

            updateBezierControls(true);
            draw();
            if (closePath(pos)) {
                draw();
            }
        }

        // 2) Punkt verschieben
        if (ctrl && draggedPointIdx !== null && !draggedControlPoint && !draggedAnchor) {
            const p = points[draggedPointIdx];
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

                const nb = points[Number(nbrIdx)];
                if (nb?.anchor?.neighbors?.[draggedPointIdx]) {
                    nb.anchor.neighbors[draggedPointIdx].mid.x += dx;
                    nb.anchor.neighbors[draggedPointIdx].mid.y += dy;
                }
            });

            if (anchorMenu.points?.length >= 2 && anchorMenu.points.includes(p)) {
                const [pA, pB] = anchorMenu.points;
                if (!pA || !pB) return;

                const mA = pA.anchor.neighbors[points.indexOf(pB)]?.mid;
                const mB = pB.anchor.neighbors[points.indexOf(pA)]?.mid;
                if (!mA || !mB) return;

                anchorMenu.midPoint = {
                    x: (mA.x + mB.x) / 2,
                    y: (mA.y + mB.y) / 2
                };

                updateBezierControls();
            }

            draw();
            return;
        }

        // 3) Kontrollpunkt verschieben
        if (draggedControlPoint) {
            if (!anchorMenu.points || anchorMenu.points.length < 2) return;
            const [pA, pB] = anchorMenu.points;
            if (pA?.linear || pB?.linear) {
                anchorMenu.visible = false;
                return;
            }

            anchorMenu.visible = true;

            const { point, control } = draggedControlPoint;
            const bez = point.bezier?.[control];
            if (!bez) return;

            const neighbor = anchorMenu.points.find(p => p !== point);
            if (!neighbor) return;

            const idxP = points.indexOf(point);
            const idxN = points.indexOf(neighbor);
            if (idxP === -1 || idxN === -1) return;
            if (!point.anchor?.neighbors?.[idxN] || !neighbor.anchor?.neighbors?.[idxP]) return;

            const dx = pos.x - bez.x;
            const dy = pos.y - bez.y;

            bez.x = pos.x;
            bez.y = pos.y;

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
            return;
        }

        // 4) Anker verschieben
        if (!anchorMenu.visible || !draggedAnchor || !anchorMenu.points || anchorMenu.points.length < 2) return;
        const [pA, pB] = anchorMenu.points;
        if (!pA || !pB || pA.linear || pB.linear) {
            anchorMenu.visible = false;
            return;
        }

        const idxA = points.indexOf(pA);
        const idxB = points.indexOf(pB);

        if (draggedAnchor === 'mid') {
            if (!anchorMenu.midPoint) return;

            if (!previousMid) {
                previousMid = { ...anchorMenu.midPoint };
                cpOffsets = {
                    offsetA: {
                        x: (pA?.bezier?.cp2?.x ?? 0) - previousMid.x,
                        y: (pA?.bezier?.cp2?.y ?? 0) - previousMid.y
                    },
                    offsetB: {
                        x: (pB?.bezier?.cp1?.x ?? 0) - previousMid.x,
                        y: (pB?.bezier?.cp1?.y ?? 0) - previousMid.y
                    }
                };
            }

            if (!cpOffsets) return;

            const newMid = { x: pos.x, y: pos.y };
            anchorMenu.midPoint = newMid;

            if (pA.anchor?.neighbors?.[idxB]) pA.anchor.neighbors[idxB].mid = { ...newMid };
            if (pB.anchor?.neighbors?.[idxA]) pB.anchor.neighbors[idxA].mid = { ...newMid };

            const aIsLinear = pA.linear === true;
            const bIsLinear = pB.linear === true;

            if (pA?.bezier && cpOffsets.offsetA) {
                let offsetAx = cpOffsets.offsetA.x;
                let offsetAy = cpOffsets.offsetA.y;
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

            if (pB?.bezier && cpOffsets.offsetB) {
                let offsetBx = cpOffsets.offsetB.x;
                let offsetBy = cpOffsets.offsetB.y;
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
            return;
        }

        if (draggedAnchor === 'start') {
            pA.anchor.start = { ...pos };
            pA.x = pos.x;
            pA.y = pos.y;
            updateBezierControls();
            draw();
            return;
        }

        if (draggedAnchor === 'end') {
            pB.anchor.end = { ...pos };
            pB.x = pos.x;
            pB.y = pos.y;
            updateBezierControls();
            draw();
            return;
        }
    };


    const onPointerUp = (e) => {
        const pos = getMousePos(e);

        if (closePath(pos)) {
            draw();
            console.log('CLOSED')
        }

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
    pathLayer: { type: Object, required: true },
};
