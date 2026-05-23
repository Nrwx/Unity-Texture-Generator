import { reactive, watch } from "vue";
import { Volume } from "@/view/models/page/material/core/Volume/Volume";
import { Fluid } from "@/view/models/page/material/core/Fluid/Fluid";

export const PRIMITIVE_OPTIONS = Object.freeze([
    "cube",
    "box",
    "plane",
    "sphere",
    "cylinder",
]);

export const UV_FIT_OPTIONS = Object.freeze([
    "stretch",
    "contain",
    "cover",
    "tile",
    "world",
]);

export const SUBDIVISION_TYPE_OPTIONS = Object.freeze([
    "simple",
    "catmull-clark",
]);

export const VOLUME_MODE_OPTIONS = Volume.MODES;
export const VOLUME_FALLOFF_OPTIONS = Volume.FALL_OFF;
export const FLUID_TYPE_OPTIONS = Fluid.TYPES;
export const FLUID_SOLVER_OPTIONS = Fluid.SOLVERS;

export const createGeometry = () => ({
    primitive: "cube",

    width: 1,
    height: 1,
    depth: 1,

    bevel: 0,
    bevel_segments: 1,

    subdivision: 0,
    subdivision_type: "simple",
    shade_smooth: true,

    uv_fit: "stretch",
    uv_density: 1,

    pivot_x: 0,
    pivot_y: 0,
    pivot_z: 0,

    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,

    scale_x: 1,
    scale_y: 1,
    scale_z: 1,

    volume: Volume.create(),
    fluid: Fluid.create(),
});

const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const normalizeGeometry = geometry => ({
    ...createGeometry(),
    ...(geometry || {}),
    volume: Volume.create(geometry?.volume || {}),
    fluid: Fluid.create(geometry?.fluid || {}),
});

const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

export const geometryModelProps = {
    geometry: {
        type: Object,
        default: () => createGeometry(),
    },
};

export const geometryModelEmits = [
    "update:geometry",
    "change",
];

export function geometryModel(props, emit) {
    const state = reactive({
        geometry: normalizeGeometry(props.geometry),
    });

    watch(
        () => props.geometry,
        value => {
            state.geometry = normalizeGeometry(value);
        },
        { deep: true }
    );

    const emitGeometry = () => {
        const geometry = cloneData(state.geometry);

        emit("update:geometry", geometry);
        emit("change", geometry);
    };

    const setGeometryValue = (key, value) => {
        state.geometry[key] = value;
        emitGeometry();
    };

    const setGeometryNumber = (key, value) => {
        state.geometry[key] = toNumber(value);
        emitGeometry();
    };

    const setGeometryBoolean = (key, value) => {
        state.geometry[key] = value === true;
        emitGeometry();
    };

    const setVolumeValue = (key, value) => {
        state.geometry.volume = Volume.create({
            ...(state.geometry.volume || {}),
            [key]: value,
        });
        emitGeometry();
    };

    const setVolumeNumber = (key, value) => {
        setVolumeValue(key, toNumber(value));
    };

    const setVolumeBoolean = (key, value) => {
        setVolumeValue(key, value === true);
    };

    const setFluidValue = (key, value) => {
        state.geometry.fluid = Fluid.create({
            ...(state.geometry.fluid || {}),
            [key]: value,
        });
        emitGeometry();
    };

    const setFluidNumber = (key, value) => {
        setFluidValue(key, toNumber(value));
    };

    const setFluidBoolean = (key, value) => {
        setFluidValue(key, value === true);
    };

    return {
        state,

        primitiveOptions: PRIMITIVE_OPTIONS,
        uvFitOptions: UV_FIT_OPTIONS,
        subdivisionTypeOptions: SUBDIVISION_TYPE_OPTIONS,
        volumeModeOptions: VOLUME_MODE_OPTIONS,
        volumeFalloffOptions: VOLUME_FALLOFF_OPTIONS,
        fluidTypeOptions: FLUID_TYPE_OPTIONS,
        fluidSolverOptions: FLUID_SOLVER_OPTIONS,

        setGeometryValue,
        setGeometryNumber,
        setGeometryBoolean,
        setVolumeValue,
        setVolumeNumber,
        setVolumeBoolean,
        setFluidValue,
        setFluidNumber,
        setFluidBoolean,
    };
}
