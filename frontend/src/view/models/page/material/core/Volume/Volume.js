const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

const clone = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

export class Volume {
    static MODES = Object.freeze(["mesh", "bounds", "shell"]);
    static FALL_OFF = Object.freeze(["linear", "smooth", "exponential"]);

    static DEFAULTS = Object.freeze({
        enabled: false,
        mode: "mesh",
        resolution: 32,
        density: 1,
        shell_thickness: 0.08,
        falloff: "smooth",
        particle_bind: true,
        shader_bind: true,
        sample: "inside",
    });

    static normalize(volume = {}) {
        const source = {
            ...Volume.DEFAULTS,
            ...(volume || {}),
        };

        return {
            enabled: source.enabled === true,
            mode: Volume.MODES.includes(source.mode) ? source.mode : "mesh",
            resolution: Math.trunc(clamp(source.resolution, 4, 256)),
            density: clamp(source.density, 0, 10),
            shell_thickness: clamp(source.shell_thickness, 0, 2),
            falloff: Volume.FALL_OFF.includes(source.falloff) ? source.falloff : "smooth",
            particle_bind: source.particle_bind !== false,
            shader_bind: source.shader_bind !== false,
            sample: ["inside", "surface", "shell"].includes(source.sample) ? source.sample : "inside",
        };
    }

    static create(settings = {}) {
        return Volume.normalize(settings);
    }

    static toPlain(volume = {}) {
        return clone(Volume.normalize(volume));
    }

    static shaderNodeSettings(volume = {}) {
        const normalized = Volume.normalize(volume);

        return {
            node_key: "shader.volume",
            node_name: "Geometry Volume",
            group: "Shader",
            ...normalized,
        };
    }
}
