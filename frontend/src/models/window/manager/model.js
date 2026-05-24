import { computed, ref } from "vue";

const windows = ref({});
const activeId = ref(null);
const stackIndex = ref(0);

const registerWindow = payload => {
    if (!payload?.id) return null;

    windows.value[payload.id] = {
        id: payload.id,
        title: payload.title,
        icon: payload.icon,
        state: payload.state,
        closeEvent: payload.closeEvent,
        compact: payload.compact,
        disabled: payload.disabled,
        zIndex: payload.zIndex,
        stackIndex: payload.stackIndex || 0,
        startPosition: payload.startPosition,
        offset: payload.offset || { x: 0, y: 0 },
    };

    return windows.value[payload.id];
};

const updateWindow = payload => {
    if (!payload?.id || !windows.value[payload.id]) return null;

    windows.value[payload.id] = {
        ...windows.value[payload.id],
        ...payload,
    };

    return windows.value[payload.id];
};

const unregisterWindow = id => {
    if (!id || !windows.value[id]) return null;

    const current = windows.value[id];

    delete windows.value[id];

    if (activeId.value === id) {
        activeId.value = null;
    }

    return current;
};

const focusWindow = id => {
    if (!id || !windows.value[id]) return null;

    stackIndex.value += 1;

    windows.value[id].zIndex = 90 + stackIndex.value;
    windows.value[id].stackIndex = stackIndex.value;
    activeId.value = id;

    return windows.value[id];
};

const resetWindow = id => {
    if (!id || !windows.value[id]) return null;

    windows.value[id].offset = { x: 0, y: 0 };

    return windows.value[id];
};

const resetAllWindows = () => {
    Object.keys(windows.value).forEach(resetWindow);
    return windows.value;
};

const closeWindow = id => {
    if (!id || !windows.value[id]) return null;

    windows.value[id].state = false;

    if (activeId.value === id) {
        activeId.value = null;
    }

    return windows.value[id];
};

const closeAllWindows = () => {
    Object.keys(windows.value).forEach(closeWindow);
    return windows.value;
};

const getWindowMeta = id => {
    if (!id) return windows.value;
    return windows.value[id] || null;
};

const windowMeta = computed(() => Object.values(windows.value));

const visibleWindows = computed(() => (
    windowMeta.value.filter(item => item.state)
));

const stacked = computed(() => (
    [...visibleWindows.value].sort((a, b) => b.zIndex - a.zIndex)
));

export const windowManager = {
    windows,
    activeId,
    stackIndex,

    windowMeta,
    visibleWindows,
    stacked,

    registerWindow,
    updateWindow,
    unregisterWindow,

    focusWindow,

    resetWindow,
    resetAllWindows,

    closeWindow,
    closeAllWindows,

    getWindowMeta,
};