import { computed, nextTick, onUpdated, ref } from "vue";

export function keyModel(props) {
    const isCollapsed = ref(true);
    const logWindowRef = ref(null);

    const toggleCollapse = () => {
        isCollapsed.value = !isCollapsed.value;
    };

    const collapsedHeight = computed(() => {
        if (!isCollapsed.value) return "400px";
        if (props.keys.length >= 3) return "175px";
        if (props.keys.length === 2) return "135px";
        return "90px";
    });

    const getKeySizeClass = (keyName) => {
        if (!keyName || typeof keyName !== 'string') return '';

        if (keyName.length > 10 || keyName.includes('+')) return 'extra-wide';

        if (['Control', 'Alt', 'Meta', 'Enter', 'Shift', 'Space', 'Backspace'].some(k => keyName.includes(k))) {
            return 'wide';
        }

        return '';
    };

    onUpdated(async () => {
        await nextTick(() => {
            if (logWindowRef.value) {
                logWindowRef.value.scrollTop = logWindowRef.value.scrollHeight;
            }
        });
    });

    return {
        isCollapsed,
        toggleCollapse,
        collapsedHeight,
        logWindowRef,
        getKeySizeClass
    };
}

export const keyProps = {
    keys: {
        type: Array,
        required: true,
    },
    heldKeys: {
        type: [Array, Set, Map],
        required: true
    }
};
