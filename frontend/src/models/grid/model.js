import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import {uuid} from "@/utils/uuid";
import {eventRegister} from "@/dataLayer/event";

export function gridModel(props, emit) {

    const grid = ref({
        wrapper: {
            id: uuid(),
            ref: null,
            width: 0,
            height: 0
        },
        main: {
            id: uuid(),
            ref: null
        },
        container: {
            id: props.canvasId,
            ref: null,
            matrix: {a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, rotate: 0},
            style: computed(() => ({
                width: `${props.settings.width}px`,
                height: `${props.settings.height}px`,
                transform: `matrix(${grid.value.container.matrix.a}, ${grid.value.container.matrix.b}, ${grid.value.container.matrix.c}, ${grid.value.container.matrix.d}, ${grid.value.container.matrix.x}, ${grid.value.container.matrix.y}) rotate(${grid.value.container.matrix.rotate}deg)`,
                transformOrigin: "center center",
            }))
        }
    })

    const cursor = ref({ x: 0, y: 0 });
    const lastMouse = ref({x: 0, y: 0})
    const resizeDirection = ref('');
    const rotationStartAngle = ref(0);
    const fineSnapAngle = 360 / 64; // 5.625° pro Schritt
    const alignModeStep = ref(0);

    const resizeCycleIndex = ref(0);

    const resizeDirections = [
        'top-left',
        'top',
        'top-right',
        'right',
        'bottom-right',
        'bottom',
        'bottom-left',
        'left'
    ];

    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 8;
    const ZOOM_CLICK_STEP = 1.15;
    const ZOOM_SCRUB_SPEED = 0.01;

    const isZoomScrubbing = ref(false);
    const zoomDrag = ref({
        x: 0,
        y: 0,
        scale: 1
    });


    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const anchorPoint = ref({ x: 0.5, y: 0.5 });
    const anchorScreen = computed(() => {
        const box = frameBox.value;

        if (!box.width || !box.height) {
            return { x: 0, y: 0 };
        }

        const world = getAnchorWorld();
        return worldToScreen(world.x, world.y);
    });

    const isDraggingAnchor = ref(false);
    const rotationPivot = ref(null);

    const syncAnchorToSelection = () => {
        if (!props.selectedLayer.length) return;

        anchorPoint.value = { x: 0.5, y: 0.5 };
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const { register } = eventRegister('listener:grid', emitEvent);

    const cycleAlignMode = (e) => {
        if (props.layerStates.align.value) {
            alignModeStep.value = (alignModeStep.value + 1) % 3;
            emitEvent('apply-key-down', e)
            emitEvent('apply-key-up', e)
        } else {
            alignModeStep.value = 0;
        }
    };

    const getAnchorWorld = () => {
        const box = frameBox.value;
        return {
            x: box.left + box.width * anchorPoint.value.x,
            y: box.top + box.height * anchorPoint.value.y
        };
    };

    const screenToWorld = (clientX, clientY) => {
        const rect = grid.value.container.ref.getBoundingClientRect();

        const cx = rect.width / 2;
        const cy = rect.height / 2;

        let x = clientX - rect.left - cx;
        let y = clientY - rect.top - cy;

        const s = grid.value.container.matrix.a ||grid.value.container.matrix.d;
        x /= s;
        y /= s;

        const a = (-grid.value.container.matrix.rotate * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);

        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;

        return {
            x: rx + cx - grid.value.container.matrix.x,
            y: ry + cy - grid.value.container.matrix.y
        };
    };

    const worldToScreen = (x, y) => {
        const rect = grid.value.container.ref.getBoundingClientRect();

        const cx = rect.width / 2;
        const cy = rect.height / 2;

        let sx = x - cx + grid.value.container.matrix.x;
        let sy = y - cy + grid.value.container.matrix.y;

        const a = (grid.value.container.matrix.rotate * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);

        const rx = sx * cos - sy * sin;
        const ry = sx * sin + sy * cos;

        const s = grid.value.container.matrix.a ||grid.value.container.matrix.d;
        sx = rx * s;
        sy = ry * s;

        return {
            x: sx + cx,
            y: sy + cy
        };
    };

    const setZoomAt = (clientX, clientY, nextScale) => {
        const rect = grid.value.container.ref.getBoundingClientRect();

        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const m = grid.value.container.matrix;

        const px = clientX - rect.left - cx;
        const py = clientY - rect.top - cy;

        const world = screenToWorld(clientX, clientY);

        const rot = (m.rotate * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);

        const invX = px * cos + py * sin;
        const invY = -px * sin + py * cos;

        m.a = nextScale;
        m.d = nextScale;

        m.x = cx + invX / nextScale - world.x;
        m.y = cy + invY / nextScale - world.y;
    };

    const zoomByStep = (clientX, clientY, direction = 1) => {
        const current = grid.value.container.matrix.a || 1;
        const factor = direction > 0 ? ZOOM_CLICK_STEP : 1 / ZOOM_CLICK_STEP;
        const next = clamp(current * factor, MIN_ZOOM, MAX_ZOOM);
        setZoomAt(clientX, clientY, next);
    };

    const zoomMouseMove = (event) => {
        if (!isZoomScrubbing.value) return;

        const dy = zoomDrag.value.y - event.clientY;
        const next = clamp(
            zoomDrag.value.scale * Math.exp(dy * ZOOM_SCRUB_SPEED),
            MIN_ZOOM,
            MAX_ZOOM
        );

        setZoomAt(zoomDrag.value.x, zoomDrag.value.y, next);
    };

    const stopZoomScrub = () => {
        isZoomScrubbing.value = false;
        register('remove', window, 'mousemove', zoomMouseMove);
        register('remove', window, 'mouseup', stopZoomScrub);
    };

    const mouseMove = async (event) => {
        if (isDraggingAnchor.value) {
            const world = screenToWorld(event.clientX, event.clientY);
            const box = frameBox.value;

            anchorPoint.value = {
                x: (world.x - box.left) / box.width,
                y: (world.y - box.top) / box.height
            };

            // clamp (optional aber sinnvoll)
            anchorPoint.value.x = Math.max(0, Math.min(1, anchorPoint.value.x));
            anchorPoint.value.y = Math.max(0, Math.min(1, anchorPoint.value.y));

            return;
        }
        const current = screenToWorld(event.clientX, event.clientY);
        const previous = screenToWorld(lastMouse.value.x, lastMouse.value.y);

        const dx = current.x - previous.x;
        const dy = current.y - previous.y;

        cursor.value.x = Math.round(current.x);
        cursor.value.y = Math.round(current.y);

        if (props.layerStates.translate.value) {
            const mainRect = grid.value.main.ref.getBoundingClientRect();
            const containerRect = grid.value.container.ref.getBoundingClientRect();
            const containerX = containerRect.left - mainRect.left;
            const containerY = containerRect.top - mainRect.top;
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;

            const hasGuides = props.guides && props.guides.length > 0;

            let newX = frameBox.value.left + dx + containerX;
            let newY = frameBox.value.top + dy + containerY;

            const width = frameBox.value.width;
            const height = frameBox.value.height;

            if (hasGuides) {
                const edgesX = {
                    left: newX,
                    center: newX + width / 2,
                    right: newX + width
                };
                const edgesY = {
                    top: newY,
                    center: newY + height / 2,
                    bottom: newY + height
                };

                const verticalGuides = Array.from(new Set([
                    ...props.guides
                        .filter(g => g.type === 'vertical')
                        .map(g => g.position),
                    containerX,
                    containerX + containerWidth / 2,
                    containerX + containerWidth
                ])).sort((a, b) => a - b);

                const horizontalGuides = Array.from(new Set([
                    ...props.guides
                        .filter(g => g.type === 'horizontal')
                        .map(g => g.position),
                    containerY,
                    containerY + containerHeight / 2,
                    containerY + containerHeight
                ])).sort((a, b) => a - b);

                const guideIntersections = [];
                for (const x of verticalGuides) {
                    for (const y of horizontalGuides) {
                        guideIntersections.push({ x, y });
                    }
                }

                const SNAP_TOLERANCE = 8;

                let bestSnapDeltaX = 0;
                let bestSnapDistanceX = Infinity;
                let bestSnapDeltaY = 0;
                let bestSnapDistanceY = Infinity;

                for (const intersection of guideIntersections) {
                    for (const keyX in edgesX) {
                        const deltaX = intersection.x - edgesX[keyX];
                        if (Math.abs(deltaX) <= SNAP_TOLERANCE && Math.abs(deltaX) < bestSnapDistanceX) {
                            bestSnapDistanceX = Math.abs(deltaX);
                            bestSnapDeltaX = deltaX;
                        }
                    }
                    for (const keyY in edgesY) {
                        const deltaY = intersection.y - edgesY[keyY];
                        if (Math.abs(deltaY) <= SNAP_TOLERANCE && Math.abs(deltaY) < bestSnapDistanceY) {
                            bestSnapDistanceY = Math.abs(deltaY);
                            bestSnapDeltaY = deltaY;
                        }
                    }
                }

                newX += bestSnapDeltaX;
                newY += bestSnapDeltaY;
            }

            newX -= containerX;
            newY -= containerY;

            const offsetX = Math.round(newX - frameBox.value.left);
            const offsetY = Math.round(newY - frameBox.value.top);

            props.selectedLayer.forEach(layer => {
                if (props.layerStates.align.value) {
                    if (alignModeStep.value === 1) {
                        layer.matrix.x = (layer.matrix.x ?? 0) + offsetX;
                    } else if (alignModeStep.value === 2) {
                        layer.matrix.y = (layer.matrix.y ?? 0) + offsetY;
                    } else {
                        layer.matrix.x = (layer.matrix.x ?? 0) + offsetX;
                        layer.matrix.y = (layer.matrix.y ?? 0) + offsetY;
                    }
                } else {
                    layer.matrix.x = (layer.matrix.x ?? 0) + offsetX;
                    layer.matrix.y = (layer.matrix.y ?? 0) + offsetY;
                }
            });
        } else if (props.containerStates.translate.value) {
            const dx = event.clientX - lastMouse.value.x;
            const dy = event.clientY - lastMouse.value.y;
            grid.value.container.matrix.x += dx;
            grid.value.container.matrix.y += dy;
        } else if (props.containerStates.rotate.value || props.layerStates.rotate.value) {
            await rotate(event);
        } else if (props.layerStates.scale.value) {
            const start = screenToWorld(
                resizeStartMouse.value.x,
                resizeStartMouse.value.y
            );

            const dxAbs = current.x - start.x;
            const dyAbs = current.y - start.y;

            await resize(dxAbs, dyAbs);
        }

        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
    };

    const startRotate = async (direction, event) => {
        emitEvent('layer:transform-menu', true)
        emitEvent('layer:rotate', true)

        rotationPivot.value = getAnchorWorld();
        rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);

        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;

        register('add', window, 'mouseup', stopTransform);
    };


    const calculateRotation = (mouseX, mouseY) => {
        if (!props.selectedLayer.length) return 0;

        const mouse = screenToWorld(mouseX, mouseY);
        const pivot = getAnchorWorld();

        const angle = Math.atan2(mouse.y - pivot.y, mouse.x - pivot.x);
        return angle * (180 / Math.PI);
    };

    const getSnappedAngle = (angle) => {
        const remainder = angle % fineSnapAngle;
        if (remainder < fineSnapAngle / 2) {
            return angle - remainder;
        } else {
            return angle + (fineSnapAngle - remainder);
        }
    };

    const getRect = (target) => {
        let el = target;
        if (typeof target === 'string') {
            el = document.querySelector(target);
        }
        if (!el || !el.getBoundingClientRect) {
            return null;
        }
        return el.getBoundingClientRect();
    };

    const rotate = async (event) => {
        emitEvent('backup:action', 'Bild Rotieren')
        event.preventDefault();

        const crossHairRect = getRect('.center-crosshair');
        const centerX = crossHairRect.left + crossHairRect.width / 2;
        const centerY = crossHairRect.top + crossHairRect.height / 2;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const dampingFactor = Math.min(1, distance / 100);

        const currentAngle = calculateRotation(event.clientX, event.clientY);
        let deltaAngle = currentAngle - rotationStartAngle.value;

        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;

        deltaAngle *= dampingFactor;

        if (props.selectedLayer.length) {
            props.selectedLayer.forEach(layer => {
                let newRotation = (layer.matrix.rotate + deltaAngle + 360) % 360;

                if (props.layerStates.align.value) {
                    newRotation = getSnappedAngle(newRotation);
                }

                layer.matrix.rotate = parseFloat(newRotation.toFixed(2));
            });
        } else {
            let newRotation = (grid.value.container.matrix.rotate + deltaAngle + 360) % 360;

            if (props.containerStates.align?.value) {
                newRotation = getSnappedAngle(newRotation);
            }

            grid.value.container.matrix.rotate = parseFloat(newRotation.toFixed(2));
        }

        rotationStartAngle.value = currentAngle;
    };

    const startAnchorDrag = (event) => {
        event.preventDefault();
        event.stopPropagation();

        isDraggingAnchor.value = true;
        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;

        register("add", window, "mouseup", stopAnchorDrag);
    };

    const stopAnchorDrag = () => {
        isDraggingAnchor.value = false;
        register("remove", window, "mouseup", stopAnchorDrag);
    };

    const resizeStartMouse = ref({ x: 0, y: 0 });

    const PADDING = 20;

    const resizeDirectionAnchor = (corner) => {
        let px = 0.5;
        let py = 0.5;
        if (corner.includes('left')) px = PADDING / frameBox.value.width;
        if (corner.includes('right')) px = 1 - (PADDING / frameBox.value.width);
        if (corner.includes('top')) py = PADDING / frameBox.value.height;
        if (corner.includes('bottom')) py = 1 - (PADDING / frameBox.value.height);

        anchorPoint.value = { x: px, y: py };
    };

    const startResize = async (corner, event) => {
        emitEvent('layer:transform-menu', true);
        emitEvent('layer:scale', true);

        resizeDirection.value = corner;
        resizeDirectionAnchor(corner);

        resizeStartMouse.value.x = event.clientX;
        resizeStartMouse.value.y = event.clientY;

        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;

        props.selectedLayer.forEach(layer => {
            storeLayer(layer);
        });

        register('add', window, 'mouseup', stopTransform);
    };

    const MIN_SIZE = 2;

    const resize = async (dx, dy) => {
        emitEvent('backup:action', 'Bild Skalieren');

        const dir = resizeDirection.value;

        const fromLeft = dir.includes('left');
        const fromRight = dir.includes('right');
        const fromTop = dir.includes('top');
        const fromBottom = dir.includes('bottom');

        props.selectedLayer.forEach(layer => {
            const start = layer.__originalMatrix || layer.matrix;

            const width = layer.width;
            const height = layer.height;

            const deltaW = fromLeft ? -dx : fromRight ? dx : 0;
            const deltaH = fromTop ? -dy : fromBottom ? dy : 0;

            let targetWidth = width + deltaW;
            let targetHeight = height + deltaH;

            targetWidth = Math.max(MIN_SIZE, targetWidth);
            targetHeight = Math.max(MIN_SIZE, targetHeight);

            let scaleX = targetWidth / width;
            let scaleY = targetHeight / height;

            if (props.layerStates.align.value) {
                const uniform = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                scaleX = scaleX < 0 ? -uniform : uniform;
                scaleY = scaleY < 0 ? -uniform : uniform;
            }

            const newWidth = width * scaleX;
            const newHeight = height * scaleY;

            layer.matrix.a = start.a * scaleX;
            layer.matrix.d = start.d * scaleY;

            if (props.layerStates.align.value) {
                layer.matrix.x = start.x;
                layer.matrix.y = start.y;
            } else {
                const shiftX =
                    fromLeft && !fromRight ? (width - newWidth) / 2 :
                        fromRight && !fromLeft ? (newWidth - width) / 2 :
                            0;

                const shiftY =
                    fromTop && !fromBottom ? (height - newHeight) / 2 :
                        fromBottom && !fromTop ? (newHeight - height) / 2 :
                            0;

                layer.matrix.x = start.x + shiftX;
                layer.matrix.y = start.y + shiftY;
            }
        });
    };

    const resetSelection = (event) => {
        if (props.brush || props.timeline) return;
        event.preventDefault();
        if (!grid.value.container.ref.contains(event.target) && !event.ctrlKey
            || !props.layerStates.menu.value && !props.layerStates.translate.value && !event.ctrlKey
            || !props.layerStates.menu.value && !props.layerStates.rotate.value && !event.ctrlKey
            || !props.layerStates.menu.value && !props.layerStates.scale.value && !event.ctrlKey) {
            stopTransform()
            props.selectedLayer.forEach(layer => {
                updateLayer(layer)
            })

            props.selectedLayer = [];
            emitEvent('layer:select', [])
        }
    };

    const onPositionUpdate = ({ x, y }) => {
        grid.value.container.matrix.x = x;
        grid.value.container.matrix.y = y;
    };

    const onScaleUpdate = (scale) => {
        grid.value.container.matrix.a = scale
        grid.value.container.matrix.d = scale
    };

    const onRotationUpdate = (rot) => {
        grid.value.container.matrix.rotate = rot;
    };

    const onReset = () => {
        grid.value.container.matrix = {a: 1, b: 0, c: 0, d: 1, x: 0, y: 0, rotate: 0}
    };

    const layerChanged = (a, b) => {
        if (!a || !b) return false;

        for (const key in a) {
            if (a[key] !== b[key]) {
                return true;
            }
        }

        return false;
    };

    const storeLayer = (layer) => {
        layer.__originalMatrix = {
            a: layer.matrix.a,
            b: layer.matrix.b,
            c: layer.matrix.c,
            d: layer.matrix.d,
            x: layer.matrix.x,
            y: layer.matrix.y,
            rotate: layer.matrix.rotate
        };
    };

    const updateLayer = (layer) => {
        const check = layerChanged(layer.__originalMatrix, layer.matrix)
        if (check) {
            emitEvent("backup:create-global", {id: layer.id, state: layer, title: props.backup});
            emitEvent('update-layer', layer);
            console.log('Layer aktualisiert');
        } else {
            console.log('Layer unverändert');
        }
    };

    const toggleSelection = (layer, event) => {
        event.preventDefault();
        emitEvent('reset:layer-states', false)
        const data = props.selectedLayer;
        const index = data.findIndex(l => l.id === layer.id);
        storeLayer(layer);
        if (event.ctrlKey) {
            if (index === -1) {
                storeLayer(layer);
                data.push(layer);
                emitEvent('layer:select', data);
            } else {
                data.splice(index, 1);
                emitEvent('layer:select', data);
            }
        } else {
            storeLayer(layer);
            emitEvent('layer:select',[layer]);
        }
        syncAnchorToSelection();
    };

    const mouseDown = (event) => {
        event.preventDefault();
        if (props.containerStates.scale.value) {
            if (event.button === 0 || event.button === 2) {
                event.preventDefault();

                const zoomOut = event.button === 2 || event.altKey;
                zoomByStep(event.clientX, event.clientY, zoomOut ? -1 : 1);

                isZoomScrubbing.value = true;
                zoomDrag.value = {
                    x: event.clientX,
                    y: event.clientY,
                    scale: grid.value.container.matrix.a || 1
                };

                register('add', window, 'mousemove', zoomMouseMove);
                register('add', window, 'mouseup', stopZoomScrub);
            }
            return;
        }
        resetSelection(event);
    };

    const stopTransform = () => {
        register('remove', window, 'mouseup', stopTransform);
        alignModeStep.value = 0;
        rotationPivot.value = null;
        if (props.timeline || props.timelineRecord) emitEvent("timeline:set-keyframe");
        emitEvent('reset:layer-states', false);
        emitEvent('reset:container-states', false);
    };

    const getResizeDirection = (clientX, clientY) => {
        const box = frameBox.value;
        const mouse = screenToWorld(clientX, clientY);

        const left = box.left;
        const right = box.left + box.width;
        const top = box.top;
        const bottom = box.top + box.height;

        const distances = {
            left: Math.abs(mouse.x - left),
            right: Math.abs(mouse.x - right),
            top: Math.abs(mouse.y - top),
            bottom: Math.abs(mouse.y - bottom)
        };

        return Object.entries(distances)
            .sort((a, b) => a[1] - b[1])[0][0];
    };

    const frameBox = computed(() => {
        const layers = props.selectedLayer;
        if (!layers.length) return { top: 0, left: 0, width: 0, height: 0 };

        const allPoints = layers.flatMap(layer => {
            const matrix = layer.matrix || {};
            const rotate = (matrix.rotate || 0) * (Math.PI / 180);
            const scaleX = matrix.a ?? 1;
            const scaleY = matrix.d ?? 1;
            const posX = matrix.x ?? 0;
            const posY = matrix.y ?? 0;

            const width = layer.width;
            const height = layer.height;

            const cx = width / 2;
            const cy = height / 2;

            const cos = Math.cos(rotate);
            const sin = Math.sin(rotate);

            const rotatePoint = (x, y) => {
                const dx = x - cx;
                const dy = y - cy;

                const rx = dx * cos - dy * sin + cx;
                const ry = dx * sin + dy * cos + cy;
                return { x: rx, y: ry };
            };

            const rotatedCorners = [
                rotatePoint(0, 0),
                rotatePoint(width, 0),
                rotatePoint(0, height),
                rotatePoint(width, height)
            ];

            const scaledCorners = rotatedCorners.map(p => ({
                x: p.x * scaleX,
                y: p.y * scaleY
            }));

            const centerScaledX = (width * scaleX) / 2;
            const centerScaledY = (height * scaleY) / 2;

            const offsetX = centerScaledX - cx;
            const offsetY = centerScaledY - cy;

            return scaledCorners.map(p => ({
                x: p.x + posX - offsetX,
                y: p.y + posY - offsetY
            }));
        });

        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    });

    const normalizeKey = (key) => {
        if (!key) return '';

        const k = key.toLowerCase();

        if (k === ' ') return 'Space';
        if (k === 'alt') return 'Alt';
        if (k === 'altgraph') return 'Alt';
        if (k === 'shift') return 'Shift';
        if (k === 'control') return 'Control';

        return k;
    };

    const keyDown = async (e) => {
        if (props.rule) return;
        e.preventDefault();
        const key = normalizeKey(e.key);

        if (key === 'Alt') {
            if(props.layerStates.scale.value){
                resizeCycleIndex.value = (resizeCycleIndex.value + 1) % resizeDirections.length;
                resizeDirection.value = resizeDirections[resizeCycleIndex.value];
                resizeDirectionAnchor(resizeDirection.value);
                emitEvent('layer:transform-direction', true);
                console.log(resizeCycleIndex.value, resizeDirection.value)
            }
            emitEvent('apply-key-down', e);
            return;
        }
        if (key === "Shift") {
            anchorPoint.value = {x: 0.5, y: 0.5};
            emitEvent('layer:transform-align', true)
            emitEvent('apply-key-down', e);
            return;
        }

        if (key === "g") {
            if (props.selectedLayer.length) {
                emitEvent('backup:action', 'Bild Transformieren')
                emitEvent('layer:translate', true)
            } else {
                emitEvent('grid:translate-state', true)
            }
            emitEvent('apply-key-down', e);
            return;
        }
        if (key === "w") {
            emitEvent('grid:select-state', !props.containerStates.select.value)
            emitEvent('apply-key-down', e);
            return;
        }
        if (key === "z") {
            emitEvent('grid:scale-state', !props.containerStates.scale.value)
            emitEvent('apply-key-down', e);
            return;
        }
        if (key === "r") {
            if (props.selectedLayer.length) {
                emitEvent('backup:action', 'Bild Rotieren')
                emitEvent('layer:rotate', true)
            } else {
                emitEvent('grid:rotate-state', true)
            }
            emitEvent('apply-key-down', e)
            return;
        }
        if (key === "s") {
            if (props.selectedLayer.length) {
                emitEvent('backup:action', 'Bild Skalieren');
                const direction = props.layerStates.direction.value ? resizeDirection.value : getResizeDirection(lastMouse.value.x, lastMouse.value.y);
                await startResize(direction, {
                    clientX: lastMouse.value.x,
                    clientY: lastMouse.value.y
                });
            }
            emitEvent('apply-key-down', e);
        }
    };

    const keyUp = (e) => {
        if (props.rule) return;
        e.preventDefault();
        const key = normalizeKey(e.key);
        if (key === "Shift") {
            if (props.layerStates.translate.value) {
                cycleAlignMode(e);
            } else {
                emitEvent('layer:transform-align', false);
                emitEvent('apply-key-up', e)
            }
            return;
        }
        if (key === 'Alt') {
            emitEvent('layer:transform-direction', false);
            emitEvent('apply-key-up', e);
            return;
        }

        if (key === "g") {
            if (props.timeline || props.timelineRecord) emitEvent("timeline:set-keyframe");
            stopTransform(e);
            emitEvent('apply-key-up', e)
            return;
        }
        if (key === "z") {
            emitEvent('grid:scale-state', false);
            emitEvent('apply-key-up', e)
            return;
        }
        if (key === "s") {
            stopTransform(e);
            emitEvent('apply-key-up', e);
            return;
        }
        if (key === "r") {
            stopTransform(e);
            emitEvent('apply-key-up', e)
            return;
        }
        if (key === "w") {
            emitEvent('apply-key-up', e)
        }
    };

    const init = async () => {
        try {

            grid.value.wrapper.ref = document.getElementById(grid.value.wrapper.id);
            grid.value.main.ref = document.getElementById(grid.value.main.id);
            grid.value.container.ref = document.getElementById(props.canvasId);

            if (grid.value.wrapper.ref) {
                const rect = grid.value.wrapper.ref.getBoundingClientRect();
                grid.value.wrapper.width = rect.width;
                grid.value.wrapper.height = rect.height;
                register('add', grid.value.wrapper.ref, 'mousedown', resetSelection);
            }

            if (grid.value.container.ref) {
                register('add', grid.value.container.ref, 'mousedown', mouseDown);
                register('add', window, 'mousemove', mouseMove);
                register('add', window, 'keydown', keyDown);
                register('add', window , 'keyup', keyUp);
            }

            await emitEvent('fetch-layer');

            return console.log('Grid-Component successfully initialized');
        } catch (error) {
            console.error('[init] Initialization failed:', error);
            throw new Error('Grid-Component initialization failed');
        }
    };

    onMounted(async () => {
        await init();
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        grid,
        cursor,
        anchorScreen,
        emitEvent,
        toggleSelection,
        startAnchorDrag,
        startRotate,
        startResize,
        onPositionUpdate,
        onRotationUpdate,
        onScaleUpdate,
        onReset,
        frameBox
    };
}


export const gridProps = {
    containerStates: {
        type: Object,
        required: true,
    },
    layerStates: {
        type: Object,
        required: true,
    },
    status: {
        type: Array,
        required: true,
    },
    rule: {
        type: Boolean,
        required: true,
    },
    timeline: {
        type: Boolean,
        required: true,
    },
    miniTimeline: {
        type: Boolean,
        required: true,
    },
    timelinePlay: {
        type: Boolean,
        required: true,
    },
    time: {
        type: Number,
        required: true,
    },
    timelineRecord: {
        type: Boolean,
        required: true,
    },
    pathDrag: {
        type: Boolean,
        required: true,
    },
    selectedPath: {
        type: Object,
        required: true,
    },
    viewport: {
        type: Object,
        required: true,
    },
    settings: {
        type: Object,
        required: true,
    },
    guides: {
        type: Array,
        required: true,
    },
    layers: {
        type: Array,
        required: true,
    },
    select: {
        type: Boolean,
        required: true,
    },
    text: {
        type: Boolean,
        required: true,
    },
    textLayer: {
        type: Object,
        required: true,
    },
    selectMode: {
        type: String,
        required: true,
    },
    backup: {
        type: String,
        required: true,
    },
    canvasId: {
        type: String,
        required: true,
    },
    brushCanvasId: {
        type: String,
        required: true,
    },
    fillState: {
        type: Boolean,
        required: true,
    },
    brush: {
        type: Boolean,
        required: true,
    },
    eraser: {
        type: Boolean,
        required: true,
    },
    brushes: {
        type: Array,
        required: true,
    },
    brushSettings: {
        type: Object,
        required: true,
    },
    drawing: {
        type: Boolean,
        required: true,
    },
    selectedLayer: {
        type: Array,
        required: true,
    },
    brushCursor: {
        type: String,
        required: false,
    },
    color: {
        type: String,
        required: false,
    },
    pen: {
        type: Boolean,
        required: true,
    },
    pathLayer: {
        type: Object,
        required: true,
    },
    theme: {
        type: String,
        required: false,
    },
    penPathState: {
        type: Boolean,
        required: true,
    },
    loading: {
        type: Boolean,
        required: true,
    },
    bezier: {
        type: String,
        required: false,
    },
    pathImport: {
        type: Boolean,
        required: true,
    },
};
