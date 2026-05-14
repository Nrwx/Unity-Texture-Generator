import { uuid } from "@/utils/uuid";
import {computed} from "vue";
import {containerStates, layerStates, windowStates} from "@/dataLayer/state";

export const statusBarItems = [
    {
        id: uuid(),
        key: "select",
        icon: "mdi-cursor-default-outline",
        color: "#5ba669",
        priority: 10,
        active: computed(() => {
            return windowStates.cursor.value;
        }),
        temporary: false,
        hidden: false,
        tooltip: "Auswahl aktiv",
    },
    {
        id: uuid(),
        key: "select",
        icon: "mdi-select",
        color: "#4f8cff",
        priority: 10,
        active: computed(() => {
            return windowStates.select.value;
        }),
        temporary: false,
        hidden: false,
        tooltip: "Maskierung aktiv",
    },
    {
        id: uuid(),
        key: "translate",
        icon: "mdi-arrow-all",
        color: "#22c55e",
        priority: 20,
        active: computed(() => {
            return layerStates.translate.value || containerStates.translate.value;
        }),
        temporary: false,
        hidden: false,
        tooltip: "Verschieben aktiv",
    },
    {
        id: uuid(),
        key: "zoom",
        icon: "mdi-magnify-plus-outline",
        color: "#a855f7",
        priority: 30,
        active: computed(() => {
            return containerStates.scale.value;
        }),
        temporary: true,
        hidden: false,
        tooltip: "Zoom aktiv",
    },
    {
        id: uuid(),
        key: "rotate",
        icon: "mdi-rotate-right",
        color: "#f97316",
        priority: 50,
        active: computed(() => {
            return layerStates.rotate.value || containerStates.rotate.value;
        }),
        temporary: false,
        hidden: false,
        tooltip: "Rotation aktiv",
    },
    {
        id: uuid(),
        key: "scale",
        icon: "mdi-resize",
        color: "#06b6d4",
        priority: 60,
        active: computed(() => {
            return layerStates.scale.value;
        }),
        temporary: false,
        hidden: false,
        tooltip: "Scale aktiv",
    },
    {
        id: uuid(),
        key: "brush",
        icon: "mdi-brush",
        color: "#ef4444",
        priority: 70,
        active: computed(() => {
            return windowStates.brush.value;
        }),
        temporary: false,
        hidden: false,
        tooltip: "Brush aktiv",
    },
];