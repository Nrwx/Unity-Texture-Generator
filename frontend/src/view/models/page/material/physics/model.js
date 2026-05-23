import { clone } from "@/utils/tools";
import {BODY_TYPE_OPTIONS, COLLISION_SHAPE_OPTIONS} from "@/dataLayer/webgl";

const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

export const physicsModelProps = {
    physics: {
        type: Object,
        required: true
    },
};

export function physicsModel(props, emit) {

    const emitPhysics = () => {
        const physics = clone(props.physics, 'json');

        emit("update:physics", physics);
        emit("change", physics);
    };

    const setPhysicsValue = (key, value) => {
        props.physics[key] = value;
        emitPhysics();
    };

    const setPhysicsNumber = (key, value) => {
        props.physics[key] = toNumber(value);
        emitPhysics();
    };

    const setPhysicsBoolean = (key, value) => {
        props.physics[key] = value === true;
        emitPhysics();
    };

    return {
        COLLISION_SHAPE_OPTIONS,
        BODY_TYPE_OPTIONS,

        setPhysicsValue,
        setPhysicsNumber,
        setPhysicsBoolean,
    };
}