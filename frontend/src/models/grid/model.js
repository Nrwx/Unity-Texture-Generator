import {computed, ref, onMounted, onBeforeUnmount} from "vue";
import {uuid} from "@/utils/uuid";
import {eventRegister} from "@/dataLayer/event";

export function gridModel(props, emit) {
    const wrapper = ref(null);
    const wrapperId = ref(uuid());
    const main = ref(null);
    const mainId = ref(uuid());
    const canvas = ref(null);
    const wrapperData = ref({width: 0, height: 0});
    const controlData = computed(() => ({
        x: offset.value.x,
        y: offset.value.y,
        rotation: canvasRotation.value,
        scale: zoomFaktor.value,
        width: wrapperData.value.width,
        height: wrapperData.value.height,
    }));

    const canvasRotation = ref(0);

    const zoomFaktor = ref(1);
    const offset = ref({x: 0, y: 0})
    const cursor = ref({ x: 0, y: 0 });
    const lastMouse = ref({x: 0, y: 0})
    const resizeDirection = ref('');
    const rotationStartAngle = ref(0);
    const fineSnapAngle = 360 / 64; // 5.625° pro Schritt
    const alignModeStep = ref(0);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const { register } = eventRegister('listener:grid', emitEvent);

    const cycleAlignMode = (e) => {
        if (props.align) {
            alignModeStep.value = (alignModeStep.value + 1) % 3;
            emitEvent('apply-key-down', e)
            emitEvent('apply-key-up', e)
        } else {
            alignModeStep.value = 0;
        }
    };

    const screenToWorld = (clientX, clientY) => {
        const rect = canvas.value.getBoundingClientRect();

        const cx = rect.width / 2;
        const cy = rect.height / 2;

        // 1. Screen → center space
        let x = clientX - rect.left - cx;
        let y = clientY - rect.top - cy;

        // 2. inverse scale
        const s = zoomFaktor.value;
        x /= s;
        y /= s;

        // 3. inverse rotation
        const a = (-canvasRotation.value * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);

        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;

        // 4. back to world space
        return {
            x: rx + cx - offset.value.x,
            y: ry + cy - offset.value.y
        };
    };

    const mouseMove = async (event) => {
        const current = screenToWorld(event.clientX, event.clientY);
        const previous = screenToWorld(lastMouse.value.x, lastMouse.value.y);

        const dx = current.x - previous.x;
        const dy = current.y - previous.y;

        cursor.value.x = Math.round(current.x);
        cursor.value.y = Math.round(current.y);

        if (props.transform) {
            const mainRect = main.value.getBoundingClientRect();
            const canvasRect = canvas.value.getBoundingClientRect();
            const canvasOffsetX = canvasRect.left - mainRect.left;
            const canvasOffsetY = canvasRect.top - mainRect.top;
            const canvasWidth = canvasRect.width;
            const canvasHeight = canvasRect.height;

            const hasGuides = props.guides && props.guides.length > 0;

            // Framebox Koordinaten relativ zum main
            let newX = frameBox.value.left + dx + canvasOffsetX;
            let newY = frameBox.value.top + dy + canvasOffsetY;

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

                // Guides aus props.guides (alle relativ zu main)
                const verticalGuides = Array.from(new Set([
                    ...props.guides
                        .filter(g => g.type === 'vertical')
                        .map(g => g.position),
                    // Canvas-Kanten als Snap-Punkte (links, mitte, rechts)
                    canvasOffsetX,
                    canvasOffsetX + canvasWidth / 2,
                    canvasOffsetX + canvasWidth
                ])).sort((a, b) => a - b);

                const horizontalGuides = Array.from(new Set([
                    ...props.guides
                        .filter(g => g.type === 'horizontal')
                        .map(g => g.position),
                    // Canvas-Kanten als Snap-Punkte (oben, mitte, unten)
                    canvasOffsetY,
                    canvasOffsetY + canvasHeight / 2,
                    canvasOffsetY + canvasHeight
                ])).sort((a, b) => a - b);

                // Schnittpunkte vertikal × horizontal
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

            // Zurück in Canvas-Koordinaten
            newX -= canvasOffsetX;
            newY -= canvasOffsetY;

            const offsetX = Math.round(newX - frameBox.value.left);
            const offsetY = Math.round(newY - frameBox.value.top);

            props.selectedLayer.forEach(layer => {
                if (props.align) {
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
        }

        else if (props.canvasTransform) {
            const dx = event.clientX - lastMouse.value.x;
            const dy = event.clientY - lastMouse.value.y;
            offset.value.x += dx;
            offset.value.y += dy;
        } else if (props.canvasRotate) {
            await rotateCanvas(event);
        } else if (props.size) {
            const start = screenToWorld(
                resizeStartMouse.value.x,
                resizeStartMouse.value.y
            );

            const dxAbs = current.x - start.x;
            const dyAbs = current.y - start.y;

            await resize(dxAbs, dyAbs);
        } else if (props.rotate) {
            await rotate(event);
        }

        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
    };

    const startRotate = async (direction, event) => {
        emitEvent('layer:transform-menu', true)
        emitEvent('layer:transform-rotate', true)
        rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);
        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
        register('add', window, 'mouseup', stopTransform);
    };


    const calculateRotation = (mouseX, mouseY) => {
        if (!props.selectedLayer.length) return 0;

        const crosshair = document.querySelector(".center-crosshair");
        const crosshairRect = crosshair.getBoundingClientRect();
        const centerX = crosshairRect.left + crosshairRect.width / 2;
        const centerY = crosshairRect.top + crosshairRect.height / 2;

        const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
        return angle * (180 / Math.PI); // Umwandlung von Radiant zu Grad
    };

    const getSnappedAngle = (angle) => {
        const remainder = angle % fineSnapAngle;
        if (remainder < fineSnapAngle / 2) {
            return angle - remainder;  // Abrunden
        } else {
            return angle + (fineSnapAngle - remainder);  // Aufrunden
        }
    };

    const rotate = async (event) => {
        emitEvent('backup:action', 'Bild Rotieren')
        event.preventDefault();

        const crosshair = document.querySelector(".center-crosshair");
        const crosshairRect = crosshair.getBoundingClientRect();
        const centerX = crosshairRect.left + crosshairRect.width / 2;
        const centerY = crosshairRect.top + crosshairRect.height / 2;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const dampingFactor = Math.min(1, distance / 100);

        const currentAngle = calculateRotation(event.clientX, event.clientY);
        let deltaAngle = currentAngle - rotationStartAngle.value;

        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;

        deltaAngle *= dampingFactor;

        props.selectedLayer.forEach(layer => {
            let newRotation = (layer.matrix.rotate + deltaAngle + 360) % 360;

            if (props.align) {
                newRotation = getSnappedAngle(newRotation);
            }

            layer.matrix.rotate = parseFloat(newRotation.toFixed(2));
        });

        rotationStartAngle.value = currentAngle;
    };

    const rotateCanvas = async (event) => {
        emitEvent('backup:action', 'Canvas Rotieren');
        event.preventDefault();

        const crosshair = document.querySelector(".center-crosshair");
        if (!crosshair) return;

        const crosshairRect = crosshair.getBoundingClientRect();
        const centerX = crosshairRect.left + crosshairRect.width / 2;
        const centerY = crosshairRect.top + crosshairRect.height / 2;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dampingFactor = Math.min(1, distance / 100);

        const currentAngle = calculateRotation(event.clientX, event.clientY);
        let deltaAngle = currentAngle - rotationStartAngle.value;

        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;

        deltaAngle *= dampingFactor;

        const newCanvasAngle = (canvasRotation.value + deltaAngle + 360) % 360;

        canvasRotation.value = parseFloat(newCanvasAngle.toFixed(2));
        rotationStartAngle.value = currentAngle;
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

    const resizeStartMouse = ref({ x: 0, y: 0 });

    const startResize = async (corner, event) => {
        emitEvent('layer:transform-menu', true);
        emitEvent('layer:transform-size', true);

        resizeDirection.value = corner;

        resizeStartMouse.value.x = event.clientX;
        resizeStartMouse.value.y = event.clientY;

        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;

        // Originalzustand nur einmal sichern
        props.selectedLayer.forEach(layer => {
            if (!layer.__originalMatrix) {
                storeLayer(layer);
            }
        });

        register('add', window, 'mouseup', stopTransform);
    };

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

            let scaleX = (width + deltaW) / width;
            let scaleY = (height + deltaH) / height;

            // SHIFT bleibt exakt wie bisher
            if (props.align) {
                const uniform = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                scaleX = scaleX < 0 ? -uniform : uniform;
                scaleY = scaleY < 0 ? -uniform : uniform;
            }

            scaleX = clamp(scaleX, 0.1, 5);
            scaleY = clamp(scaleY, 0.1, 5);

            const newWidth = width * scaleX;
            const newHeight = height * scaleY;

            layer.matrix.a = start.a * scaleX;
            layer.matrix.d = start.d * scaleY;

            if (props.align) {
                // bleibt wie gehabt
                layer.matrix.x = start.x;
                layer.matrix.y = start.y;
            } else {
                // x/y als Mittelpunkt gedacht -> nur halbe Delta-Korrektur
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
        if (!canvas.value.contains(event.target) && !event.ctrlKey
            || !props.menu && !props.transform && !event.ctrlKey
            || !props.menu && !props.rotate && !event.ctrlKey
            || !props.menu && !props.size && !event.ctrlKey) {
            stopTransform()
            props.selectedLayer.forEach(layer => {
                updateLayer(layer)
            })

            props.selectedLayer = [];
            emitEvent('layer:select', [])
        }
    };

    const onPositionUpdate = ({ x, y }) => {
        offset.value = { x, y };
    };

    const onScaleUpdate = (scale) => {
        zoomFaktor.value = scale;
    };

    const onRotationUpdate = (rot) => {
        canvasRotation.value = rot;
    };

    const onReset = () => {
        offset.value = { x: 0, y: 0 };
        zoomFaktor.value = 1;
        canvasRotation.value = 0;
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
        if (!layer.__originalMatrix) {
            layer.__originalMatrix = { ...layer.matrix };
        }
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
        emitEvent('reset:grid-states', false)
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
    };

    const canvasStyle = computed(() => ({
        width: `${props.settings.width}px`,
        height: `${props.settings.height}px`,
        transform: `translate(${offset.value.x}px, ${offset.value.y}px)scale(${zoomFaktor.value})rotate(${canvasRotation.value}deg)`,
        transformOrigin: "center center",
    }));

    const mouseDown = (event) => {
        event.preventDefault();
        if (props.select) {
            return;
        }
        if (props.canvasZoom) {
            if (event.button === 0) {
                zoomFaktor.value = Math.min(zoomFaktor.value + 0.1, 2);
            } else if (event.button === 2) {
                event.preventDefault();
                zoomFaktor.value = Math.max(zoomFaktor.value - 0.1, 0.5);
            }
        }
    };

    const stopTransform = () => {
        register('remove', window, 'mouseup', stopTransform);
        alignModeStep.value = 0
        if (props.timeline || props.timelineRecord) emitEvent("timeline:set-keyframe");
        emitEvent('reset:grid-states', false)
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

    const keyDown = (e) => {
        if (props.rule) return;
        e.preventDefault();
        const key = e.key === 'Shift' ? 'Shift' : e.key.toLowerCase();
        if (key === "g") {
            if (props.selectedLayer.length) {
                emitEvent('backup:action', 'Bild Transformieren')
                emitEvent('layer:transform-menu', true)
                emitEvent('layer:transform-state', true)
            } else {
                emitEvent('canvas:transform-state', true)
            }
            emitEvent('apply-key-down', e)
        }
        if (key === "w") {
            emitEvent('canvas:select-state', !props.canvasSelect)
            emitEvent('apply-key-down', e)
        }
        if (key === "z") {
            emitEvent('canvas:zoom-state', !props.canvasZoom)
            emitEvent('apply-key-down', e)
        }
        if (key === "r") {
            if(props.selectedLayer.length) {
                return
            } else {
                emitEvent('canvas:rotate-state', true)
            }
            emitEvent('apply-key-down', e)
        }
        if (key === "Shift") {
            emitEvent('layer:transform-align', true)
            emitEvent('apply-key-down', e)
        }
    };

    const keyUp = (e) => {
        if (props.rule) return;
        e.preventDefault();
        const key = e.key === 'Shift' ? 'Shift' : e.key.toLowerCase();
        if (key === "g") {
            if (props.timeline || props.timelineRecord) emitEvent("timeline:set-keyframe");
            emitEvent('canvas:transform-state', false);
            emitEvent('layer:transform-state', false);
            emitEvent('layer:transform-menu', false);
            emitEvent('apply-key-up', e)
        }
        if (key === "z") {
            emitEvent('apply-key-up', e)
        }
        if (key === "r") {
            emitEvent('canvas:rotate-state', false);
            emitEvent('apply-key-up', e)
        }
        if (key === "w") {
            emitEvent('apply-key-up', e)
        }
        if (key === "Shift") {
            if (props.transform) {
                cycleAlignMode(e);
            } else {
                emitEvent('layer:transform-align', false);
                emitEvent('apply-key-up', e)
            }
        }
    };

    const init = async () => {
        try {

            wrapper.value = document.getElementById(wrapperId.value);
            main.value = document.getElementById(mainId.value);
            canvas.value = document.getElementById(props.canvasId);

            if (wrapper.value) {
                const rect = wrapper.value.getBoundingClientRect();
                wrapperData.value.width = rect.width;
                wrapperData.value.height = rect.height;
                register('add', wrapper.value, 'mousedown', resetSelection);
            }

            if (canvas.value) {
                register('add', canvas.value, 'mousedown', mouseDown);
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
        controlData,
        canvasRotation,
        wrapper,
        wrapperId,
        main,
        mainId,
        canvas,
        offset,
        cursor,
        canvasStyle,
        zoomFaktor,
        emitEvent,
        toggleSelection,
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
    canvasControl: {
        type: Boolean,
        required: true,
    },
    canvasZoom: {
        type: Boolean,
        required: true,
    },
    canvasSelect: {
        type: Boolean,
        required: true,
    },
    canvasTransform: {
        type: Boolean,
        required: true,
    },
    canvasRotate: {
        type: Boolean,
        required: true,
    },
    transform: {
        type: Boolean,
        required: true,
    },
    rotate: {
        type: Boolean,
        required: true,
    },
    size: {
        type: Boolean,
        required: true,
    },
    menu: {
        type: Boolean,
        required: true,
    },
    align: {
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
