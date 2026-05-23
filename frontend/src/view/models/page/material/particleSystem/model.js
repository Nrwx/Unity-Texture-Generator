import { reactive, watch } from "vue";
import { ParticleSystem } from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";

export const PARTICLE_MODE_OPTIONS = Object.freeze(["texture", "mesh", "mixed"]);
export const PARTICLE_SOURCE_OPTIONS = Object.freeze(["texture", "mesh", "volume"]);
export const PARTICLE_EMITTER_OPTIONS = Object.freeze(["volume", "surface", "vertices", "sphere", "plane"]);
export const PARTICLE_BLEND_OPTIONS = Object.freeze(["alpha", "additive", "screen"]);
export const PARTICLE_TEXTURE_SLOT_OPTIONS = Object.freeze([
    "baseColor",
    "alpha",
    "emission",
    "roughness",
    "metallic",
    "normal",
]);

export const createParticleSystem = () => ParticleSystem.create();

const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const normalizeParticleSystem = value => ParticleSystem.fromPlain(value || {});
const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

export const particleSystemModelProps = {
    particleSystem: {
        type: Object,
        default: () => createParticleSystem(),
    },
};

export const particleSystemModelEmits = [
    "update:particleSystem",
    "change",
];

export function particleSystemModel(props, emit) {
    const state = reactive({
        particleSystem: normalizeParticleSystem(props.particleSystem),
    });

    watch(
        () => props.particleSystem,
        value => {
            state.particleSystem = normalizeParticleSystem(value);
        },
        { deep: true }
    );

    const emitParticleSystem = () => {
        const particleSystem = cloneData(state.particleSystem);

        emit("update:particleSystem", particleSystem);
        emit("change", particleSystem);
    };

    const setParticleValue = (key, value) => {
        state.particleSystem[key] = value;
        emitParticleSystem();
    };

    const setParticleNumber = (key, value) => {
        state.particleSystem[key] = toNumber(value);
        emitParticleSystem();
    };

    const setParticleBoolean = (key, value) => {
        state.particleSystem[key] = value === true;
        emitParticleSystem();
    };

    const setParticleColor = (index, value) => {
        const color = Array.isArray(state.particleSystem.color)
            ? [...state.particleSystem.color]
            : [1, 1, 1, 1];

        color[index] = toNumber(value);
        state.particleSystem.color = color;
        emitParticleSystem();
    };

    return {
        state,
        particleModeOptions: PARTICLE_MODE_OPTIONS,
        particleSourceOptions: PARTICLE_SOURCE_OPTIONS,
        particleEmitterOptions: PARTICLE_EMITTER_OPTIONS,
        particleBlendOptions: PARTICLE_BLEND_OPTIONS,
        particleTextureSlotOptions: PARTICLE_TEXTURE_SLOT_OPTIONS,
        setParticleValue,
        setParticleNumber,
        setParticleBoolean,
        setParticleColor,
    };
}
