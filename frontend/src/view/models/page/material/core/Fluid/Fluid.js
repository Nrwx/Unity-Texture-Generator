const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

const clone = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

export class Fluid {
    static TYPES = Object.freeze(["smoke", "fire", "mist", "liquid", "plasma"]);
    static SOLVERS = Object.freeze(["stable", "flip", "vortex"]);

    static DEFAULTS = Object.freeze({
        enabled: false,
        type: "smoke",
        solver: "stable",
        viscosity: 0.12,
        buoyancy: 0.35,
        vorticity: 0.28,
        turbulence: 0.22,
        diffusion: 0.08,
        pressure: 1,
        temperature: 0.5,
        particle_coupling: 0.65,
        advection: 0.72,
    });

    static normalize(fluid = {}) {
        const source = {
            ...Fluid.DEFAULTS,
            ...(fluid || {}),
        };

        return {
            enabled: source.enabled === true,
            type: Fluid.TYPES.includes(source.type) ? source.type : "smoke",
            solver: Fluid.SOLVERS.includes(source.solver) ? source.solver : "stable",
            viscosity: clamp(source.viscosity, 0, 1),
            buoyancy: clamp(source.buoyancy, -2, 2),
            vorticity: clamp(source.vorticity, 0, 2),
            turbulence: clamp(source.turbulence, 0, 4),
            diffusion: clamp(source.diffusion, 0, 1),
            pressure: clamp(source.pressure, 0, 4),
            temperature: clamp(source.temperature, 0, 2),
            particle_coupling: clamp(source.particle_coupling, 0, 1),
            advection: clamp(source.advection, 0, 1),
        };
    }

    static create(settings = {}) {
        return Fluid.normalize(settings);
    }

    static toPlain(fluid = {}) {
        return clone(Fluid.normalize(fluid));
    }

    static shaderNodeSettings(fluid = {}) {
        const normalized = Fluid.normalize(fluid);

        return {
            node_key: "shader.fluid",
            node_name: "Fluid Dynamics",
            group: "Shader",
            ...normalized,
        };
    }
}
