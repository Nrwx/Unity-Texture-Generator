import { reactive, watch } from "vue";

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

    return {
        state,

        primitiveOptions: PRIMITIVE_OPTIONS,
        uvFitOptions: UV_FIT_OPTIONS,
        subdivisionTypeOptions: SUBDIVISION_TYPE_OPTIONS,

        setGeometryValue,
        setGeometryNumber,
        setGeometryBoolean,
    };
}