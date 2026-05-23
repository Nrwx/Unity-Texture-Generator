import { computed, reactive, watch } from "vue";
import { colorArrayToHex, hexToRgbaArray } from "@/utils/color";
import { Node } from "@/view/models/page/material/core/Node/Node";

export const SURFACE_FIELDS = Object.freeze([
    { key: "baseColor", label: "Base Color", type: "color" },
    { key: "subsurface", label: "Subsurface", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "subsurfaceRadius", label: "Subsurface Radius", type: "vector3" },
    { key: "subsurfaceColor", label: "Subsurface Color", type: "color" },
    { key: "subsurfaceScale", label: "Subsurface Scale", type: "number", min: 0, max: 50, step: 0.01 },
    { key: "subsurfaceIor", label: "Subsurface IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "subsurfaceAnisotropy", label: "Subsurface Anisotropy", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "metallic", label: "Metallic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specular", label: "Specular IOR Level", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specularTint", label: "Specular Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "roughness", label: "Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "diffuseRoughness", label: "Diffuse Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropic", label: "Anisotropic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropicRotation", label: "Anisotropic Rotation", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheen", label: "Sheen", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenRoughness", label: "Sheen Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenTint", label: "Sheen Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoat", label: "Coat Weight", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatRoughness", label: "Coat Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "coatIor", label: "Coat IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "coatTint", label: "Coat Tint", type: "color" },
    { key: "ior", label: "IOR", type: "number", min: 1, max: 4, step: 0.001 },
    { key: "transmission", label: "Transmission Weight", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "transmissionRoughness", label: "Transmission Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "emission", label: "Emission", type: "color" },
    { key: "emissionStrength", label: "Emission Strength", type: "number", min: 0, max: 10, step: 0.01 },
    { key: "thinFilmThickness", label: "Thin Film Thickness", type: "number", min: 0, max: 1200, step: 1 },
    { key: "thinFilmIor", label: "Thin Film IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "alpha", label: "Alpha", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "normal", label: "Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatNormal", label: "Clearcoat Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "tangent", label: "Tangent", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "bumpStrength", label: "Bump / Height", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "displacementStrength", label: "Displacement Height", type: "number", min: 0, max: 1, step: 0.001, hidden: true },
]);

export const SURFACE_FIELD_MAP = Object.freeze(
    SURFACE_FIELDS.reduce((acc, field) => {
        acc[field.key] = field;
        return acc;
    }, {})
);

export const PRINCIPLED_SURFACE_GROUPS = Object.freeze([
    {
        key: "baseColor",
        label: "Base Color",
        relation: "Diffuse, subsurface, metal and transmission color",
    },
    {
        key: "metallic",
        label: "Metallic",
        relation: "Dielectric to metal reflection blend",
    },
    {
        key: "roughness",
        label: "Roughness",
        relation: "Specular and transmission microfacet roughness",
    },
    {
        key: "ior",
        label: "IOR",
        relation: "Specular and transmission refraction index",
    },
    {
        key: "alpha",
        label: "Alpha",
        relation: "Surface opacity / texture alpha mask",
    },
    {
        key: "normal",
        label: "Normal",
        relation: "Base layer normal response",
    },
    {
        key: "subsurface",
        label: "Subsurface",
        relation: "Weight -> Radius -> Scale -> IOR -> Anisotropy",
        affects: ["subsurfaceRadius", "subsurfaceColor", "subsurfaceScale", "subsurfaceIor", "subsurfaceAnisotropy"],
    },
    {
        key: "specular",
        label: "Specular",
        relation: "IOR Level -> Tint -> Anisotropic -> Anisotropic Rotation -> Tangent",
        affects: ["specularTint", "anisotropic", "anisotropicRotation", "tangent"],
    },
    {
        key: "transmission",
        label: "Transmission",
        relation: "Weight",
        affects: ["transmissionRoughness"],
    },
    {
        key: "clearcoat",
        label: "Coat",
        relation: "Weight -> Roughness -> IOR -> Tint -> Normal",
        affects: ["clearcoatRoughness", "coatIor", "coatTint", "clearcoatNormal"],
    },
    {
        key: "sheen",
        label: "Sheen",
        relation: "Weight -> Roughness -> Tint",
        affects: ["sheenRoughness", "sheenTint"],
    },
    {
        key: "emission",
        label: "Emission",
        relation: "Color -> Strength -> Tint",
        affects: ["emissionStrength"],
    },
].map(group => ({
    ...group,
    field: SURFACE_FIELD_MAP[group.key],
})));

export const TEXTURE_CHANNEL_OPTIONS = Object.freeze(["rgba", "rgb"]);
export const TEXTURE_COLOR_MODE_OPTIONS = Object.freeze(["color", "bw"]);

export const BW_TEXTURE_SLOTS = Object.freeze([
    "subsurface",
    "subsurfaceScale",
    "subsurfaceIor",
    "subsurfaceAnisotropy",
    "metallic",
    "specular",
    "specularTint",
    "roughness",
    "diffuseRoughness",
    "anisotropic",
    "anisotropicRotation",
    "sheen",
    "sheenRoughness",
    "sheenTint",
    "clearcoat",
    "clearcoatRoughness",
    "coatIor",
    "ior",
    "transmission",
    "transmissionRoughness",
    "emissionStrength",
    "thinFilmThickness",
    "thinFilmIor",
    "alpha",
    "normal",
    "clearcoatNormal",
    "tangent",
    "bumpStrength",
    "displacementStrength",
]);

export const getTextureSettingDefaults = slotKey => ({
    ...Node.TEXTURE_SETTING_DEFAULTS,
    color_mode: BW_TEXTURE_SLOTS.includes(slotKey) ? "bw" : "color",
});

export const createSurface = () => ({
    baseColor: [1, 1, 1, 1],
    subsurface: 0,
    subsurfaceRadius: [1, 0.2, 0.1],
    subsurfaceColor: [1, 1, 1, 1],
    subsurfaceScale: 1,
    subsurfaceIor: 1.45,
    subsurfaceAnisotropy: 0,
    metallic: 0,
    specular: 0.5,
    specularTint: 0,
    roughness: 0.5,
    diffuseRoughness: 0,
    anisotropic: 0,
    anisotropicRotation: 0,
    sheen: 0,
    sheenRoughness: 0.5,
    sheenTint: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.03,
    coatIor: 1.5,
    coatTint: [1, 1, 1, 1],
    ior: 1.45,
    transmission: 0,
    transmissionRoughness: 0,
    emission: [0, 0, 0, 1],
    emissionStrength: 0,
    thinFilmThickness: 0,
    thinFilmIor: 1.33,
    alpha: 1,
    normal: 0,
    clearcoatNormal: 0,
    tangent: 0,
    bumpStrength: 0,
    displacementStrength: 0,
});

export const createBitmapMaps = () => {
    return SURFACE_FIELDS.reduce((acc, field) => {
        acc[field.key] = {
            enabled: false,
            source_type: "none",

            layer_id: "",
            url: "",
            name: "",

            node_id: "",
            uv_node_id: "",

            faces: {},
            mapped_faces: [],
            texture_groups: [],

            filename: "",
            cached: false,

            ...getTextureSettingDefaults(field.key),

            strength: 1,
            offset: 0,
            invert: false,
            blend: "replace",
        };

        return acc;
    }, {});
};

const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const normalizeSurface = surface => ({
    ...createSurface(),
    ...(surface || {}),
});

const normalizeBitmapMaps = bitmapMaps => ({
    ...createBitmapMaps(),
    ...(bitmapMaps || {}),
});

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

export const surfaceEditorEmits = [
    "update:name",
    "update:surface",
    "update:bitmapMaps",
    "assign-texture-slot",
    "clear-texture-slot",
    "change",
];

export function surfaceEditorModel(props, emit) {
    const state = reactive({
        name: props.name || "",
        surface: normalizeSurface(props.surface),
        bitmapMaps: normalizeBitmapMaps(props.bitmapMaps),
    });

    const surfaceGroups = computed(() => PRINCIPLED_SURFACE_GROUPS);
    const textureChannelOptions = computed(() => TEXTURE_CHANNEL_OPTIONS);
    const textureColorModeOptions = computed(() => TEXTURE_COLOR_MODE_OPTIONS);

    watch(
        () => props.name,
        value => {
            if (value !== state.name) {
                state.name = value || "";
            }
        }
    );

    watch(
        () => props.surface,
        value => {
            state.surface = normalizeSurface(value);
        },
        { deep: true }
    );

    watch(
        () => props.bitmapMaps,
        value => {
            state.bitmapMaps = normalizeBitmapMaps(value);
        },
        { deep: true }
    );

    const emitName = () => {
        emit("update:name", state.name);
        emit("change", {
            name: state.name,
            surface: cloneData(state.surface),
            bitmapMaps: cloneData(state.bitmapMaps),
        });
    };

    const emitSurface = () => {
        emit("update:surface", cloneData(state.surface));
        emit("change", {
            name: state.name,
            surface: cloneData(state.surface),
            bitmapMaps: cloneData(state.bitmapMaps),
        });
    };

    const emitBitmapMaps = () => {
        emit("update:bitmapMaps", cloneData(state.bitmapMaps));
        emit("change", {
            name: state.name,
            surface: cloneData(state.surface),
            bitmapMaps: cloneData(state.bitmapMaps),
        });
    };

    const setName = value => {
        state.name = value || "";
        emitName();
    };

    const setSurfaceValue = (slotKey, value) => {
        state.surface[slotKey] = value;
        emitSurface();
    };

    const setVectorValue = (slotKey, index, value) => {
        const current = Array.isArray(state.surface[slotKey])
            ? [...state.surface[slotKey]]
            : [0, 0, 0];

        current[index] = Number(value);
        state.surface[slotKey] = current;

        emitSurface();
    };

    const getSurfaceColor = slotKey => {
        return colorArrayToHex(state.surface[slotKey] || [1, 1, 1, 1]);
    };

    const setSurfaceColor = (slotKey, value) => {
        state.surface[slotKey] = hexToRgbaArray(value);
        emitSurface();
    };

    const getMapSlot = slotKey => {
        return state.bitmapMaps[slotKey] || {};
    };

    const setMapSlotValue = (slotKey, key, value) => {
        state.bitmapMaps[slotKey] = {
            ...(state.bitmapMaps[slotKey] || {}),
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

    const isSurfaceSlotConnected = slotKey => {
        const slot = getMapSlot(slotKey);

        return Boolean(
            slot.enabled ||
            slot.url ||
            slot.layer_id ||
            slot.node_id ||
            slot.source_type === "shader" ||
            slot.source_type === "multitexture"
        );
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

    const clearMapSlot = slotKey => {
        state.bitmapMaps[slotKey] = {
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
        state,

        surfaceGroups,
        textureChannelOptions,
        textureColorModeOptions,

        setName,
        setSurfaceValue,
        setVectorValue,

        getSurfaceColor,
        setSurfaceColor,

        getMapSlot,
        clearMapSlot,

        handleLayerDragStart,
        handleMapDrop,

        isSurfaceSlotConnected,
        getSurfaceSlotIcon,
        getSurfaceSlotLabel,
        getSurfaceSlotDetail,

        setSurfaceSlotChannel,
        setSurfaceTextureSetting,
    };
}