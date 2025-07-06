// Zustände für Windows
import {ref} from "vue";

export const windowStates = {
    viewport: ref(true),
    drawerLeft: ref(false),
    drawerRight: ref(false),
    layer: ref(false),
    setting: ref(false),
    dialog: ref(false),
    fullscreen: ref(false),
    drag: ref(false),
    select: ref(false),
    text: ref(false),
    typing: ref(false),
    cursor: ref(false),
    brush: ref(false),
    pen: ref(false),
    context: ref(false),
    color: ref(false),
    drawing: ref(false),
    queue: ref(false)
};

export const modifierStates = {
    fill: ref(false),
};

export const transformStates = {
    menu: ref(false),
    rotate: ref(false),
    transform: ref(false),
    size: ref(false),
    align: ref(false)
};

export const canvasStates = {
    rotate: ref(false),
    transform: ref(false),
    size: ref(false),
    zoom: ref(false),
    select: ref(false),
};

export const contextStates = {
    copy: ref(false),
};

export const backupStates = {
    global: ref([]),
    action: ref('')
};