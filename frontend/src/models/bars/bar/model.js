import {computed} from "vue";

export function barModel(props, emit) {
    const emitEvent = (event, payload) => emit("component-event", event, payload);
    const percent = computed(() => {
        return Math.max(0, Math.min(100, (props.value / (props.max || 1)) * 100));
    });

    const fillStyle = computed(() => ({
        width: `${percent.value}%`,
        transition: 'width 800ms cubic-bezier(.2,.9,.2,1)'
    }));

    const sparkStyle = computed(() => ({
        left: `${percent.value}%`,
        opacity: percent.value > 3 ? 1 : 0,
        transition: 'left 800ms cubic-bezier(.2,.9,.2,1), opacity 400ms'
    }));
    return {
        percent,
        fillStyle,
        sparkStyle,
        emitEvent
    };
}

export const barProps = {
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
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    suffix: {
        type: String,
        default: ""
    },
    metaText: {
        type: String,
        default: ""
    },
};