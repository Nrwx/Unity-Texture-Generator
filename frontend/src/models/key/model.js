import { computed, nextTick, onMounted, onUnmounted, onUpdated, ref } from "vue";
import dayjs from "dayjs";

export function keyModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const keys = ref([]);
    const heldKeys = ref(new Map());
    const isCollapsed = ref(true);
    const logWindowRef = ref(null);
    const modifiersDown = ref(new Set());
    const isCombination = ref(false);

    const normalizeKey = (event) => {
        const modifiers = [];
        if (event.ctrlKey) modifiers.push("Control");
        if (event.altKey) modifiers.push("Alt");
        if (event.metaKey) modifiers.push("Meta");
        if (event.shiftKey) modifiers.push("Shift");

        const key = event.key === " " ? "Space" : event.key;

        // Verhindere Dopplung: Wenn key selbst ein Modifier ist → Spezialformat
        if (['Control', 'Alt', 'Meta', 'Shift'].includes(key)) {
            return `${key}`;
        }

        return modifiers.length ? `${modifiers.join(" + ")} + ${key}` : key;
    };

    const collapsedHeight = computed(() => {
        if (!isCollapsed.value) return '400px';
        if (keys.value.length >= 3) return '175px';
        if (keys.value.length === 2) return '135px';
        return '90px';
    });

    const getKeySizeClass = (keyName) => {
        if (keyName.length > 10 || keyName.includes('+')) return 'extra-wide';
        if (['Control', 'Alt', 'Meta', 'Enter', 'Shift', 'Space', 'Backspace'].some(k => keyName.includes(k))) {
            return 'wide';
        }
        return '';
    };

    const handleKeyDown = (event) => {
        const rawKey = event.key;
        const timestamp = dayjs().valueOf();

        // Modifier?
        const isModifier = ['Control', 'Alt', 'Meta', 'Shift'].includes(rawKey);
        const keyName = normalizeKey(event);

        // Key bereits aktiv? (z.B. gehalten)
        if (heldKeys.value.has(keyName)) return;

        const keyEntry = {
            id: timestamp,
            name: keyName,
            held: true,
        };

        heldKeys.value.set(keyName, keyEntry);
        keys.value.push(keyEntry);

        // Modifier separat tracken (unter ihrem RawKey-Namen, damit Up funktioniert)
        if (isModifier && !modifiersDown.value.has(rawKey)) {
            modifiersDown.value.add(rawKey);
        }

        if (keys.value.length > 50) keys.value.shift();
    };

    const handleKeyUp = (event) => {
        const rawKey = event.key;

        // Modifier?
        const isModifier = ['Control', 'Alt', 'Meta', 'Shift'].includes(rawKey);
        const modKey = `${rawKey}`;
        const comboKey = normalizeKey(event);

        // Modifier loslassen
        if (isModifier && heldKeys.value.has(modKey)) {
            heldKeys.value.get(modKey).held = false;
            heldKeys.value.delete(modKey);
            modifiersDown.value.delete(rawKey);
        }

        // Kombination loslassen
        if (!isModifier && heldKeys.value.has(comboKey)) {
            heldKeys.value.get(comboKey).held = false;
            heldKeys.value.delete(comboKey);
        }

        isCombination.value = false;
    };


    const toggleCollapse = () => {
        isCollapsed.value = !isCollapsed.value;
    };

    const lastKey = computed(() => keys.value[keys.value.length - 1] ?? null);

    onMounted(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
    });

    onUnmounted(() => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("keyup", handleKeyUp);
    });

    onUpdated(async () => {
        await nextTick(() => {
            if (logWindowRef.value) {
                logWindowRef.value.scrollTop = logWindowRef.value.scrollHeight;
            }
        });
    });

    return {
        keys,
        lastKey,
        isCollapsed,
        logWindowRef,
        toggleCollapse,
        collapsedHeight,
        getKeySizeClass,
        emitEvent,
    };
}

export const keyProps = {};
