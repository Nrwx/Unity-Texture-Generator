import {computed, ref, onMounted, onBeforeUnmount} from "vue";
import { key } from "@/dataLayer/key";

export function selectionModel(props, emit) {
    const panel = ref(null);
    const selecting = ref(false);
    const start = ref({ x: 0, y: 0 });
    const end = ref({ x: 0, y: 0 });
    const selectionBox = ref(null);

    const dashOffset = ref(0);
    const reverseDashOffset = ref(0);
    const shineOffset = ref(0);
    const reverseShineOffset = ref(0);

    let animationFrameId;

    const startAnimation = () => {
        const animate = () => {
            dashOffset.value = (dashOffset.value + 0.4) % 20;
            reverseDashOffset.value = (reverseDashOffset.value - 0.4 + 20) % 20;
            shineOffset.value = (shineOffset.value + 1) % 150;
            reverseShineOffset.value = (reverseShineOffset.value - 1 + 100) % 100;

            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
    };

    const stopAnimation = () => cancelAnimationFrame(animationFrameId);

    const getMousePosition = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    onMounted(async () => {
        startAnimation();
        register('add', panel.value, 'mousedown', onMouseDown);
        register('add', panel.value, 'mouseup', onMouseUp);
        register('add', panel.value, 'mousemove', onMouseMove);
        register('add', document, 'keydown', onKeyDown);
        register('add', document, 'keyup', onKeyUp);
        register('pause')
    });

    onBeforeUnmount(() => {
        stopAnimation();
        register('removeAll');
    });

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const register = (mode, target, type = null, handler = null) => {
        const id = 'listener:select-mask';

        switch (mode) {
            case 'add':
                if (!target) {
                    console.warn(`Target element not found`);
                    return;
                }
                emitEvent('event:listener', {
                    add: true,
                    id: id,
                    target: target,
                    type: type,
                    handler: handler,
                    options: false,
                    active: true,
                });
                break;

            case 'removeAll':
                emitEvent('event:listener', {
                    removeAll: true,
                    id,
                });
                break;

            case 'pause':
                emitEvent('event:listener', {
                    pause: true,
                    id
                });
                break;

            default:
                console.warn(`Unknown mode '${mode}' passed to register()`);
        }
    };


    const onKeyDown = (e) => {
        if (e.key === "Shift" && !key.shift.value) {
            key.shift.value = true;
            switch (props.shape) {
                case "rectangle":
                    emitEvent('select:mask-shape', "square")
                    break;
                case "square":
                    emitEvent('select:mask-shape', "rectangle")
                    break;
                case "ellipse":
                    emitEvent('select:mask-shape', "circle")
                    break;
                case "circle":
                    emitEvent('select:mask-shape', "ellipse")
                    break;
            }
        }
    };

    const onKeyUp = (e) => {
        e.preventDefault();
        key.shift.value = false;
        emitEvent('select:mask-shape', props.shape)
    };

    const isProportional = computed(() => {
        return props.shape === "square" || props.shape === "circle";
    });

    const isCircleOrEllipse = computed(() => {
        return props.shape === "ellipse" || props.shape === "circle";
    });

    const onMouseDown = (e) => {
        if (!props.state) return;
        const pos = getMousePosition(e);
        selecting.value = true;
        start.value = { ...pos };
        end.value = { ...pos };
    };

    const onMouseMove = (e) => {
        if (!props.state || !selecting.value) return;
        const pos = getMousePosition(e);
        let dx = pos.x - start.value.x;
        let dy = pos.y - start.value.y;

        if (isProportional.value) {
            const size = Math.min(Math.abs(dx), Math.abs(dy));
            dx = dx < 0 ? -size : size;
            dy = dy < 0 ? -size : size;
        }

        end.value = {
            x: start.value.x + dx,
            y: start.value.y + dy,
        };
    };

    const onMouseUp = () => {
        if (!props.state || !selecting.value) return;
        selecting.value = false;

        const x = Math.min(start.value.x, end.value.x);
        const y = Math.min(start.value.y, end.value.y);
        const width = Math.abs(start.value.x - end.value.x);
        const height = Math.abs(start.value.y - end.value.y);

        selectionBox.value = { x, y, width, height };
    };

    const activeBox = computed(() => {
        if (selecting.value) {
            const x = Math.min(start.value.x, end.value.x);
            const y = Math.min(start.value.y, end.value.y);
            const width = Math.abs(start.value.x - end.value.x);
            const height = Math.abs(start.value.y - end.value.y);
            return { x, y, width, height };
        } else if (selectionBox.value) {
            return selectionBox.value;
        } else {
            return null;
        }
    });

    const svgStyle = computed(() => {
        if (!activeBox.value) return {};
        return {
            position: "absolute",
            left: `${activeBox.value.x}px`,
            top: `${activeBox.value.y}px`,
            width: `${activeBox.value.width}px`,
            height: `${activeBox.value.height}px`,
        };
    });

    const shapeAttrs = computed(() => {
        const box = activeBox.value;
        if (!box) return {};

        if (props.shape === "circle") {
            const r = Math.min(box.width, box.height) / 2;
            return { cx: r, cy: r, rx: r, ry: r };
        } else if (props.shape === "ellipse") {
            return {
                cx: box.width / 2,
                cy: box.height / 2,
                rx: box.width / 2,
                ry: box.height / 2,
            };
        } else {
            return {
                x: 0,
                y: 0,
                width: box.width,
                height: box.height,
            };
        }
    });

    const shapeTag = computed(() =>
        props.shape === "circle" || props.shape === "ellipse" ? "ellipse" : "rect"
    );

    return {
        panel,
        selecting,
        isCircleOrEllipse,
        onKeyDown,
        onKeyUp,
        onMouseUp,
        onMouseMove,
        onMouseDown,
        svgStyle,
        shapeTag,
        shapeAttrs,
        dashOffset,
        shineOffset,
        reverseDashOffset,
        reverseShineOffset
    };
}

export const selectionProps = {
    state: {
        type: Boolean,
        required: true
    },
    shape: {
        type: String,
        required: true
    },
};
