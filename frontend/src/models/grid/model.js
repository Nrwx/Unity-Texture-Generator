import {computed, ref, onMounted, nextTick, onBeforeUnmount} from "vue";
import {backupStates, canvasStates, transformStates, windowStates} from "@/dataLayer/state";
import {eventRegister} from "@/dataLayer/event";

export function gridModel(props, emit) {
    const canvasContainer = ref(null);
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

    const cycleAlignMode = () => {
        if (transformStates.align.value) {
            alignModeStep.value = (alignModeStep.value + 1) % 3;
        } else {
            alignModeStep.value = 0;
        }
    };

    const handleMouseMove = async (event) => {
        event.preventDefault();
        const rect = canvasContainer.value.getBoundingClientRect();
        const scaledX = (event.clientX - rect.left);
        const scaledY = (event.clientY - rect.top);

        cursor.value.x = Math.round(scaledX);
        cursor.value.y = Math.round(scaledY);

        const dx = (event.clientX - lastMouse.value.x);
        const dy = (event.clientY - lastMouse.value.y);

        // Transformieren:
        if (transformStates.transform.value) {
            props.selectedLayer.forEach(layer => {
                if (transformStates.align.value) {
                    // Handle Align Modes
                    if (alignModeStep.value === 1) {
                        layer.matrix.x += dx;
                    } else if (alignModeStep.value === 2) {
                        layer.matrix.y += dy;
                    } else {
                        layer.matrix.x += dx;
                        layer.matrix.y += dy;
                    }
                } else {
                    // Normales Transformieren
                    layer.matrix.x += dx;
                    layer.matrix.y += dy;
                }
            });
        } else if (canvasStates.transform.value) {
            offset.value.x += dx;
            offset.value.y += dy;
        }
        // Resizing (Skalierung)
        else if (transformStates.size.value) {
            await handleResize(dx, dy);
        }
        // Rotation
        else if (transformStates.rotate.value) {
            await handleRotate(event);
        }

        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
    };

    const startResize = async (corner, event) => {
        emitEvent('reset:window-states', false)
        await nextTick()
        transformStates.menu.value = true
        transformStates.size.value = true;
        resizeDirection.value = corner;
        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
        register('add', document, 'mouseup', stopTransform);
    };

    const startRotate = async (direction, event) => {
        emitEvent('reset:window-states', false)
        await nextTick()
        transformStates.menu.value = true
        transformStates.rotate.value = true;
        rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);
        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
        register('add', document, 'mouseup', stopTransform);
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

    const handleRotate = async (event) => {
        backupStates.action.value = 'Bild Rotieren';
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

            if (transformStates.align.value) {
                newRotation = getSnappedAngle(newRotation);
            }

            layer.matrix.rotate = parseFloat(newRotation.toFixed(2));
        });

        rotationStartAngle.value = currentAngle;
    };

    // Handle Resize
    const handleResize = async (dx, dy) => {
        backupStates.action.value = 'Bild Skalieren';
        props.selectedLayer.forEach(layer => {
            const originalWidth = layer.width;
            const originalHeight = layer.height;

            if (transformStates.align.value) {
                // Wenn Shift gedrückt ist, gleichmäßige Skalierung (synchron auf X und Y)
                const scale = Math.max(dx / originalWidth, dy / originalHeight);
                layer.matrix.a += scale;
                layer.matrix.d += scale;
            } else {
                // Skalierung entlang der X-Achse
                if (resizeDirection.value.includes('left') || resizeDirection.value.includes('right')) {
                    const scaleX = dx / originalWidth;
                    layer.matrix.a += scaleX;
                    // Verhindere extreme Skalierung
                    layer.matrix.a = Math.max(0.1, Math.min(layer.matrix.a, 5)); // Beispiel: Skalierung von 10% bis 500%
                }

                // Skalierung entlang der Y-Achse
                if (resizeDirection.value.includes('top') || resizeDirection.value.includes('bottom')) {
                    const scaleY = dy / originalHeight;
                    layer.matrix.d += scaleY;
                    // Verhindere extreme Skalierung
                    layer.matrix.d = Math.max(0.1, Math.min(layer.matrix.d, 5)); // Beispiel: Skalierung von 10% bis 500%
                }
            }

            // Position anpassen
            if (resizeDirection.value.includes('top')) {
                layer.matrix.y += dy;  // Verschiebung nach oben
            } else if (resizeDirection.value.includes('bottom')) {
                // Keine direkte Änderung der Y-Position bei unten
            }

            if (resizeDirection.value.includes('left')) {
                layer.matrix.x += dx;  // Verschiebung nach links
            } else if (resizeDirection.value.includes('right')) {
                // Keine direkte Änderung der X-Position bei rechts
            }
        });
    }


    const resetSelection = async (event) => {
        event.preventDefault();
        if (!canvasContainer.value.contains(event.target) && !event.ctrlKey
            || !transformStates.menu.value && !transformStates.transform.value && !event.ctrlKey
            || !transformStates.menu.value && !transformStates.rotate.value && !event.ctrlKey
            || !transformStates.menu.value && !transformStates.size.value && !event.ctrlKey) {
            stopTransform()
            props.selectedLayer.forEach(layer => {
                updateLayer(layer)
            })
            transformStates.align.value = false
            alignModeStep.value = 0
            emitEvent('layer:select', [])
        }
    };

    const layerChanged = (a, b) => {
        if (!a || !b) return true;

        for (const key in a) {
            if (key === 'matrix' || key === '__originalMatrix' || key === '__originalBase') continue;
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
        if (!layer.__originalBase) {
            const { matrix, __originalMatrix, ...rest } = layer;
            console.log(`Stored Base: ${JSON.stringify(rest)} Excluded Matrix: ${JSON.stringify(matrix)} Excluded Shadow-Matrix: ${JSON.stringify(__originalMatrix)}`);
            layer.__originalBase = { ...rest };
        }
    };

    const updateLayer = (layer) => {
        if (layerChanged(layer.__originalMatrix, layer.matrix || layerChanged(layer.__originalBase, layer))) {
            emitEvent("backup:create-global", {id: layer.id, state: layer, title: backupStates.action.value});
            emitEvent('update-layer', layer);
            console.log('Layer aktualisiert');
        } else {
            console.log('Layer unverändert');
        }
    };

    const toggleSelection = (layer, event) => {
        event.preventDefault();
        transformStates.transform.value = false;
        transformStates.size.value = false;
        transformStates.rotate.value = false;
        let data = props.selectedLayer;
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
            data = [layer];
            emitEvent('layer:select', data);
        }
    };

    const canvasContainerStyle = computed(() => ({
        width: `${props.settings.width}px`,
        height: `${props.settings.height}px`,
        transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${zoomFaktor.value})`,
        transformOrigin: "center center",
    }));

    const handleMouseDown = (event) => {
        event.preventDefault();
        if (canvasStates.select.value) {
            return;
        }
        if (canvasStates.zoom.value) {
            if (event.button === 0) {
                zoomFaktor.value = Math.min(zoomFaktor.value + 0.1, 2);
            } else if (event.button === 2) {
                event.preventDefault();
                zoomFaktor.value = Math.max(zoomFaktor.value - 0.1, 0.5);
            }
        }
    };

    const stopTransform = () => {
        transformStates.menu.value = false;
        transformStates.transform.value = false;
        transformStates.size.value = false;
        transformStates.rotate.value = false;
        register('remove', document, 'mouseup', stopTransform);
    };


    const startPan = async (event) => {
        await nextTick();
        event.preventDefault();
        if (!canvasStates.transform.value) return;
        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
        register('add', document, 'mousemove', handleMouseMove);
        register('add', document, 'mouseup', stopPan);
    };

    const stopPan = () => {
        canvasStates.transform.value = false;
        register('remove', document, 'mousemove', handleMouseMove);
        register('remove', document, 'mouseup', stopPan);
    };

    const handleKeyDown = (event) => {
        if (windowStates.text.value || windowStates.typing.value || windowStates.brush.value) return;

        event.preventDefault();
        if (event.key.toLowerCase() === "r") {
            console.log('R-KEY-HAS-NO-EVENT');
        }
        if (event.key === "w") {
            canvasStates.select.value = !canvasStates.select.value;
        }
        if (event.key === 'g') {
            if (props.selectedLayer.length) {
                backupStates.action.value = 'Bild Transformieren';
                transformStates.menu.value = true;
                transformStates.transform.value = true;
            } else {
                canvasStates.transform.value = true;
            }
        }
        if (event.key === 'z') canvasStates.zoom.value = !canvasStates.zoom.value;

        if (event.key === "Shift") {
            transformStates.align.value = true;
        }
    };

    const handleKeyUp = (event) => {
        if (windowStates.text.value || windowStates.typing.value || windowStates.brush.value) return;

        event.preventDefault();
        if (event.key === 'g') {
            canvasStates.transform.value = false;
            transformStates.transform.value = false;
            transformStates.menu.value = false
        }
        if (event.key === "Shift") {
            if (transformStates.transform.value) {
                cycleAlignMode();
            } else {
                transformStates.align.value = false;
            }
        }
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

    onMounted(() => {
        register('add', document, 'contextmenu', (event) => event.preventDefault());
        register('add', document, 'keydown', handleKeyDown);
        register('add', document, 'keyup', handleKeyUp);
        register('add', document, 'mousedown', startPan);
        emitEvent('fetch-layer')
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        canvasContainer,
        offset,
        cursor,
        canvasContainerStyle,
        handleMouseDown,
        handleMouseMove,
        zoomFaktor,
        emitEvent,
        toggleSelection,
        resetSelection,
        startRotate,
        startResize,
        updateLayer,
        frameBox
    };
}


export const gridProps = {
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
    brushLayer: {
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
};
