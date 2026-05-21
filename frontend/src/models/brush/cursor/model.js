import { computed } from "vue";

export function cursorModel(props) {

    const size = computed(() => {
        return Math.max(1, props.brushSettings?.size || 1);
    });

    const angle = computed(() => {
        return props.brushSettings.angle || 0;
    });

    const opacity = computed(() => {
        return props.brushSettings.opacity ?? 1;
    });

    const borderOpacity = computed(() => {
        return Math.min(
            1,
            Math.max(0.55, opacity.value * 1.2)
        );
    });

    const blueOpacity = computed(() => {
        return Math.min(
            1,
            Math.max(0.45, opacity.value * 1.35)
        );
    });

    const className = computed(() => ({
        "brush-cursor--tiny": size.value <= 4,
        "brush-cursor--small": size.value > 4 && size.value <= 12,
    }));

    const style = computed(() => ({
        position: "absolute",
        left: `${props.position?.x || 0}px`,
        top: `${props.position?.y || 0}px`,

        width: `var(--brush-cursor-dynamic-size, var(--brush-cursor-size))`,
        height: `var(--brush-cursor-dynamic-size, var(--brush-cursor-size))`,

        pointerEvents: "none",
        userSelect: "none",
        cursor: "none",

        transform: `
        translate(-50%, -50%)
        rotate(var(--brush-cursor-dynamic-angle, var(--brush-cursor-angle)))
    `,
        transformOrigin: "center center",

        "--brush-cursor-size": `${size.value}px`,
        "--brush-cursor-angle": `${angle.value}deg`,
        "--brush-cursor-opacity": `${opacity.value}`,
        "--brush-cursor-border-opacity": `${borderOpacity.value}`,
        "--brush-cursor-blue-opacity": `${blueOpacity.value}`,
    }));

    const preview = computed(() => ({
        transformOrigin: "center center",
    }));

    const viewBox = computed(() => {
        const viewBoxSize = props.cursorVector?.viewBoxSize || 1;
        return `0 0 ${viewBoxSize} ${viewBoxSize}`;
    });

    const firstPath = computed(() => {
        return props.cursorVector?.paths?.[0] || "";
    });

    return {
        className,
        style,
        preview,
        viewBox,
        firstPath,
    };
}

export const cursorProps = {
    brush: {
        type: Boolean,
        required: true,
    },

    brushSettings: {
        type: Object,
        required: true,
    },

    cursorVector: {
        type: Object,
        required: true,
    },

    position: {
        type: Object,
        required: true,
    }
}