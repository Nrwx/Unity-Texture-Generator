// Zustände für Windows
import {ref} from "vue";

export const windowStates = {
    viewport: ref(true),
    drawerLeft: ref(false),
    drawerRight: ref(false),
    layer: ref(false),
    setting: ref(false),
    fullscreen: ref(false),
};

export const keyStates = {
    z: ref(false),
    w: ref(false),
};

export const transformStates = {
    rotate: ref(false),
    transform: ref(false),
    size: ref(false),
    zoom: ref(false),
};

export const canvasStates = {
    rotate: ref(false),
    transform: ref(false),
    size: ref(false),
    zoom: ref(false),
    select: ref(false),
};