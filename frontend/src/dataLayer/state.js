// Zustände für Windows
import {ref} from "vue";

export const windowStates = {
    viewport: ref(true),
    drawerLeft: ref(false),
    drawerRight: ref(false),
    layer: ref(false),
    setting: ref(false),
    fullscreen: ref(false),
    drag: ref(false),
    select: ref(false)
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