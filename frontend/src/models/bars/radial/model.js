import {computed} from "vue";

export function radialModel(props, emit) {
    const emitEvent = (event, payload) => emit("component-event", event, payload);
    const gradId = `g-${Math.random().toString(36).slice(2,8)}`;

// clamp and compute percent
    const percent = computed(() => {
        const v = Math.max(0, Math.min(props.value || 0, props.max || 1));
        const mx = props.max || 1;
        return (v / mx) * 100;
    });

    const circumference = 2 * Math.PI * 40;
    const progressStyle = computed(() => {
        const offset = circumference * (1 - percent.value / 100);
        return {
            strokeDasharray: `${circumference}`,
            strokeDashoffset: `${offset}`,
            transition: "stroke-dashoffset 900ms cubic-bezier(.2,.9,.2,1)",
            stroke: `url(#${gradId})`
        };
    });

    const displayValue = computed(() => {
        // If value looks like percent (max=100) show percent
        if (props.max === 100) return Math.round(props.value) + "%";
        return props.value;
    });

    const smallLabel = computed(() => props.label || props.title || "");
    return {
        gradId,
        percent,
        circumference,
        progressStyle,
        displayValue,
        smallLabel,
        emitEvent
    };
}

export const radialProps = {
    theme: {
        type: String,
        required: true,
    },
    value: {
        type: Number,
        required: true
    },
    max: {
        type: Number,
        default: 100
    },
    size: {
        type: Number,
        default: 150
    },
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    label: {
        type: String,
        default: ""
    },
    textPosition: {
        type: String,
        default: ""
    },
};