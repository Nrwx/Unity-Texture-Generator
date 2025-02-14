import { ref, onMounted, onUnmounted } from 'vue';
import dayjs from 'dayjs';

export function useKeyboardMouseManager() {
    const activeKeys = ref(new Set());
    const eventHandlers = ref({});
    const shortcutHandlers = ref({});
    const keyPressDurations = ref({});
    const holdThreshold = 100; // in milliseconds
    const isTouchActive = ref(false);

    const addEvent = (key, callback) => {
        eventHandlers.value[key] = callback;
    };

    const delEvent = (key) => {
        delete eventHandlers.value[key];
    };

    const addShortcutListener = (keys, callback) => {
        const shortcutKey = keys.sort().join('+');
        shortcutHandlers.value[shortcutKey] = callback;
    };

    const removeShortcutListener = (keys) => {
        const shortcutKey = keys.sort().join('+');
        delete shortcutHandlers.value[shortcutKey];
    };

    const keyDownHandler = (event) => {
        isTouchActive.value = false;
        if (!activeKeys.value.has(event.key)) {
            keyPressDurations.value[event.key] = dayjs();
        }
        activeKeys.value.add(event.key);

        setTimeout(() => {
            if (activeKeys.value.has(event.key)) {
                if (eventHandlers.value[event.key]) {
                    eventHandlers.value[event.key]({ ...event, held: true });
                }
            }
        }, holdThreshold);

        if (eventHandlers.value[event.key]) {
            eventHandlers.value[event.key](event);
        }

        const activeShortcut = Array.from(activeKeys.value).sort().join('+');
        if (shortcutHandlers.value[activeShortcut]) {
            shortcutHandlers.value[activeShortcut](event);
        }
    };

    const keyUpHandler = (event) => {
        //const pressDuration = dayjs().diff(keyPressDurations.value[event.key]);
        delete keyPressDurations.value[event.key];
        activeKeys.value.delete(event.key);
    };

    const mouseHandler = (event) => {
        isTouchActive.value = false;
        const mouseEventKey = `mouse_${event.type}`;
        if (eventHandlers.value[mouseEventKey]) {
            eventHandlers.value[mouseEventKey](event);
        }
    };

    const touchHandler = (event) => {
        isTouchActive.value = true;
        const touchEventKey = `touch_${event.type}`;
        if (eventHandlers.value[touchEventKey]) {
            eventHandlers.value[touchEventKey](event);
        }
    };

    onMounted(() => {
        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);
        window.addEventListener('mousedown', mouseHandler);
        window.addEventListener('mouseup', mouseHandler);
        window.addEventListener('mousemove', mouseHandler);
        window.addEventListener('touchstart', touchHandler);
        window.addEventListener('touchend', touchHandler);
        window.addEventListener('touchmove', touchHandler);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', keyDownHandler);
        window.removeEventListener('keyup', keyUpHandler);
        window.removeEventListener('mousedown', mouseHandler);
        window.removeEventListener('mouseup', mouseHandler);
        window.removeEventListener('mousemove', mouseHandler);
        window.removeEventListener('touchstart', touchHandler);
        window.removeEventListener('touchend', touchHandler);
        window.removeEventListener('touchmove', touchHandler);
    });

    return {
        activeKeys,
        addEventListener,
        removeEventListener,
        addShortcutListener,
        removeShortcutListener,
        addEvent,
        delEvent,
        keyPressDurations,
        isTouchActive,
    };
}
