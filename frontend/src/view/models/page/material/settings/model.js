import {
    BLEND_MODE_OPTIONS, createSettings,
    RENDER_BACKEND_OPTIONS,
    SHADOW_METHOD_OPTIONS,
    TEXTURE_SIZE_OPTIONS
} from "@/dataLayer/webgl";
import {clone} from "@/utils/tools";
import {isFiniteNumber} from "@/utils/math";

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
        required: true
    },
};

export function settingsModel(props, emit) {

    const emitSettings = () => {
        const nextSettings = clone(props.settings, 'json');

        emit("update:settings", nextSettings);
        emit("change", nextSettings);
    };

    const setSetting = (key, value) => {
        props.settings[key] = value;
        emitSettings();
    };

    const setNumberSetting = (key, value) => {
        const number = Number(value);

        props.settings[key] = isFiniteNumber(number) ? number : createSettings()[key];
        emitSettings();
    };

    const setBooleanSetting = (key, value) => {
        props.settings[key] = value === true;
        emitSettings();
    };

    const setTextureSize = value => {
        props.settings.texture_size = normalizeTextureSize(value);
        emitSettings();
    };

    return {
        RENDER_BACKEND_OPTIONS,
        TEXTURE_SIZE_OPTIONS,
        BLEND_MODE_OPTIONS,
        SHADOW_METHOD_OPTIONS,

        setSetting,
        setNumberSetting,
        setBooleanSetting,
        setTextureSize,
    };
}
