import { reactive, watch } from "vue";

/**
 * @typedef {32 | 64 | 128 | 256 | 512 | 1024 | "Original"} TextureSizeOption
 * @type {TextureSizeOption[]}
 */
export const TEXTURE_SIZE_OPTIONS = [
    32,
    64,
    128,
    256,
    512,
    1024,
    "Original",
];

export const RENDER_BACKEND_OPTIONS = Object.freeze([
    { title: "Canvas2D", value: "CANVAS2D" },
    { title: "WEBGL2", value: "WEBGL2" },
]);

export const BLEND_MODE_OPTIONS = Object.freeze([
    "OPAQUE",
    "BLEND",
    "HASHED",
    "CLIP",
]);

export const SHADOW_METHOD_OPTIONS = Object.freeze([
    "NONE",
    "OPAQUE",
    "HASHED",
    "CLIP",
]);

/**
 * @returns {Record<string, any>}
 */
export const createSettings = () => ({
    render_backend: "WEBGL2",
    texture_size: "Original",
    texture_preload: TEXTURE_SIZE_OPTIONS,

    cube_size: 256,
    rotate_preview: true,
    wireframe_preview: false,
    faces_preview: false,
    vertices_preview: false,

    blend_mode: "BLEND",
    alpha_clip: 0.5,

    shadow_method: "HASHED",
    backface_culling: false,
    show_backface: true,

    screen_space_refraction: false,
    refraction_depth: 0,
    subsurface_translucency: false,

    use_nodes: true,
});

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

/**
 * @param {Record<string, any>} settings
 * @returns {Record<string, any>}
 */
const normalizeSettings = (settings = {}) => ({
    ...createSettings(),
    ...(settings || {}),
    render_backend: ["CANVAS2D", "WEBGL2"].includes(String(settings.render_backend || "").toUpperCase())
        ? String(settings.render_backend).toUpperCase()
        : "WEBGL2",
    texture_size: normalizeTextureSize(settings.texture_size),
    texture_preload: TEXTURE_SIZE_OPTIONS,
    cube_size: Number.isFinite(Number(settings.cube_size)) ? Number(settings.cube_size) : 256,
    alpha_clip: Number.isFinite(Number(settings.alpha_clip)) ? Number(settings.alpha_clip) : 0.5,
    refraction_depth: Number.isFinite(Number(settings.refraction_depth)) ? Number(settings.refraction_depth) : 0,

    rotate_preview: settings.rotate_preview === true,
    wireframe_preview: settings.wireframe_preview === true,
    faces_preview: settings.faces_preview === true,
    vertices_preview: settings.vertices_preview === true,
});

/**
 * @param {unknown} value
 * @returns {number | "Original"}
 */
export const normalizeTextureSize = value => {
    if (value === "Original" || value === "original" || value === null || value === undefined || value === "") {
        return "Original";
    }

    const number = Number(value);

    return TEXTURE_SIZE_OPTIONS.includes(number) ? number : "Original";
};

export const settingsProps = {
    settings: {
        type: Object,
        default: () => createSettings(),
    },
};

export const settingsEmits = [
    "update:settings",
    "change",
];

export function settingsModel(props, emit) {
    const state = reactive({
        settings: normalizeSettings(props.settings),
    });

    watch(
        () => props.settings,
        value => {
            state.settings = normalizeSettings(value);
        },
        { deep: true }
    );

    const emitSettings = () => {
        const nextSettings = cloneData(state.settings);

        emit("update:settings", nextSettings);
        emit("change", nextSettings);
    };

    const setSetting = (key, value) => {
        state.settings[key] = value;
        emitSettings();
    };

    const setNumberSetting = (key, value) => {
        const number = Number(value);

        state.settings[key] = Number.isFinite(number) ? number : createSettings()[key];
        emitSettings();
    };

    const setBooleanSetting = (key, value) => {
        state.settings[key] = value === true;
        emitSettings();
    };

    const setTextureSize = value => {
        state.settings.texture_size = normalizeTextureSize(value);
        emitSettings();
    };

    return {
        state,

        renderBackendOptions: RENDER_BACKEND_OPTIONS,
        textureSizeOptions: TEXTURE_SIZE_OPTIONS,
        blendModeOptions: BLEND_MODE_OPTIONS,
        shadowMethodOptions: SHADOW_METHOD_OPTIONS,

        setSetting,
        setNumberSetting,
        setBooleanSetting,
        setTextureSize,
    };
}
