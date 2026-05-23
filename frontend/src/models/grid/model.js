import {computed, nextTick, onBeforeUnmount, onMounted, ref} from "vue";
import {uuid} from "@/utils/uuid";
import {eventRegister} from "@/dataLayer/event";
import {useMouse} from "@/composables/mouse/model";
import {clamp, distance, getRect, hasChanged, store} from "@/utils/tools";
import {parseColor} from "@/utils/color";
import {getSnappedAngle} from "@/utils/transform";

export function gridModel(props, emit) {

    const cache = {
        brush: new Map()
    }

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
    });

    const ui = ref({
        animator: {
            projection: "perspective",
            fov: 50,
            near: 0.01,
            far: 1000,
            radius: 4.6,
            minRadius: 0.18,
            maxRadius: 250,
            orthographicScale: 5,
            minOrthographicScale: 0.05,
            maxOrthographicScale: 250,
            theta: -Math.PI / 4,
            phi: 58 * Math.PI / 180,
            rotateSpeed: 0.0065,
            panSpeed: 0.0028,
            dollySpeed: 0.0018,
            wheelSpeed: 0.0012,
            damping: 18,
            rightMouseOrbit: true,
            blenderMouse: true,
            backgroundGrid: true,
            showAxisGizmo: true,
            target: {
                x: 0,
                y: 0,
                z: 0,
            },
        },
        brush: {
            cursor: {
                position: { x: 0, y: 0 },
                dynamic: {
                  size: 0,
                  rotation: 0,
                  opacity: 1,
                },
                current: null
            },

            menu: {
                active: false,
                position: { x: 0, y: 0 },
            },
        },
    });

    const writeUi = (path, val) => {
        const keys = path.split(".");
        const lastKey = keys.pop();

        let target = ui.value;

        for (const key of keys) {
            if (!(key in target)) {
                target[key] = {};
            }

            target = target[key];
        }

        target[lastKey] = val;
    };

    const emitEvent = (event, payload) => { emit("component-event", event, payload);};
    const { register } = eventRegister('listener:grid', emitEvent);

    const mouse = useMouse({
        register,
        mainId: grid.value.main.id,
        canvasId: props.canvasId,
        width: props.settings.width,
        height: props.settings.height,
        mode: "world"
    });

    const {
        cursor,
        lastMouse,
        screenToWorld
    } = mouse;

    const getFirstBrushItem = () => {
        const category = props.brushes?.find(item => item?.children?.length);
        const child = category?.children?.[0];

        if (!category || !child) return null;

        return {
            id: child.id,
            name: child.name,
            categoryId: category.id,
            categoryName: category.name,
            url: '/brush' + child.path,
        };
    };

    const normalizeNumber = (value, fallback, min = -Infinity, max = Infinity) => {
        const n = Number(value);

        if (!Number.isFinite(n)) return fallback;

        return Math.min(max, Math.max(min, n));
    };

    const prepareBrush = async (data) => {
        const item = getFirstBrushItem();

        const brushId = data?.id !== "" && data?.id != null
            ? data.id
            : item?.id;

        const brushUrl = data?.url !== "" && data?.url != null
            ? data.url
            : item?.url;

        if (!brushId || !brushUrl) {
            console.warn("prepareBrush: Kein gültiger Brush gefunden", {
                data,
                item
            });

            return null;
        }

        const size = Math.round(
            normalizeNumber(data?.size ?? props.brushSettings.size, 64, 1, 2048)
        );

        const opacity = normalizeNumber(data?.opacity, 1.0, 0.001, 1.0);
        const rotation = normalizeNumber(data?.angle, 0, -360, 360);
        const color = data?.color || "#000000";

        const img = await new Promise((res, rej) => {
            const i = new Image();

            i.crossOrigin = 'Anonymous';
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = brushUrl;
        });

        emitEvent('generate:cursor', {
            id: brushId,
            size,
            opacity,
            rotation
        });

        const key = [
            brushUrl,
            color,
            size,
            opacity,
            rotation,
            brushId
        ].join("|");

        if (cache.brush.has(key)) {
            return cache.brush.get(key);
        }

        const off = document.createElement('canvas');

        Object.assign(off, {
            width: img.width,
            height: img.height
        });

        const octx = off.getContext('2d', {
            willReadFrequently: true
        });

        octx.drawImage(img, 0, 0);

        const imgData = octx.getImageData(0, 0, img.width, img.height);
        const c = parseColor(color);

        for (let i = 0; i < imgData.data.length; i += 4) {
            const gray = imgData.data[i];

            imgData.data[i] = c.r;
            imgData.data[i + 1] = c.g;
            imgData.data[i + 2] = c.b;
            imgData.data[i + 3] = gray;
        }

        octx.putImageData(imgData, 0, 0);

        cache.brush.set(key, off);

        return off;
    };

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

    const anchorPoint = ref({ x: 0.5, y: 0.5 });
    const anchorScreen = computed(() => {
        const box = frameBox.value;

        if (!box.width || !box.height) {
            return { x: 0, y: 0 };
        }

        return getAnchorWorld();
    });

    const isDraggingAnchor = ref(false);
    const rotationPivot = ref(null);

    const syncAnchorToSelection = () => {
        if (!props.selectedLayer.length) return;

        anchorPoint.value = { x: 0.5, y: 0.5 };
    };

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


    const setZoomAt = (clientX, clientY, nextScale) => {
        const data = mouse.getCanvasLayoutData();

        if (!data) return;

        const m = grid.value.container.matrix;

        const world = mouse.screenToWorld(clientX, clientY);
        const target = mouse.clientPointToMain(clientX, clientY);

        const originX = data.origin.x;
        const originY = data.origin.y;

        const localX = world.x - originX;
        const localY = world.y - originY;

        const angle = ((m.rotate || 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const rotatedX = localX * cos - localY * sin;
        const rotatedY = localX * sin + localY * cos;

        const scaledX = rotatedX * nextScale;
        const scaledY = rotatedY * nextScale;

        m.a = nextScale;
        m.d = nextScale;

        m.x = target.x - data.offset.x - originX - scaledX;
        m.y = target.y - data.offset.y - originY - scaledY;
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
        register('remove', window, 'pointermove', zoomMouseMove);
        register('remove', window, 'pointerup', stopZoomScrub);
    };

    const openBrushMenu = async (event) => {
        if (!props.brush) return;
        event.preventDefault();
        event.stopPropagation();
        const point = mouse.screenToWorld(event.clientX, event.clientY);
        ui.value.brush.menu.position = {
            x: Math.round(point.x),
            y: Math.round(point.y),
        };
        ui.value.brush.menu.active = true;
        await nextTick();
        register("add", window, "click", closeBrushMenu);
    };

    const closeBrushMenu = (event) => {
        const menu = document.querySelector('.brush-context-menu');
        if (menu && menu.contains(event.target)) {
            return;
        }
        ui.value.brush.menu.active = false;
        register("remove", window, "click", closeBrushMenu);
    };

    const onWrapperContextMenu = async (event) => {
        if (!props.brush) return;
        await openBrushMenu(event);
    };

    const mouseMove = async (event) => {
        await mouse.move(event, async ({current, dx, dy, dxStart, dyStart, client, lastClient,}) => {

            if (props.brush) {
                ui.value.brush.cursor.position = {
                    x: Math.round(current.x),
                    y: Math.round(current.y),
                };
            }

            if (isDraggingAnchor.value) {
                const box = frameBox.value;

                anchorPoint.value = {
                    x: (current.x - box.left) / box.width,
                    y: (current.y - box.top) / box.height,
                };

                anchorPoint.value.x = clamp(anchorPoint.value.x, 0, 1);
                anchorPoint.value.y = clamp(anchorPoint.value.y, 0, 1);

                return;
            }

            if (props.layerStates.translate.value) {
                const hasGuides = props.guides && props.guides.length > 0;

                let newX = frameBox.value.left + dx;
                let newY = frameBox.value.top + dy;

                const width = frameBox.value.width;
                const height = frameBox.value.height;

                if (hasGuides) {
                    const edgesX = {
                        left: newX,
                        center: newX + width / 2,
                        right: newX + width,
                    };

                    const edgesY = {
                        top: newY,
                        center: newY + height / 2,
                        bottom: newY + height,
                    };

                    const verticalGuides = Array.from(new Set([
                        ...props.guides
                            .filter(g => g.type === "vertical")
                            .map(g => g.position),
                        0,
                        props.settings.width,
                    ])).sort((a, b) => a - b);

                    const horizontalGuides = Array.from(new Set([
                        ...props.guides
                            .filter(g => g.type === "horizontal")
                            .map(g => g.position),
                        0,
                        props.settings.height,
                    ])).sort((a, b) => a - b);

                    const scale = grid.value.container.matrix.a || 1;
                    const SNAP_TOLERANCE = 8 / scale;

                    let bestSnapDeltaX = 0;
                    let bestSnapDistanceX = Infinity;

                    let bestSnapDeltaY = 0;
                    let bestSnapDistanceY = Infinity;

                    for (const guideX of verticalGuides) {
                        for (const keyX in edgesX) {
                            const deltaX = guideX - edgesX[keyX];

                            if (
                                Math.abs(deltaX) <= SNAP_TOLERANCE &&
                                Math.abs(deltaX) < bestSnapDistanceX
                            ) {
                                bestSnapDistanceX = Math.abs(deltaX);
                                bestSnapDeltaX = deltaX;
                            }
                        }
                    }

                    for (const guideY of horizontalGuides) {
                        for (const keyY in edgesY) {
                            const deltaY = guideY - edgesY[keyY];

                            if (
                                Math.abs(deltaY) <= SNAP_TOLERANCE &&
                                Math.abs(deltaY) < bestSnapDistanceY
                            ) {
                                bestSnapDistanceY = Math.abs(deltaY);
                                bestSnapDeltaY = deltaY;
                            }
                        }
                    }

                    newX += bestSnapDeltaX;
                    newY += bestSnapDeltaY;
                }

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

                return;
            }

            if (props.containerStates.translate.value) {
                grid.value.container.matrix.x += client.x - lastClient.x;
                grid.value.container.matrix.y += client.y - lastClient.y;
                return;
            }

            if (props.containerStates.rotate.value || props.layerStates.rotate.value) {
                await rotate(event);
                return;
            }

            if (props.layerStates.scale.value) {
                await resize(dxStart, dyStart);
            }
        });
    };

    const startRotate = async (direction, event) => {
        event.preventDefault();
        event.stopPropagation();

        emitEvent("layer:transform-menu", true);
        emitEvent("layer:rotate", true);

        rotationPivot.value = getAnchorWorld();
        rotationStartAngle.value = calculateRotation(event.clientX, event.clientY);

        mouse.setStart(event);
        mouse.setLast(event);

        register("add", window, "pointerup", stopTransform);
    };


    const calculateRotation = (mouseX, mouseY) => {
        if (!props.selectedLayer.length) return 0;

        const mouse = screenToWorld(mouseX, mouseY);
        const pivot = getAnchorWorld();

        const angle = Math.atan2(mouse.y - pivot.y, mouse.x - pivot.x);
        return angle * (180 / Math.PI);
    };

    const rotate = async (event) => {
        emitEvent('backup:action', 'Bild Rotieren')
        event.preventDefault();

        const crossHairRect = getRect('.center-crosshair');
        const centerX = crossHairRect.left + crossHairRect.width / 2;
        const centerY = crossHairRect.top + crossHairRect.height / 2;

        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const pDistance = distance(dx, dy);

        const dampingFactor = Math.min(1, pDistance / 100);

        const currentAngle = calculateRotation(event.clientX, event.clientY);
        let deltaAngle = currentAngle - rotationStartAngle.value;

        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;

        deltaAngle *= dampingFactor;

        if (props.selectedLayer.length) {
            props.selectedLayer.forEach(layer => {
                let newRotation = (layer.matrix.rotate + deltaAngle + 360) % 360;

                if (props.layerStates.align.value) {
                    newRotation = getSnappedAngle(newRotation, fineSnapAngle);
                }

                layer.matrix.rotate = parseFloat(newRotation.toFixed(2));
            });
        } else {
            let newRotation = (grid.value.container.matrix.rotate + deltaAngle + 360) % 360;

            if (props.containerStates.align?.value) {
                newRotation = getSnappedAngle(newRotation, fineSnapAngle);
            }

            grid.value.container.matrix.rotate = parseFloat(newRotation.toFixed(2));
        }

        rotationStartAngle.value = currentAngle;
    };

    const startAnchorDrag = (event) => {
        event.preventDefault();
        event.stopPropagation();

        isDraggingAnchor.value = true;

        mouse.setStart(event);
        mouse.setLast(event);

        register("add", window, "pointerup", stopAnchorDrag);
    };

    const stopAnchorDrag = () => {
        isDraggingAnchor.value = false;
        register("remove", window, "pointerup", stopAnchorDrag);
    };

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
        event.preventDefault();
        event.stopPropagation();

        emitEvent("layer:transform-menu", true);
        emitEvent("layer:scale", true);

        resizeDirection.value = corner;
        resizeDirectionAnchor(corner);

        mouse.setStart(event);
        mouse.setLast(event);

        props.selectedLayer.forEach(layer => {
            store(layer, "matrix", "__originalMatrix");
        });

        register("add", window, "pointerup", stopTransform);
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
        if (props.animatorState) return;
        if (event.button === 2) return;
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

    const updateLayer = (layer) => {
        const check = hasChanged(layer.__originalMatrix, layer.matrix)
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
        store(layer, "matrix", "__originalMatrix");
        if (event.ctrlKey) {
            if (index === -1) {
                store(layer, "matrix", "__originalMatrix");
                data.push(layer);
                emitEvent('layer:select', data);
            } else {
                data.splice(index, 1);
                emitEvent('layer:select', data);
            }
        } else {
            store(layer, "matrix", "__originalMatrix");
            emitEvent('layer:select',[layer]);
        }
        syncAnchorToSelection();
    };

    const mouseDown = async (event) => {
        event.preventDefault();
        if (props.brush) {
            ui.value.brush.cursor.current = await prepareBrush(props.brushSettings);
            return;
        }
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

                register('add', window, 'pointermove', zoomMouseMove);
                register('add', window, 'pointerup', stopZoomScrub);
            }
            return;
        }
        resetSelection(event);
    };

    const stopTransform = () => {
        register('remove', window, 'pointerup', stopTransform);
        alignModeStep.value = 0;
        rotationPivot.value = null;
        if (props.timeline || props.timelineRecord) emitEvent("timeline:set-keyframe");
        emitEvent('reset:layer-states', false);
        emitEvent('reset:container-states', false);
    };

    const getResizeDirection = (clientX, clientY) => {
        const box = frameBox.value;
        const mousePoint = mouse.screenToWorld(clientX, clientY);

        const left = box.left;
        const right = box.left + box.width;
        const top = box.top;
        const bottom = box.top + box.height;

        const distances = {
            left: Math.abs(mousePoint.x - left),
            right: Math.abs(mousePoint.x - right),
            top: Math.abs(mousePoint.y - top),
            bottom: Math.abs(mousePoint.y - bottom),
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
                const direction = props.layerStates.direction.value
                    ? resizeDirection.value
                    : getResizeDirection(lastMouse.value.x, lastMouse.value.y);

                await startResize(direction, mouse.createEventFromLast());
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

            mouse.init();

            if (grid.value.wrapper.ref) {
                const rect = grid.value.wrapper.ref.getBoundingClientRect();
                grid.value.wrapper.width = rect.width;
                grid.value.wrapper.height = rect.height;
                register('add', grid.value.wrapper.ref, 'pointerdown', resetSelection);
                register('add', grid.value.wrapper.ref, 'contextmenu', onWrapperContextMenu);
            }

            if (grid.value.container.ref) {
                register('add', grid.value.container.ref, 'pointerdown', mouseDown);
                register('add', window, 'pointermove', mouseMove);
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
        ui,
        frameBox,
        cursor,
        anchorScreen,
        emitEvent,
        writeUi,
        toggleSelection,
        startAnchorDrag,
        startRotate,
        startResize,
        onPositionUpdate,
        onRotationUpdate,
        onScaleUpdate,
        onReset
    };
}


export const gridProps = {
    exportState: {
        type: Boolean,
        required: true,
    },
    animatorState: {
        type: Boolean,
        required: true,
    },
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
    cursorVector: {
        type: Object,
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
    selectBox: {
        type: Object,
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
    editText: {
        type: Boolean,
        required: true,
    },
    editTextLayer: {
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
