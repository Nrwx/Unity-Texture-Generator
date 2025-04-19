import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { key } from "@/dataLayer/key";

export function selectionModel(props, emit) {
    const selecting = ref(false);
    const start = ref({ x: 0, y: 0 });
    const end = ref({ x: 0, y: 0 });

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


    const stopAnimation = () => {
        cancelAnimationFrame(animationFrameId);
    };

    const getMousePosition = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    onMounted(startAnimation);
    onBeforeUnmount(stopAnimation);

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const isProportional = computed(() => {
        return props.shape === "square" || props.shape === "circle" || key.shift.value;
    });

    const isCircleOrEllipse = computed(() => {
        return props.shape === "ellipse" || props.shape === "circle";
    });

    const onKeyDown = (e) => {
        if (e.key === "Shift") key.shift.value = true;
    };

    const onKeyUp = (e) => {
        if (e.key === "Shift") key.shift.value = false;
    };

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

        emitEvent("select-state", {
            x,
            y,
            width,
            height,
            shape: props.shape,
            state: false,
        });
    };

    const width = computed(() => Math.abs(end.value.x - start.value.x));
    const height = computed(() => Math.abs(end.value.y - start.value.y));
    const left = computed(() => Math.min(start.value.x, end.value.x));
    const top = computed(() => Math.min(start.value.y, end.value.y));

    const boxStyle = computed(() => ({
        left: `${left.value}px`,
        top: `${top.value}px`,
        width: `${width.value}px`,
        height: `${height.value}px`,
    }));

    const svgStyle = computed(() => ({
        position: "absolute",
        left: `${left.value}px`,
        top: `${top.value}px`,
        width: `${width.value}px`,
        height: `${height.value}px`,
    }));

    const shapeTag = computed(() => {
        if (props.shape === "circle" || props.shape === "ellipse") return "ellipse";
        return "rect";
    });

    const shapeAttrs = computed(() => {
        if (props.shape === "circle") {
            const r = Math.min(width.value, height.value) / 2;
            return {
                cx: r,
                cy: r,
                rx: r,
                ry: r,
            };
        } else if (props.shape === "ellipse") {
            return {
                cx: width.value / 2,
                cy: height.value / 2,
                rx: width.value / 2,
                ry: height.value / 2,
            };
        } else {
            return {
                x: 0,
                y: 0,
                width: width.value,
                height: height.value,
            };
        }
    });

    return {
        selecting,
        isCircleOrEllipse,
        onKeyDown,
        onKeyUp,
        onMouseUp,
        onMouseMove,
        onMouseDown,
        boxStyle,
        svgStyle,
        shapeTag,
        shapeAttrs,
        dashOffset,
        shineOffset,
        reverseDashOffset,
        reverseShineOffset,
        emitEvent,
    };
}

export const selectionProps = {
    state: Boolean,
    shape: {
        type: String,
        default: "rectangle", // 'rectangle' | 'square' | 'ellipse' | 'circle'
    },
};
