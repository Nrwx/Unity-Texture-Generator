import { uuid } from "@/utils/uuid";

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const clampInt = (value, min, max) => Math.trunc(clamp(value, min, max));
const clone = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const random = seed => {
    let state = Math.trunc(Number(seed) || 1) >>> 0;

    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

const sampleMeshPosition = (mesh, rand) => {
    const stride = Number(mesh?.stride || 11);
    const vertices = mesh?.vertices || [];
    const indices = mesh?.indices || [];

    if (!vertices.length || !indices.length || stride < 3) {
        return null;
    }

    const triangleOffset = Math.floor(rand() * Math.floor(indices.length / 3)) * 3;
    const a = indices[triangleOffset] * stride;
    const b = indices[triangleOffset + 1] * stride;
    const c = indices[triangleOffset + 2] * stride;
    const r1 = Math.sqrt(rand());
    const r2 = rand();
    const wa = 1 - r1;
    const wb = r1 * (1 - r2);
    const wc = r1 * r2;

    return [
        vertices[a] * wa + vertices[b] * wb + vertices[c] * wc,
        vertices[a + 1] * wa + vertices[b + 1] * wb + vertices[c + 1] * wc,
        vertices[a + 2] * wa + vertices[b + 2] * wb + vertices[c + 2] * wc,
    ];
};

const normalizeColor = value => {
    if (Array.isArray(value)) {
        return [
            clamp(value[0] ?? 1, 0, 1),
            clamp(value[1] ?? 1, 0, 1),
            clamp(value[2] ?? 1, 0, 1),
            clamp(value[3] ?? 1, 0, 1),
        ];
    }

    return [1, 1, 1, 1];
};

export class ParticleSystem {
    static DEFAULTS = Object.freeze({
        enabled: false,
        mode: "texture",
        source: "texture",
        emitter: "volume",
        texture_slot: "baseColor",
        count: 320,
        seed: 1337,
        lifetime: 4,
        age: 1.2,
        time_scale: 1,
        size: 18,
        size_randomness: 0.45,
        alpha: 0.92,
        spread_x: 1,
        spread_y: 1,
        spread_z: 1,
        velocity_x: 0,
        velocity_y: 0.18,
        velocity_z: 0,
        velocity_randomness: 0.35,
        gravity: -0.08,
        turbulence: 0.22,
        orbit: 0.18,
        mesh_influence: 0.65,
        color: [1, 1, 1, 1],
        blend: "alpha",
        depth_write: false,
        sort: true,
        use_mesh_reference: false,
    });

    static create(settings = {}, context = {}) {
        const normalized = ParticleSystem.normalize(settings);

        return {
            id: settings.id || uuid("particle-system"),
            version: 1,
            ...normalized,
            particles: ParticleSystem.generate(normalized, context),
            meta: {
                source: "material-editor",
                generated_at: Date.now(),
            },
        };
    }

    static normalize(settings = {}) {
        const source = {
            ...ParticleSystem.DEFAULTS,
            ...(settings || {}),
        };

        return {
            enabled: source.enabled === true,
            mode: ["texture", "mesh", "mixed"].includes(source.mode) ? source.mode : "texture",
            source: ["texture", "mesh", "volume"].includes(source.source) ? source.source : "texture",
            emitter: ["volume", "surface", "vertices", "sphere", "plane"].includes(source.emitter) ? source.emitter : "volume",
            texture_slot: String(source.texture_slot || "baseColor"),
            count: clampInt(source.count, 1, 5000),
            seed: clampInt(source.seed, 1, 9999999),
            lifetime: clamp(source.lifetime, 0.1, 60),
            age: clamp(source.age, 0, 60),
            time_scale: clamp(source.time_scale, 0, 8),
            size: clamp(source.size, 1, 120),
            size_randomness: clamp(source.size_randomness, 0, 1),
            alpha: clamp(source.alpha, 0, 1),
            spread_x: clamp(source.spread_x, 0.001, 20),
            spread_y: clamp(source.spread_y, 0.001, 20),
            spread_z: clamp(source.spread_z, 0.001, 20),
            velocity_x: clamp(source.velocity_x, -10, 10),
            velocity_y: clamp(source.velocity_y, -10, 10),
            velocity_z: clamp(source.velocity_z, -10, 10),
            velocity_randomness: clamp(source.velocity_randomness, 0, 10),
            gravity: clamp(source.gravity, -10, 10),
            turbulence: clamp(source.turbulence, 0, 10),
            orbit: clamp(source.orbit, -10, 10),
            mesh_influence: clamp(source.mesh_influence, 0, 1),
            color: normalizeColor(source.color),
            blend: ["alpha", "additive", "screen"].includes(source.blend) ? source.blend : "alpha",
            depth_write: source.depth_write === true,
            sort: source.sort !== false,
            use_mesh_reference: source.use_mesh_reference === true,
        };
    }

    static generate(settings = {}, context = {}) {
        const config = ParticleSystem.normalize(settings);
        const rand = random(config.seed);
        const positions = [];
        const sizes = [];
        const alphas = [];
        const phases = [];
        const mesh = context.mesh || null;
        const useMesh = config.use_mesh_reference || config.source === "mesh" || ["surface", "vertices"].includes(config.emitter);

        for (let index = 0; index < config.count; index += 1) {
            const phase = rand();
            const life = ((config.age * config.time_scale) / Math.max(config.lifetime, 0.001) + phase) % 1;
            const meshPosition = useMesh ? sampleMeshPosition(mesh, rand) : null;
            const theta = rand() * Math.PI * 2;
            const radius = Math.sqrt(rand());
            const sphereZ = rand() * 2 - 1;
            const sphereRadius = Math.sqrt(Math.max(0, 1 - sphereZ * sphereZ));
            const base = meshPosition || (
                config.emitter === "sphere"
                    ? [
                        Math.cos(theta) * sphereRadius * radius,
                        sphereZ * radius,
                        Math.sin(theta) * sphereRadius * radius,
                    ]
                    : [
                        (rand() - 0.5) * config.spread_x,
                        config.emitter === "plane" ? 0 : (rand() - 0.5) * config.spread_y,
                        (rand() - 0.5) * config.spread_z,
                    ]
            );
            const swirl = config.orbit * life * Math.PI * 2;
            const c = Math.cos(swirl);
            const s = Math.sin(swirl);
            const vx = config.velocity_x + (rand() - 0.5) * config.velocity_randomness;
            const vy = config.velocity_y + (rand() - 0.5) * config.velocity_randomness + config.gravity * life;
            const vz = config.velocity_z + (rand() - 0.5) * config.velocity_randomness;
            const noise = [
                Math.sin((index + 1) * 12.989 + life * 6.283) * config.turbulence * 0.05,
                Math.cos((index + 1) * 78.233 + life * 4.19) * config.turbulence * 0.05,
                Math.sin((index + 1) * 39.425 + life * 7.31) * config.turbulence * 0.05,
            ];
            const x = base[0] * c - base[2] * s + vx * life + noise[0];
            const z = base[0] * s + base[2] * c + vz * life + noise[2];
            const y = base[1] + vy * life + noise[1];
            const fade = Math.sin(Math.PI * life);
            const size = config.size * (1 - config.size_randomness * rand()) * (0.55 + fade * 0.45);

            positions.push(x, y, z);
            sizes.push(size);
            alphas.push(config.alpha * Math.max(0.05, fade));
            phases.push(phase);
        }

        return {
            stride: 6,
            count: config.count,
            positions,
            sizes,
            alphas,
            phases,
        };
    }

    static update(system = {}, patch = {}, context = {}) {
        return ParticleSystem.create({
            ...system,
            ...patch,
            id: system.id,
        }, context);
    }

    static toPlain(system = null, { compact = false } = {}) {
        const normalized = ParticleSystem.normalize(system || {});

        return {
            id: system?.id || "",
            version: Number(system?.version || 1),
            ...normalized,
            particles: compact ? {
                stride: 6,
                count: normalized.count,
                compact: true,
            } : clone(system?.particles || ParticleSystem.generate(normalized)),
            meta: clone(system?.meta || {}),
        };
    }

    static fromPlain(system = null, context = {}) {
        if (!system || typeof system !== "object") {
            return ParticleSystem.create({}, context);
        }

        const normalized = ParticleSystem.normalize(system);
        const particles = ParticleSystem.generate(normalized, context);

        return {
            id: system.id || uuid("particle-system"),
            version: Number(system.version || 1),
            ...normalized,
            particles,
            meta: clone(system.meta || {}),
        };
    }
}
