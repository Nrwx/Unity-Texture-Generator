import { computed, ref } from "vue";
import { colorArrayToHex, hexToRgbaArray } from "@/utils/color";
import { clone, hasChanged } from "@/utils/tools";
import { uuid } from "@/utils/uuid";
import { createBitmapMaps, createSurface, PRINCIPLED_SURFACE_GROUPS, TEXTURE_CHANNEL_OPTIONS, TEXTURE_COLOR_MODE_OPTIONS } from "@/dataLayer/webgl";

export const surfaceEditorProps = {
    name: {
        type: String,
        default: "",
    },

    surface: {
        type: Object,
        default: () => createSurface(),
    },

    bitmapMaps: {
        type: Object,
        default: () => createBitmapMaps(),
    },

    textureLayers: {
        type: Array,
        default: () => [],
    },
};

export function surfaceEditorModel(props, emit) {
    const selectedLayer = ref(null);
    const visibleSurfaceSlotKeys = computed(() => {return PRINCIPLED_SURFACE_GROUPS.map(group => group.key);});
    const totalSurfaceSlots = computed(() => {return visibleSurfaceSlotKeys.value.length;});
    const connectedSurfaceSlotKeys = computed(() => {return visibleSurfaceSlotKeys.value.filter(key => {return isBitmapSlotConnected(props.bitmapMaps[key]);});});
    const connectedSurfaceSlots = computed(() => {return connectedSurfaceSlotKeys.value.length;});
    const availableTextureLayers = computed(() => {return props.textureLayers?.length || 0;});
    const colorSlotKeys = computed(() => {return PRINCIPLED_SURFACE_GROUPS.filter(group => group.field?.type === "color").map(group => group.key);});
    const connectedColorSlots = computed(() => {return colorSlotKeys.value.filter(key => {return isBitmapSlotConnected(props.bitmapMaps[key]);}).length;});
    const factorSlotKeys = computed(() => {return PRINCIPLED_SURFACE_GROUPS.filter(group => group.field?.type === "number").map(group => group.key);});
    const connectedFactorSlots = computed(() => {return factorSlotKeys.value.filter(key => {return isBitmapSlotConnected(props.bitmapMaps[key]);}).length;});
    const nodeTextureSlots = computed(() => {return visibleSurfaceSlotKeys.value.filter(key => {const slot = props.bitmapMaps[key];return (slot?.source_type === "shader" || slot?.source_type === "multitexture");}).length;});
    const changedSurfaceValues = computed(() => {const defaults = createSurface();return visibleSurfaceSlotKeys.value.filter(key => {return !hasChanged(props.surface[key], defaults[key]);}).length;});
    const textureImageCount = computed(() => {return props.textureLayers?.length || 0;});
    const selectedTextureImage = computed(() => {return selectedLayer.value;});
    const hasSelectedTextureImage = computed(() => {return Boolean(selectedTextureImage.value);});
    const textureImageHeaderMessage = computed(() => {
        if (!textureImageCount.value) return "Keine Texturen";
        if (!selectedTextureImage.value) return `${textureImageCount.value} Texturen`;
        const width = selectedTextureImage.value.width;
        const height = selectedTextureImage.value.height;
        if (!width || !height) return `${textureImageCount.value} Texturen`;
        return `${width} × ${height}`;
    });

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const ui = ref({
        scrollbar: uuid('surface-scroll'),
        header: computed(() => [
            {
                title: "Surface",
                subtitle: "Belegte Surface-Slots",
                type: "radial",
                label: "Slots",
                value: connectedSurfaceSlots.value,
                max: totalSurfaceSlots.value,
                active: connectedSurfaceSlots.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: "Textur-Abdeckung",
                type: "linear",
                label: "Coverage",
                value: connectedSurfaceSlots.value,
                max: totalSurfaceSlots.value,
                active: connectedSurfaceSlots.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: "Verfügbare Bitmap-Layer",
                type: "counter",
                label: "Layer",
                value: availableTextureLayers.value,
                active: availableTextureLayers.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: "Farb-Slots mit Textur",
                type: "linear",
                label: "Color",
                value: connectedColorSlots.value,
                max: colorSlotKeys.value.length,
                active: connectedColorSlots.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: "Factor- und Masken-Slots",
                type: "linear",
                label: "Factor",
                value: connectedFactorSlots.value,
                max: factorSlotKeys.value.length,
                active: connectedFactorSlots.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: "Angepasste Materialwerte",
                type: "radial",
                label: "Custom",
                value: changedSurfaceValues.value,
                max: totalSurfaceSlots.value,
                active: changedSurfaceValues.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: "Node- und Multi-Texture-Slots",
                type: "counter",
                label: "Nodes",
                value: nodeTextureSlots.value,
                active: nodeTextureSlots.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
            {
                title: "Surface",
                subtitle: connectedSurfaceSlots.value
                    ? "Surface-Setup aktiv"
                    : "Noch keine Texturen verbunden",
                type: "text",
                label: connectedSurfaceSlots.value ? "Aktiv" : "Bereit",
                active: connectedSurfaceSlots.value > 0,
                diashow: true,
                slider: true,
                duration: 7,
            },
        ]),
        layers: {
            scrollbar: uuid('surface-scroll'),
            header: {
                title: 'Texturen',
                icon: 'mdi-image-move',
                subtitle: computed(() => {return textureImageCount.value ? 'Textur per Drag & Drop einem Slot zuweisen' : 'Legen Sie zuerst eine Textur an';}),
                chip: {
                    state: hasSelectedTextureImage,
                    message: {
                        true: textureImageHeaderMessage,
                        default: computed(() => {
                            return textureImageCount.value
                                ? `Verfügbar (${textureImageCount.value})`
                                : '';
                        }),
                        false: 'Keine Texturen'
                    }
                }
            },
        }
    });

    const emitName = () => {
        emit("update:name", props.name);
        emit("change", {
            name: props.name,
            surface: clone(props.surface, 'json'),
            bitmapMaps: clone(props.bitmapMaps, 'json'),
        });
    };

    const emitSurface = () => {
        emit("update:surface", clone(props.surface, 'json'));
        emit("change", {
            name: props.name,
            surface: clone(props.surface, 'json'),
            bitmapMaps: clone(props.bitmapMaps, 'json'),
        });
    };

    const emitBitmapMaps = () => {
        emit("update:bitmapMaps", clone(props.bitmapMaps, 'json'));
        emit("change", {
            name: props.name,
            surface: clone(props.surface, 'json'),
            bitmapMaps: clone(props.bitmapMaps, 'json'),
        });
    };

    const setName = value => {
        props.name = value || "";
        emitName();
    };

    const setLayer = item => {
        selectedLayer.value = item || null;
    };

    const setSurfaceValue = (slotKey, value) => {
        props.surface[slotKey] = value;
        emitSurface();
    };

    const setVectorValue = (slotKey, index, value) => {
        const current = Array.isArray(props.surface[slotKey])
            ? [...props.surface[slotKey]]
            : [0, 0, 0];

        current[index] = Number(value);
        props.surface[slotKey] = current;

        emitSurface();
    };

    const getSurfaceColor = slotKey => {
        return colorArrayToHex(props.surface[slotKey] || [1, 1, 1, 1]);
    };

    const setSurfaceColor = (slotKey, value) => {
        props.surface[slotKey] = hexToRgbaArray(value);
        emitSurface();
    };

    const getMapSlot = slotKey => {
        return props.bitmapMaps[slotKey] || {};
    };

    const setMapSlotValue = (slotKey, key, value) => {
        props.bitmapMaps[slotKey] = {
            ...(props.bitmapMaps[slotKey] || {}),
            [key]: value,
        };

        emitBitmapMaps();
    };

    const setSurfaceSlotChannel = (slotKey, value) => {
        setMapSlotValue(slotKey, "channel", value);
    };

    const setSurfaceTextureSetting = (slotKey, key, value) => {
        setMapSlotValue(slotKey, key, value);
    };

    const getSurfaceSlotIcon = slotKey => {
        const slot = getMapSlot(slotKey);

        if (slot.source_type === "shader") {
            return "mdi-graph-outline";
        }

        if (slot.source_type === "multitexture") {
            return "mdi-image-multiple";
        }

        if (slot.url || slot.layer_id) {
            return "mdi-image";
        }

        return "mdi-tray-arrow-down";
    };

    const getSurfaceSlotLabel = slotKey => {
        const slot = getMapSlot(slotKey);

        if (slot.source_type === "shader") {
            return "Shader Node";
        }

        if (slot.source_type === "multitexture") {
            return "Multi Texture";
        }

        if (slot.name) {
            return slot.name;
        }

        if (slot.layer_id) {
            return slot.layer_id;
        }

        return "No Bitmap";
    };

    const getSurfaceSlotDetail = slotKey => {
        const slot = getMapSlot(slotKey);

        if (slot.source_type === "shader") {
            return slot.node_id || "Node verbunden";
        }

        if (slot.source_type === "multitexture") {
            return `${slot.texture_groups?.length || 0} Texturen`;
        }

        if (slot.url || slot.layer_id) {
            return `${slot.channel || "rgba"} · ${slot.color_mode || "color"}`;
        }

        return "Drop Layer here";
    };

    const isBitmapSlotConnected = slot => {
        return Boolean(
            slot?.enabled ||
            slot?.url ||
            slot?.layer_id ||
            slot?.node_id ||
            slot?.source_type === "shader" ||
            slot?.source_type === "multitexture"
        );
    };

    const clearMapSlot = slotKey => {
        selectedLayer.value = null;
        props.bitmapMaps[slotKey] = {
            ...createBitmapMaps()[slotKey],
        };

        emitBitmapMaps();

        emit("clear-texture-slot", {
            slotKey,
        });
    };

    const handleLayerDragStart = (event, layer) => {
        if (!event?.dataTransfer || !layer?.id) {
            return;
        }

        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", layer.id);
        event.dataTransfer.setData("application/x-layer-id", layer.id);
    };

    const handleMapDrop = (event, slotKey) => {
        event.preventDefault();

        const layerId =
            event.dataTransfer?.getData("application/x-layer-id") ||
            event.dataTransfer?.getData("text/plain") ||
            "";

        if (!layerId) {
            return;
        }

        emit("assign-texture-slot", {
            slotKey,
            layerId,
        });
    };

    return {
        ui,
        selectedLayer,
        PRINCIPLED_SURFACE_GROUPS,
        TEXTURE_CHANNEL_OPTIONS,
        TEXTURE_COLOR_MODE_OPTIONS,

        setLayer,
        setName,
        setSurfaceValue,
        setVectorValue,

        getSurfaceColor,
        setSurfaceColor,

        getMapSlot,
        clearMapSlot,

        handleLayerDragStart,
        handleMapDrop,

        getSurfaceSlotIcon,
        getSurfaceSlotLabel,
        getSurfaceSlotDetail,

        setSurfaceSlotChannel,
        setSurfaceTextureSetting,
        emitEvent
    };
}