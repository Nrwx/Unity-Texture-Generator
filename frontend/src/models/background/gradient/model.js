// models/background/gradient/model.js
import { computed } from "vue";

export const gradientProps = {
    baseColor: {
        type: String,
        default: "#1976d2",
    },
    id: {
        type: String,
        default: "animated-gradient",
    },
};

export function gradientModel(props) {
    const gradientId = computed(() => {
        return props.id ? `grad-${props.id}` : `grad-fallback`;
    });

    const lightenDarkenColor = (hex, percent) => {
        const num = parseInt(hex.replace("#", ""), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + percent));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
        const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
    };

    const generateGradientSteps = (type = "light") => {
        const base = props.baseColor || "#1976d2";
        const steps = [];
        for (let i = 0; i < 5; i++) {
            const amount = type === "light" ? i * 12 : -i * 12;
            steps.push(lightenDarkenColor(base, amount));
        }
        return steps;
    };

    const lightSteps = computed(() => generateGradientSteps("light"));
    const darkSteps = computed(() => generateGradientSteps("dark"));

    const getAnimatedStops = (base, type) => {
        const steps = type === "light" ? lightSteps.value : darkSteps.value;
        console.log("gradientId", gradientId.value);
        console.log("props.id", props.id);
        return [...steps, ...steps.reverse()].join(";");
    };

    return {
        gradientId,
        lightSteps,
        darkSteps,
        getAnimatedStops,
    };
}
