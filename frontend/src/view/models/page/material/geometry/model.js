import {Volume} from "@/view/models/page/material/core/Volume/Volume";
import {Fluid} from "@/view/models/page/material/core/Fluid/Fluid";
import {FLUID_SOLVER_OPTIONS, FLUID_TYPE_OPTIONS, PRIMITIVE_OPTIONS, SUBDIVISION_TYPE_OPTIONS, UV_FIT_OPTIONS, VOLUME_FALLOFF_OPTIONS, VOLUME_MODE_OPTIONS} from "@/dataLayer/webgl";
import {clone} from "@/utils/tools";
import {isFiniteNumber} from "@/utils/math";

const toNumber = value => {
    const number = Number(value);
    return isFiniteNumber(number) ? number : 0;
};

export const geometryModelProps = {
    geometry: {
        type: Object,
        required: true
    },
};

export function geometryModel(props, emit) {
    const emitGeometry = () => {
        const geometry = clone(props.geometry, "json");

        emit("update:geometry", geometry);
        emit("change", geometry);
    };

    const setGeometryValue = (key, value) => {
        props.geometry[key] = value;
        emitGeometry();
    };

    const setGeometryNumber = (key, value) => {
        props.geometry[key] = toNumber(value);
        emitGeometry();
    };

    const setGeometryBoolean = (key, value) => {
        props.geometry[key] = value === true;
        emitGeometry();
    };

    const setVolumeValue = (key, value) => {
        props.geometry.volume = Volume.create({
            ...(props.geometry.volume || {}),
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
        props.geometry.fluid = Fluid.create({
            ...(props.geometry.fluid || {}),
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
        PRIMITIVE_OPTIONS,
        UV_FIT_OPTIONS,
        SUBDIVISION_TYPE_OPTIONS,
        VOLUME_MODE_OPTIONS,
        VOLUME_FALLOFF_OPTIONS,
        FLUID_TYPE_OPTIONS,
        FLUID_SOLVER_OPTIONS,

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
