import {computed} from "vue";
import {clone} from "@/utils/tools";
import {createLight, LIGHT_TYPE_OPTIONS} from "@/dataLayer/webgl";
import {isFiniteNumber} from "@/utils/math";


export const lightProps = {
    light: {
        type: Object,
        required: true
    },
};

export function lightModel(props, emit) {

    const emitLight = () => {
        const light = clone(props.light, 'json');

        emit("update:light", light);
        emit("change", light);
    };

    const setLightValue = (key, value) => {
        props.light[key] = value;

        emitLight();
    };

    const setNumberValue = (key, value) => {
        const number = Number(value);
        props.light[key] = isFiniteNumber(number) ? number : createLight()[key];
        emitLight();
    };

    const setBooleanValue = (key, value) => {
        props.light[key] = value === true;
        emitLight();
    };

    const isPositionLight = computed(() => (
        ["point", "spot", "area"].includes(props.light.lightType)
    ));

    const isDirectionalLight = computed(() => (
        ["sun", "directional", "spot", "area"].includes(props.light.lightType)
    ));

    const isFalloffLight = computed(() => (
        ["point", "spot"].includes(props.light.lightType)
    ));

    const hasRadius = computed(() => (
        ["sun", "point", "spot", "area"].includes(props.light.lightType)
    ));

    const isSpotLight = computed(() => props.light.lightType === "spot");

    const radiusLabel = computed(() => (
        props.light.lightType === "sun" ? "Angular Radius" : "Radius"
    ));

    return {
        LIGHT_TYPE_OPTIONS,
        isPositionLight,
        isDirectionalLight,
        isFalloffLight,
        hasRadius,
        isSpotLight,
        radiusLabel,
        setLightValue,
        setNumberValue,
        setBooleanValue
    };
}
