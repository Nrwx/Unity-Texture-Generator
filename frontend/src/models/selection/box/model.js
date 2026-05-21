import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { uuid } from "@/utils/uuid";

const DEFAULT_BOX = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
};

const DEFAULT_PATH_WIDTH = 12;

const normalizeNumber = (value, fallback = 0) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return number;
};

const normalizeBox = box => {
    return {
        x: normalizeNumber(box?.x, DEFAULT_BOX.x),
        y: normalizeNumber(box?.y, DEFAULT_BOX.y),
        width: Math.max(1, normalizeNumber(box?.width, DEFAULT_BOX.width)),
        height: Math.max(1, normalizeNumber(box?.height, DEFAULT_BOX.height)),
    };
};

const getPointsBounds = (points, strokeWidth = DEFAULT_PATH_WIDTH) => {
    if (!Array.isArray(points) || !points.length) {
        return normalizeBox(null);
    }

    const xs = points.map(point => normalizeNumber(point.x, 0));
    const ys = points.map(point => normalizeNumber(point.y, 0));
    const radius = strokeWidth / 2;

    const left = Math.min(...xs) - radius;
    const top = Math.min(...ys) - radius;
    const right = Math.max(...xs) + radius;
    const bottom = Math.max(...ys) + radius;

    return {
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
};

const pointsToPath = points => {
    if (!Array.isArray(points) || !points.length) {
        return "";
    }

    if (points.length === 1) {
        const point = points[0];
        return `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y + 0.01}`;
    }

    return points
        .map((point, index) => {
            return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
        })
        .join(" ");
};

export function selectionVectorBoxModel(props) {
    const uid = uuid("selection-vector");

    const dashOffset = ref(0);
    const reverseDashOffset = ref(0);
    const shineOffset = ref(0);
    const reverseShineOffset = ref(0);

    let animationFrameId = null;

    const isPathMode = computed(() => {
        return props.type === "path";
    });

    const pathWidth = computed(() => {
        return Math.max(1, normalizeNumber(props.strokeWidth, DEFAULT_PATH_WIDTH));
    });

    const sourceBox = computed(() => {
        if (isPathMode.value) {
            return getPointsBounds(props.points, pathWidth.value);
        }

        return normalizeBox(props.box);
    });

    const safeX = computed(() => sourceBox.value.x);
    const safeY = computed(() => sourceBox.value.y);
    const safeWidth = computed(() => sourceBox.value.width);
    const safeHeight = computed(() => sourceBox.value.height);

    const svgStyle = computed(() => {
        return {
            position: "absolute",
            left: `${safeX.value}px`,
            top: `${safeY.value}px`,
            width: `${safeWidth.value}px`,
            height: `${safeHeight.value}px`,
            pointerEvents: "none",
            overflow: "visible",
        };
    });

    const viewBox = computed(() => {
        return `0 0 ${safeWidth.value} ${safeHeight.value}`;
    });

    const normalizedShape = computed(() => {
        if (["rectangle", "square", "ellipse", "circle"].includes(props.shape)) {
            return props.shape;
        }

        return "rectangle";
    });

    const vectorTag = computed(() => {
        if (isPathMode.value) {
            return "path";
        }

        return normalizedShape.value === "circle" || normalizedShape.value === "ellipse"
            ? "ellipse"
            : "rect";
    });

    const localPoints = computed(() => {
        if (!Array.isArray(props.points)) {
            return [];
        }

        return props.points.map(point => ({
            x: normalizeNumber(point.x, 0) - safeX.value,
            y: normalizeNumber(point.y, 0) - safeY.value,
        }));
    });

    const vectorAttrs = computed(() => {
        if (isPathMode.value) {
            return {
                d: pointsToPath(localPoints.value),
            };
        }

        if (normalizedShape.value === "circle") {
            const size = Math.min(safeWidth.value, safeHeight.value);
            const radius = Math.max(1, size / 2 - 1);

            return {
                cx: safeWidth.value / 2,
                cy: safeHeight.value / 2,
                rx: radius,
                ry: radius,
            };
        }

        if (normalizedShape.value === "ellipse") {
            return {
                cx: safeWidth.value / 2,
                cy: safeHeight.value / 2,
                rx: Math.max(1, safeWidth.value / 2 - 1),
                ry: Math.max(1, safeHeight.value / 2 - 1),
            };
        }

        return {
            x: 1,
            y: 1,
            width: Math.max(1, safeWidth.value - 2),
            height: Math.max(1, safeHeight.value - 2),
        };
    });

    const gradientId = `selection-gradient-${uid}`;
    const reverseGradientId = `selection-gradient-reverse-${uid}`;
    const shineGradientId = `selection-shine-${uid}`;
    const reverseShineGradientId = `selection-shine-reverse-${uid}`;

    const baseStrokeWidth = computed(() => {
        return isPathMode.value ? pathWidth.value : 2;
    });

    const shadowStrokeWidth = computed(() => {
        return isPathMode.value ? pathWidth.value + 2 : 2;
    });

    const commonStrokeAttrs = computed(() => {
        return {
            ...vectorAttrs.value,
            fill: "none",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
        };
    });

    const shadowAttrs = computed(() => ({
        ...commonStrokeAttrs.value,
        stroke: "rgba(0, 0, 0, 0.7)",
        "stroke-width": shadowStrokeWidth.value,
    }));

    const baseAttrs = computed(() => ({
        ...commonStrokeAttrs.value,
        stroke: `url(#${gradientId})`,
        "stroke-width": baseStrokeWidth.value,
        "stroke-dasharray": "3 8",
        "stroke-dashoffset": dashOffset.value,
    }));

    const reverseAttrs = computed(() => ({
        ...commonStrokeAttrs.value,
        stroke: `url(#${reverseGradientId})`,
        "stroke-width": baseStrokeWidth.value,
        "stroke-dasharray": "3 8",
        "stroke-dashoffset": reverseDashOffset.value,
        opacity: 0.7,
    }));

    const shineAttrs = computed(() => ({
        ...commonStrokeAttrs.value,
        stroke: `url(#${shineGradientId})`,
        "stroke-width": baseStrokeWidth.value,
        "stroke-dasharray": "2 14",
        "stroke-dashoffset": shineOffset.value,
    }));

    const reverseShineAttrs = computed(() => ({
        ...commonStrokeAttrs.value,
        stroke: `url(#${reverseShineGradientId})`,
        "stroke-width": baseStrokeWidth.value,
        "stroke-dasharray": "2 14",
        "stroke-dashoffset": reverseShineOffset.value,
    }));

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
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };

    onMounted(() => {
        startAnimation();
    });

    onBeforeUnmount(() => {
        stopAnimation();
    });

    return {
        svgStyle,
        viewBox,
        normalizedShape,
        vectorTag,

        gradientId,
        reverseGradientId,
        shineGradientId,
        reverseShineGradientId,

        shadowAttrs,
        baseAttrs,
        reverseAttrs,
        shineAttrs,
        reverseShineAttrs,
    };
}

export const selectionVectorBoxProps = {
    type: {
        type: String,
        required: false,
        default: "box",
    },
    box: {
        type: Object,
        required: false,
        default: null,
    },
    points: {
        type: Array,
        required: false,
        default: () => [],
    },
    strokeWidth: {
        type: Number,
        required: false,
        default: DEFAULT_PATH_WIDTH,
    },
    shape: {
        type: String,
        required: false,
        default: "rectangle",
    },
};