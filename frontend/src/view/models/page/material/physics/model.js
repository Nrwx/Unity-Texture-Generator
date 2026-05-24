import { reactive, watch } from "vue";

export const COLLISION_SHAPE_OPTIONS = Object.freeze([
    "box",
    "sphere",
    "capsule",
    "cylinder",
    "convex",
    "mesh",
]);

export const BODY_TYPE_OPTIONS = Object.freeze([
    "static",
    "kinematic",
    "dynamic",
]);

export const createPhysics = () => ({
    enabled: false,

    collision_enabled: false,
    collision_shape: "mesh",
    collision_margin: 0.02,

    rigid_body: false,
    body_type: "static",

    mass: 1,
    friction: 0.5,
    restitution: 0,

    damping_linear: 0.04,
    damping_angular: 0.1,

    gravity_enabled: true,
    gravity_scale: 1,

    sleep_enabled: true,
    can_sleep: true,

    continuous_collision: false,
});

const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const normalizePhysics = physics => ({
    ...createPhysics(),
    ...(physics || {}),
});

const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

export const physicsModelProps = {
    physics: {
        type: Object,
        default: () => createPhysics(),
    },
};

export const physicsModelEmits = [
    "update:physics",
    "change",
];

export function physicsModel(props, emit) {
    const state = reactive({
        physics: normalizePhysics(props.physics),
    });

    watch(
        () => props.physics,
        value => {
            state.physics = normalizePhysics(value);
        },
        { deep: true }
    );

    const emitPhysics = () => {
        const physics = cloneData(state.physics);

        emit("update:physics", physics);
        emit("change", physics);
    };

    const setPhysicsValue = (key, value) => {
        state.physics[key] = value;
        emitPhysics();
    };

    const setPhysicsNumber = (key, value) => {
        state.physics[key] = toNumber(value);
        emitPhysics();
    };

    const setPhysicsBoolean = (key, value) => {
        state.physics[key] = value === true;
        emitPhysics();
    };

    return {
        state,

        collisionShapeOptions: COLLISION_SHAPE_OPTIONS,
        bodyTypeOptions: BODY_TYPE_OPTIONS,

        setPhysicsValue,
        setPhysicsNumber,
        setPhysicsBoolean,
    };
}