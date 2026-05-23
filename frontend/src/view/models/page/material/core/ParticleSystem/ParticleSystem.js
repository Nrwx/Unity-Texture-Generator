import { uuid } from "@/utils/uuid";
import {isFiniteNumber} from "@/utils/math";

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

const getMeshBounds = mesh => {
    const bounds = mesh?.bounds || {};

    if (Array.isArray(bounds.min) && Array.isArray(bounds.max)) {
        return {
            min: bounds.min.map(Number),
            max: bounds.max.map(Number),
        };
    }

    const stride = Number(mesh?.stride || 11);
    const vertices = mesh?.vertices || [];

    if (!vertices.length || stride < 3) {
        return null;
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let index = 0; index < vertices.length; index += stride) {
        min[0] = Math.min(min[0], Number(vertices[index]) || 0);
        min[1] = Math.min(min[1], Number(vertices[index + 1]) || 0);
        min[2] = Math.min(min[2], Number(vertices[index + 2]) || 0);
        max[0] = Math.max(max[0], Number(vertices[index]) || 0);
        max[1] = Math.max(max[1], Number(vertices[index + 1]) || 0);
        max[2] = Math.max(max[2], Number(vertices[index + 2]) || 0);
    }

    return min.every(Number.isFinite) && max.every(Number.isFinite)
        ? { min, max }
        : null;
};

const sampleMeshVolumePosition = (mesh, rand, volume = {}, flowMode = "inside") => {
    if (flowMode === "outside") {
        return sampleMeshPosition(mesh, rand);
    }

    if (volume?.sample === "surface") {
        return sampleMeshPosition(mesh, rand);
    }

    const bounds = getMeshBounds(mesh);

    if (!bounds) {
        return null;
    }

    const thickness = Math.max(0, Number(volume?.shell_thickness ?? 0.08) || 0);
    const shell = volume?.sample === "shell";
    const point = [0, 1, 2].map(axis => {
        const min = bounds.min[axis];
        const max = bounds.max[axis];
        const span = max - min;

        if (!isFiniteNumber(span) || span <= 0) {
            return min || 0;
        }

        if (!shell) {
            return min + rand() * span;
        }

        const side = rand() > 0.5 ? 1 : -1;
        const edge = side > 0 ? max : min;
        const inset = Math.min(span * 0.5, span * thickness * rand());

        return edge - side * inset;
    });

    return point;
};

const resolveVolumeCollision = (position, mesh, physics = {}) => {
    if (
        !physics?.enabled ||
        !physics?.collision_enabled ||
        !Array.isArray(position)
    ) {
        return position;
    }

    const bounds = getMeshBounds(mesh);

    if (!bounds) {
        return position;
    }

    const margin = Math.max(0, Number(physics.collision_margin) || 0);
    const restitution = Math.min(Math.max(Number(physics.restitution) || 0, 0), 1);
    const friction = Math.min(Math.max(Number(physics.friction) || 0, 0), 1);
    const damping = 1 - restitution * (1 - friction * 0.5);

    return position.map((value, axis) => {
        const min = bounds.min[axis] + margin;
        const max = bounds.max[axis] - margin;

        if (!isFiniteNumber(min) || !isFiniteNumber(max) || min >= max) {
            return value;
        }

        if (value < min) {
            return min + (min - value) * damping * 0.05;
        }

        if (value > max) {
            return max - (value - max) * damping * 0.05;
        }

        return value;
    });
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

const normalizeColorRampStop = (stop = {}, index = 0) => ({
    id: stop.id || uuid("particle-color-stop"),
    t: clamp(stop.t ?? index, 0, 1),
    color: normalizeColor(stop.color || [1, 1, 1, 1]),
});

const normalizeColorRamp = stops => {
    const incoming = Array.isArray(stops) && stops.length
        ? stops
        : [
            { id: "particle-color-start", t: 0, color: [1, 1, 1, 1] },
            { id: "particle-color-end", t: 1, color: [1, 1, 1, 1] },
        ];

    return incoming
        .map(normalizeColorRampStop)
        .sort((a, b) => a.t - b.t);
};

const createColorRampSampler = (stops = [], fallback = [1, 1, 1, 1]) => {
    const ramp = normalizeColorRamp(stops);

    return life => {
        const t = clamp(life, 0, 1);

        if (!ramp.length) {
            return fallback;
        }

        if (t <= ramp[0].t || ramp.length === 1) {
            return ramp[0].color;
        }

        for (let index = 1; index < ramp.length; index += 1) {
            const previous = ramp[index - 1];
            const next = ramp[index];

            if (t > next.t) {
                continue;
            }

            const amount = (t - previous.t) / Math.max(0.00001, next.t - previous.t);

            return [
                mix(previous.color[0], next.color[0], amount),
                mix(previous.color[1], next.color[1], amount),
                mix(previous.color[2], next.color[2], amount),
                mix(previous.color[3], next.color[3], amount),
            ];
        }

        return ramp[ramp.length - 1].color;
    };
};

const createInterpolationSampler = (interpolations = {}, lifetime = 1) => {
    const maxX = Math.max(0.001, Number(lifetime) || 1);
    const prepared = Object.keys(interpolations || {}).reduce((acc, key) => {
        const points = Array.isArray(interpolations[key])
            ? interpolations[key]
            : [];

        acc[key] = points
            .map(point => normalizeInterpolationPoint(point, maxX))
            .sort((a, b) => a.x - b.x);

        return acc;
    }, {});

    return (key, time, fallback = 0) => {
        const points = prepared[key] || [];

        if (!points.length) {
            return fallback;
        }

        const x = clamp(time, 0, maxX);

        if (x <= points[0].x) {
            return points[0].y;
        }

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1];
            const next = points[index];

            if (x > next.x) {
                continue;
            }

            const span = Math.max(0.00001, next.x - previous.x);
            const amount = (x - previous.x) / span;

            return previous.y + (next.y - previous.y) * amount;
        }

        return points[points.length - 1].y;
    };
};

const resolveParticleBudget = (count, context = {}) => {
    const requested = Math.max(0, Math.trunc(Number(count) || 0));
    const budget = Number(
        context.maxParticles ??
        context.particleBudget ??
        context.max_particle_count ??
        requested
    );

    if (!isFiniteNumber(budget) || budget <= 0) {
        return requested;
    }

    return Math.max(0, Math.min(requested, Math.trunc(budget)));
};

const normalizeInterpolationPoint = (point, maxX = 1) => ({
    x: clamp(point?.x ?? 0, 0, Math.max(0.001, maxX)),
    y: isFiniteNumber(Number(point?.y)) ? Number(point.y) : 0,
});

const pointsForValue = (value, maxX = 1) => ([
    { x: 0, y: value },
    { x: maxX / 2, y: value },
    { x: maxX, y: value },
]);

const createPathPoint = (point = {}, index = 0) => ({
    id: point.id || uuid("particle-path-point"),
    t: clamp(point.t ?? index, 0, 1000),
    translate: {
        x: Number(point.translate?.x ?? point.x ?? 0) || 0,
        y: Number(point.translate?.y ?? point.y ?? 0) || 0,
        z: Number(point.translate?.z ?? point.z ?? 0) || 0,
    },
});

const normalizeTextureSequenceItem = (item = {}, index = 0) => ({
    id: item.id || uuid("particle-sequence-item"),
    layer_id: String(item.layer_id || ""),
    name: String(item.name || `Texture ${index + 1}`),
    url: String(item.url || ""),
});

const normalizeTextureSequence = items => (
    Array.isArray(items)
        ? items
            .filter(item => item && typeof item === "object")
            .map(normalizeTextureSequenceItem)
            .filter(item => item.layer_id || item.url)
        : []
);

const mix = (a, b, t) => a + (b - a) * t;
const mixVector = (a, b, t) => ({
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
});

const normalizeDirection = (x = 0, y = 0, z = 1) => {
    const length = Math.hypot(Number(x) || 0, Number(y) || 0, Number(z) || 0);

    if (length <= 0.00001) {
        return { x: 0, y: 0, z: 1 };
    }

    return {
        x: (Number(x) || 0) / length,
        y: (Number(y) || 0) / length,
        z: (Number(z) || 0) / length,
    };
};

const createParticleLayer = (layer = {}, index = 0, textureSlot = "baseColor") => ({
    id: layer.id || uuid("particle-layer"),
    name: layer.name || (index === 0 ? "Default Layer" : `Layer ${index + 1}`),
    texture_slot: String(layer.texture_slot || textureSlot || "baseColor"),
    layer_id: String(layer.layer_id || ""),
    url: String(layer.url || ""),
    sequence_enabled: layer.sequence_enabled === true,
    sequence_mode: ["clockwise", "random"].includes(layer.sequence_mode) ? layer.sequence_mode : "clockwise",
    sequence_interval_ms: clampInt(layer.sequence_interval_ms ?? 100, 16, 60000),
    texture_sequence: normalizeTextureSequence(layer.texture_sequence),
    settings: layer.settings && typeof layer.settings === "object" ? clone(layer.settings) : {},
});

const rootAnimationFactor = (mode = "inner", life = 0) => {
    const amount = clamp(life, 0, 1);

    if (mode === "point") {
        return 0;
    }

    if (mode === "outer") {
        return 1 - amount;
    }

    return amount;
};

export class ParticleSystem {
    static INTERPOLATION_ATTRIBUTES = Object.freeze([
        { key: "lifetime", label: "Lifetime", defaultValue: 1 },
        { key: "size_x", label: "Size X", defaultValue: 1 },
        { key: "size_y", label: "Size Y", defaultValue: 1 },
        { key: "alpha", label: "Alpha", defaultValue: 1 },
        { key: "gravity", label: "Gravity", defaultValue: 0 },
        { key: "velocity", label: "Velocity", defaultValue: 0 },
        { key: "direction_x", label: "Direction X", defaultValue: 0 },
        { key: "direction_y", label: "Direction Y", defaultValue: 0 },
        { key: "direction_z", label: "Direction Z", defaultValue: 1 },
        { key: "rotation", label: "Rotation", defaultValue: 0 },
    ]);

    static DEFAULT_INTERPOLATIONS = Object.freeze(
        ParticleSystem.INTERPOLATION_ATTRIBUTES.reduce((acc, item) => {
            acc[item.key] = pointsForValue(item.defaultValue);
            return acc;
        }, {})
    );

    static DEFAULT_PATH_FOLLOW = Object.freeze({
        enabled: false,
        active_point_id: "",
        points: [
            createPathPoint({ t: 0 }),
            createPathPoint({ t: 1, translate: { x: 0, y: 0, z: 0.35 } }),
        ],
    });

    static DEFAULTS = Object.freeze({
        enabled: false,
        mode: "texture",
        source: "texture",
        emitter: "volume",
        root_animation: "inner",
        texture_slot: "baseColor",
        count: 30,
        seed: 1337,
        lifetime: 1,
        age: 1.2,
        time_scale: 1,
        size: 50,
        radius: 1,
        volume_flow: "inside",
        random_size: false,
        size_randomness: 0,
        size_x: 1,
        size_y: 1,
        alpha: 1,
        spread_x: 1,
        spread_y: 1,
        spread_z: 1,
        velocity: 0,
        velocity_x: 0,
        velocity_y: 0,
        velocity_z: 0,
        direction_x: 0,
        direction_y: 0,
        direction_z: 1,
        rotation: 0,
        velocity_randomness: 0,
        gravity: 0,
        turbulence: 0.22,
        orbit: 0,
        mesh_influence: 0.65,
        color: [1, 1, 1, 1],
        color_ramp: normalizeColorRamp(),
        blend: "alpha",
        depth_write: false,
        sort: true,
        use_mesh_reference: false,
        interpolation_attribute: "alpha",
        interpolations: ParticleSystem.DEFAULT_INTERPOLATIONS,
        path_follow: ParticleSystem.DEFAULT_PATH_FOLLOW,
        active_layer_id: "particle-layer-default",
        layers: [
            {
                id: "particle-layer-default",
                name: "Default Layer",
                texture_slot: "baseColor",
                layer_id: "",
                url: "",
            },
        ],
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
        const hasOwnInterpolations = Object.prototype.hasOwnProperty.call(settings || {}, "interpolations");
        const hasOwnPathFollow = Object.prototype.hasOwnProperty.call(settings || {}, "path_follow");
        const lifetime = clamp(source.lifetime, 0.1, 60);

        const layers = ParticleSystem.normalizeLayers(source.layers, source.texture_slot);
        const activeLayer = layers.find(layer => layer.id === source.active_layer_id) || layers[0];
        const textureSlot = String(activeLayer?.texture_slot || source.texture_slot || "baseColor");

        return {
            enabled: source.enabled === true,
            mode: ["texture", "mesh"].includes(source.mode) ? source.mode : "texture",
            source: ["texture", "mesh", "volume"].includes(source.source) ? source.source : "texture",
            emitter: ["volume", "surface", "vertices", "sphere", "plane"].includes(source.emitter) ? source.emitter : "volume",
            root_animation: ["point", "inner", "outer"].includes(source.root_animation) ? source.root_animation : "inner",
            volume_flow: ["inside", "outside"].includes(source.volume_flow) ? source.volume_flow : "inside",
            texture_slot: textureSlot,
            count: clampInt(source.count, 1, 5000),
            seed: clampInt(source.seed, 1, 9999999),
            lifetime,
            age: clamp(source.age, 0, 60),
            time_scale: clamp(source.time_scale, 0, 8),
            size: clamp(source.size, 1, 120),
            radius: clamp(source.radius, 0, 50),
            random_size: source.random_size === true || source.randomSize === true,
            size_randomness: clamp(source.size_randomness, 0, 1),
            size_x: Math.max(Number(source.size_x) || 1, 0.001),
            size_y: Math.max(Number(source.size_y) || 1, 0.001),
            alpha: clamp(source.alpha, 0, 1),
            spread_x: clamp(source.spread_x, 0.001, 20),
            spread_y: clamp(source.spread_y, 0.001, 20),
            spread_z: clamp(source.spread_z, 0.001, 20),
            velocity: clamp(source.velocity, -10, 10),
            velocity_x: clamp(source.velocity_x, -10, 10),
            velocity_y: clamp(source.velocity_y, -10, 10),
            velocity_z: clamp(source.velocity_z, -10, 10),
            direction_x: clamp(source.direction_x, -50, 50),
            direction_y: clamp(source.direction_y, -50, 50),
            direction_z: clamp(source.direction_z, -50, 50),
            rotation: clamp(source.rotation, -360, 360),
            velocity_randomness: clamp(source.velocity_randomness, 0, 10),
            gravity: clamp(source.gravity, -10, 10),
            turbulence: clamp(source.turbulence, 0, 10),
            orbit: clamp(source.orbit, -10, 10),
            mesh_influence: clamp(source.mesh_influence, 0, 1),
            color: normalizeColor(source.color),
            color_ramp: normalizeColorRamp(source.color_ramp),
            blend: ["alpha", "additive", "screen"].includes(source.blend) ? source.blend : "alpha",
            depth_write: source.depth_write === true,
            sort: source.sort !== false,
            use_mesh_reference: source.use_mesh_reference === true,
            interpolation_attribute: ParticleSystem.hasInterpolationAttribute(source.interpolation_attribute)
                ? source.interpolation_attribute
                : "alpha",
            interpolations: ParticleSystem.normalizeInterpolations(
                hasOwnInterpolations ? source.interpolations : {},
                lifetime
            ),
            path_follow: ParticleSystem.normalizePathFollow(
                hasOwnPathFollow ? source.path_follow : {},
                lifetime
            ),
            active_layer_id: activeLayer?.id || "particle-layer-default",
            layers,
        };
    }

    static normalizeLayers(layers = [], textureSlot = "baseColor") {
        const incoming = Array.isArray(layers) && layers.length
            ? layers
            : [createParticleLayer({ id: "particle-layer-default", texture_slot: textureSlot }, 0, textureSlot)];

        return incoming
            .filter(layer => layer && typeof layer === "object")
            .map((layer, index) => createParticleLayer(layer, index, textureSlot));
    }

    static hasInterpolationAttribute(key) {
        return ParticleSystem.INTERPOLATION_ATTRIBUTES.some(item => item.key === key);
    }

    static normalizeInterpolations(interpolations = {}, lifetime = 1) {
        const maxX = Math.max(0.001, Number(lifetime) || 1);

        return ParticleSystem.INTERPOLATION_ATTRIBUTES.reduce((acc, item) => {
            const incoming = Array.isArray(interpolations?.[item.key])
                ? interpolations[item.key]
                : pointsForValue(item.defaultValue, maxX);
            const points = incoming
                .map(point => normalizeInterpolationPoint(point, maxX))
                .sort((a, b) => a.x - b.x);

            acc[item.key] = points.length ? points : pointsForValue(item.defaultValue, maxX);
            return acc;
        }, {});
    }

    static evaluateInterpolation(interpolations = {}, key, time, fallback = 0, lifetime = 1) {
        const points = Array.isArray(interpolations?.[key])
            ? interpolations[key]
            : [];

        if (!points.length) {
            return fallback;
        }

        const maxX = Math.max(0.001, Number(lifetime) || 1);
        const x = clamp(time, 0, maxX);
        const sorted = points.map(point => normalizeInterpolationPoint(point, maxX)).sort((a, b) => a.x - b.x);

        if (x <= sorted[0].x) {
            return sorted[0].y;
        }

        for (let index = 1; index < sorted.length; index += 1) {
            const previous = sorted[index - 1];
            const next = sorted[index];

            if (x > next.x) {
                continue;
            }

            const span = Math.max(0.00001, next.x - previous.x);
            const amount = (x - previous.x) / span;

            return previous.y + (next.y - previous.y) * amount;
        }

        return sorted[sorted.length - 1].y;
    }

    static normalizePathFollow(pathFollow = {}, lifetime = 1) {
        const maxT = Math.max(0.001, Number(lifetime) || 1);
        const incoming = Array.isArray(pathFollow?.points) && pathFollow.points.length
            ? pathFollow.points
            : [
                createPathPoint({ t: 0 }),
                createPathPoint({ t: maxT, translate: { x: 0, y: 0.35, z: 0.2 } }),
            ];
        const points = incoming
            .map((point, index) => createPathPoint({
                ...point,
                t: clamp(point?.t ?? index, 0, maxT),
            }, index))
            .sort((a, b) => a.t - b.t);

        if (
            points.length === 2 &&
            points[0].t === 0 &&
            points[1].t === 1 &&
            maxT !== 1 &&
            pathFollow === ParticleSystem.DEFAULT_PATH_FOLLOW
        ) {
            points[1] = createPathPoint({
                ...points[1],
                t: maxT,
            }, 1);
        }

        return {
            enabled: pathFollow?.enabled === true,
            active_point_id: pathFollow?.active_point_id || points[0]?.id || "",
            points,
        };
    }

    static evaluatePathFollow(pathFollow = {}, time = 0) {
        const points = Array.isArray(pathFollow.points) ? pathFollow.points : [];

        if (!pathFollow.enabled || !points.length) {
            return createPathPoint();
        }

        const sorted = points.map(createPathPoint).sort((a, b) => a.t - b.t);
        const t = clamp(time, sorted[0].t, sorted[sorted.length - 1].t);

        if (t <= sorted[0].t || sorted.length === 1) {
            return sorted[0];
        }

        for (let index = 1; index < sorted.length; index += 1) {
            const previous = sorted[index - 1];
            const next = sorted[index];

            if (t > next.t) {
                continue;
            }

            const amount = (t - previous.t) / Math.max(0.00001, next.t - previous.t);
            return {
                id: previous.id,
                t,
                translate: mixVector(previous.translate, next.translate, amount),
            };
        }

        return sorted[sorted.length - 1];
    }

    static generate(settings = {}, context = {}) {
        const config = ParticleSystem.normalize(settings);
        const particleCount = resolveParticleBudget(config.count, context);
        const rand = random(config.seed);
        const stride = 12;
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const scales = new Float32Array(particleCount * 2);
        const alphas = new Float32Array(particleCount);
        const colors = new Float32Array(particleCount * 4);
        const phases = new Float32Array(particleCount);
        const rotations = new Float32Array(particleCount);
        const data = new Float32Array(particleCount * stride);
        const mesh = context.mesh || null;
        const volume = context.volume || config.volume || mesh?.volume || null;
        const fluid = context.fluid || config.fluid || mesh?.fluid || null;
        const physics = context.physics || config.physics || mesh?.physics || null;
        const physicsGravityScale = physics?.enabled
            ? physics?.gravity_enabled !== false ? Number(physics.gravity_scale ?? 1) || 0 : 0
            : 1;
        const interpolationValue = createInterpolationSampler(config.interpolations, config.lifetime);
        const colorAtLife = createColorRampSampler(config.color_ramp, config.color);
        const pathEnabled = config.path_follow?.enabled === true;
        const useVolume = !pathEnabled && volume?.enabled === true && (
            config.source === "volume" ||
            config.emitter === "volume"
        );
        const useMesh = !pathEnabled && !useVolume && (
            config.use_mesh_reference ||
            config.source === "mesh" ||
            ["surface", "vertices"].includes(config.emitter)
        );

        for (let index = 0; index < particleCount; index += 1) {
            const phase = rand();
            const lifetimeValue = Math.max(0.1, interpolationValue("lifetime", phase * config.lifetime, config.lifetime));
            const life = ((config.age * config.time_scale) / lifetimeValue + phase) % 1;
            const lifeTime = life * Math.max(0.001, config.lifetime);
            const sizeXValue = Math.max(0.001, interpolationValue("size_x", lifeTime, config.size_x));
            const sizeYValue = Math.max(0.001, interpolationValue("size_y", lifeTime, config.size_y));
            const alphaValue = Math.max(0, interpolationValue("alpha", lifeTime, config.alpha));
            const gravityValue = interpolationValue("gravity", lifeTime, config.gravity) * physicsGravityScale;
            const velocityValue = interpolationValue("velocity", lifeTime, config.velocity);
            const directionX = interpolationValue("direction_x", lifeTime, config.direction_x);
            const directionY = interpolationValue("direction_y", lifeTime, config.direction_y);
            const directionZ = interpolationValue("direction_z", lifeTime, config.direction_z || 1);
            const rotationValue = interpolationValue("rotation", lifeTime, config.rotation);
            const baseDirection = normalizeDirection(directionX, directionY, directionZ);
            const rotationRadians = rotationValue * Math.PI / 180;
            const directionCos = Math.cos(rotationRadians);
            const directionSin = Math.sin(rotationRadians);
            const direction = normalizeDirection(
                baseDirection.x * directionCos - baseDirection.y * directionSin,
                baseDirection.x * directionSin + baseDirection.y * directionCos,
                baseDirection.z
            );
            const pathPoint = ParticleSystem.evaluatePathFollow(config.path_follow, lifeTime);
            const meshPosition = useVolume
                ? sampleMeshVolumePosition(mesh, rand, volume, config.volume_flow)
                : useMesh ? sampleMeshPosition(mesh, rand) : null;
            const theta = rand() * Math.PI * 2;
            const radius = Math.sqrt(rand());
            const sphereZ = rand() * 2 - 1;
            const sphereRadius = Math.sqrt(Math.max(0, 1 - sphereZ * sphereZ));
            const base = meshPosition || (
                config.emitter === "sphere"
                    ? [
                        Math.cos(theta) * sphereRadius * radius * config.radius,
                        Math.sin(theta) * sphereRadius * radius * config.radius,
                        sphereZ * radius * config.radius,
                    ]
                    : [
                        (rand() - 0.5) * config.spread_x * config.radius,
                        (rand() - 0.5) * config.spread_y * config.radius,
                        config.emitter === "plane" ? 0 : (rand() - 0.5) * config.spread_z * config.radius,
                    ]
            );
            const swirl = config.orbit * life * Math.PI * 2;
            const c = Math.cos(swirl);
            const s = Math.sin(swirl);
            const vx = config.velocity_x + direction.x * velocityValue + (rand() - 0.5) * config.velocity_randomness;
            const fluidDownFlow = useVolume && fluid?.enabled === true && config.volume_flow === "outside"
                ? -Math.abs(Number(fluid.surface_flow ?? fluid.advection ?? 0.45) || 0) * life
                : 0;
            const vy = config.velocity_y + direction.y * velocityValue + (rand() - 0.5) * config.velocity_randomness;
            const vz = config.velocity_z + direction.z * velocityValue + (rand() - 0.5) * config.velocity_randomness + gravityValue * life + fluidDownFlow;
            const flow = config.volume_flow === "outside"
                ? 1
                : config.root_animation === "point"
                ? 1
                : rootAnimationFactor(config.root_animation, life);
            const root = [
                base[0] * flow,
                base[1] * flow,
                base[2] * flow,
            ];
            const noise = [
                Math.sin((index + 1) * 12.989 + life * 6.283) * config.turbulence * 0.05,
                Math.cos((index + 1) * 78.233 + life * 4.19) * config.turbulence * 0.05,
                Math.sin((index + 1) * 39.425 + life * 7.31) * config.turbulence * 0.05,
            ];
            const pathTranslate = pathPoint.translate || { x: 0, y: 0, z: 0 };
            const localPosition = resolveVolumeCollision([
                root[0] * c - root[1] * s + vx * life + noise[0],
                root[0] * s + root[1] * c + vy * life + noise[1],
                root[2] + vz * life + noise[2],
            ], mesh, useVolume && fluid?.particle_collision !== false && config.volume_flow === "inside" ? physics : null);
            const x = pathEnabled ? localPosition[0] + pathTranslate.x : localPosition[0];
            const y = pathEnabled ? localPosition[1] + pathTranslate.y : localPosition[1];
            const z = pathEnabled ? localPosition[2] + pathTranslate.z : localPosition[2];
            const fade = Math.sin(Math.PI * life);
            const randomScale = config.random_size ? 0.35 + rand() * 0.65 : 1;
            const fadeScale = 0.55 + fade * 0.45;
            const sizeX = Math.max(0.1, config.size * sizeXValue * randomScale * fadeScale);
            const sizeY = Math.max(0.1, config.size * sizeYValue * randomScale * fadeScale);
            const pointSize = Math.max(sizeX, sizeY, 1);
            const alpha = clamp(alphaValue, 0, 1) * Math.max(0.05, fade);
            const color = colorAtLife(life);
            const positionOffset = index * 3;
            const scaleOffset = index * 2;
            const colorOffset = index * 4;
            const target = index * stride;

            positions[positionOffset] = x;
            positions[positionOffset + 1] = y;
            positions[positionOffset + 2] = z;
            sizes[index] = pointSize;
            scales[scaleOffset] = sizeX / pointSize;
            scales[scaleOffset + 1] = sizeY / pointSize;
            alphas[index] = alpha;
            colors[colorOffset] = color[0];
            colors[colorOffset + 1] = color[1];
            colors[colorOffset + 2] = color[2];
            colors[colorOffset + 3] = color[3];
            phases[index] = phase;
            rotations[index] = rotationRadians;

            data[target] = x;
            data[target + 1] = y;
            data[target + 2] = z;
            data[target + 3] = pointSize;
            data[target + 4] = alpha;
            data[target + 5] = rotationRadians;
            data[target + 6] = scales[scaleOffset];
            data[target + 7] = scales[scaleOffset + 1];
            data[target + 8] = color[0];
            data[target + 9] = color[1];
            data[target + 10] = color[2];
            data[target + 11] = color[3];
        }

        return {
            stride,
            count: particleCount,
            sourceCount: config.count,
            positions,
            sizes,
            scales,
            alphas,
            colors,
            phases,
            rotations,
            data,
        };
    }

    static update(system = {}, patch = {}, context = {}) {
        return ParticleSystem.create({
            ...system,
            ...patch,
            id: system.id,
        }, context);
    }

    static toPlain(system = null, { compact = false, context = {} } = {}) {
        const normalized = ParticleSystem.normalize(system || {});

        return {
            id: system?.id || "",
            version: Number(system?.version || 1),
            ...normalized,
            particles: compact ? {
                stride: 12,
                count: normalized.count,
                compact: true,
            } : ParticleSystem.generate(normalized, context),
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
