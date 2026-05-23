import { computed, reactive, watch } from "vue";

/**
 * @typedef {Object} MaterialLight
 * @property {boolean} enabled
 * @property {string} lightType
 * @property {string} mode
 * @property {number} intensity
 * @property {number} ambient
 * @property {number} softness
 * @property {string} color
 * @property {string} ambient_color
 * @property {string} environment_color
 * @property {number} range
 * @property {number} radius
 * @property {number} decay
 * @property {number} innerCone
 * @property {number} outerCone
 * @property {boolean} castShadow
 * @property {number} temperature
 * @property {number} position_x
 * @property {number} position_y
 * @property {number} position_z
 * @property {number} direction_x
 * @property {number} direction_y
 * @property {number} direction_z
 */

/**
 * @returns {MaterialLight}
 */
export const createLight = () => ({
    enabled: true,
    lightType: "sun",
    mode: "sun",
    intensity: 1,
    ambient: 0.34,
    softness: 0.32,
    color: "#fff4e6",
    ambient_color: "#b3c7e6",
    environment_color: "#b8d1ff",
    range: 4,
    radius: 0.25,
    decay: 2,
    innerCone: 0.35,
    outerCone: 0.75,
    castShadow: false,
    temperature: 6500,
    position_x: 0,
    position_y: 1.4,
    position_z: 2.8,
    direction_x: -0.35,
    direction_y: -0.65,
    direction_z: 0.72,
});

export const LIGHT_TYPE_OPTIONS = Object.freeze([
    "sun",
    "directional",
    "point",
    "spot",
    "area",
]);

const cloneData = value => {
    try {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

/**
 * @param {Partial<MaterialLight>} light
 * @returns {MaterialLight}
 */
const normalizeLight = light => ({
    ...createLight(),
    ...(light || {}),
});

export const lightProps = {
    light: {
        type: Object,
        default: () => createLight(),
    },
};

export const lightEmits = [
    "update:light",
    "change",
];

export function lightModel(props, emit) {
    const state = reactive({
        light: normalizeLight(props.light),
    });

    const lightTypeOptions = computed(() => LIGHT_TYPE_OPTIONS);

    watch(
        () => props.light,
        value => {
            state.light = normalizeLight(value);
        },
        { deep: true }
    );

    const emitLight = () => {
        const light = cloneData(state.light);

        emit("update:light", light);
        emit("change", light);
    };

    const setLightValue = (key, value) => {
        state.light[key] = value;

        if (key === "lightType") {
            state.light.mode = value;
        }

        emitLight();
    };

    const setNumberValue = (key, value) => {
        const number = Number(value);
        state.light[key] = Number.isFinite(number) ? number : createLight()[key];
        emitLight();
    };

    const setBooleanValue = (key, value) => {
        state.light[key] = value === true;
        emitLight();
    };

    const isPositionLight = computed(() => (
        ["point", "spot", "area"].includes(state.light.lightType)
    ));

    const isDirectionalLight = computed(() => (
        ["sun", "directional", "spot", "area"].includes(state.light.lightType)
    ));

    const isFalloffLight = computed(() => (
        ["point", "spot"].includes(state.light.lightType)
    ));

    const hasRadius = computed(() => (
        ["sun", "point", "spot", "area"].includes(state.light.lightType)
    ));

    const isSpotLight = computed(() => state.light.lightType === "spot");

    const radiusLabel = computed(() => (
        state.light.lightType === "sun" ? "Angular Radius" : "Radius"
    ));

    return {
        state,

        lightTypeOptions,

        isPositionLight,
        isDirectionalLight,
        isFalloffLight,
        hasRadius,
        isSpotLight,
        radiusLabel,

        setLightValue,
        setNumberValue,
        setBooleanValue,
    };
}
