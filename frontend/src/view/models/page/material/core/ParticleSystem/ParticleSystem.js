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

const sampleColorRamp = (stops = [], life = 0, fallback = [1, 1, 1, 1]) => {
    const ramp = normalizeColorRamp(stops);
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

const normalizeInterpolationPoint = (point, maxX = 1) => ({
    x: clamp(point?.x ?? 0, 0, Math.max(0.001, maxX)),
    y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 0,
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

const mix = (a, b, t) => a + (b - a) * t;
const mixVector = (a, b, t) => ({
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
});

const normalizeDirection = (x = 0, y = 1, z = 0) => {
    const length = Math.hypot(Number(x) || 0, Number(y) || 0, Number(z) || 0);

    if (length <= 0.00001) {
        return { x: 0, y: 1, z: 0 };
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
            createPathPoint({ t: 1, translate: { x: 0, y: 0.35, z: 0.2 } }),
        ],
    });

    static DEFAULTS = Object.freeze({
        enabled: false,
        mode: "texture",
        source: "texture",
        emitter: "volume",
        root_animation: "inner",
        texture_slot: "baseColor",
        count: 320,
        seed: 1337,
        lifetime: 1,
        age: 1.2,
        time_scale: 1,
        size: 18,
        radius: 1,
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
        direction_z: 0,
        rotation: 0,
        velocity_randomness: 0,
        gravity: 0,
        turbulence: 0.22,
        orbit: 0.18,
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
            mode: ["texture", "mesh", "mixed"].includes(source.mode) ? source.mode : "texture",
            source: ["texture", "mesh", "volume"].includes(source.source) ? source.source : "texture",
            emitter: ["volume", "surface", "vertices", "sphere", "plane"].includes(source.emitter) ? source.emitter : "volume",
            root_animation: ["point", "inner", "outer"].includes(source.root_animation) ? source.root_animation : "inner",
            texture_slot: textureSlot,
            count: clampInt(source.count, 1, 5000),
            seed: clampInt(source.seed, 1, 9999999),
            lifetime,
            age: clamp(source.age, 0, 60),
            time_scale: clamp(source.time_scale, 0, 8),
            size: clamp(source.size, 1, 120),
            radius: clamp(source.radius, 0.001, 50),
            random_size: source.random_size === true || source.randomSize === true,
            size_randomness: clamp(source.size_randomness, 0, 1),
            size_x: clamp(source.size_x, 0.001, 20),
            size_y: clamp(source.size_y, 0.001, 20),
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
        const rand = random(config.seed);
        const positions = [];
        const sizes = [];
        const scales = [];
        const alphas = [];
        const colors = [];
        const phases = [];
        const rotations = [];
        const mesh = context.mesh || null;
        const pathEnabled = config.path_follow?.enabled === true;
        const useMesh = !pathEnabled && (
            config.use_mesh_reference ||
            config.source === "mesh" ||
            ["surface", "vertices"].includes(config.emitter)
        );

        for (let index = 0; index < config.count; index += 1) {
            const phase = rand();
            const lifetimeValue = Math.max(0.1, ParticleSystem.evaluateInterpolation(config.interpolations, "lifetime", phase * config.lifetime, config.lifetime, config.lifetime));
            const life = ((config.age * config.time_scale) / lifetimeValue + phase) % 1;
            const lifeTime = life * Math.max(0.001, config.lifetime);
            const randomSizeValue = config.random_size ? config.size_randomness : 0;
            const sizeXValue = Math.max(0.001, ParticleSystem.evaluateInterpolation(config.interpolations, "size_x", lifeTime, config.size_x, config.lifetime));
            const sizeYValue = Math.max(0.001, ParticleSystem.evaluateInterpolation(config.interpolations, "size_y", lifeTime, config.size_y, config.lifetime));
            const alphaValue = Math.max(0, ParticleSystem.evaluateInterpolation(config.interpolations, "alpha", lifeTime, config.alpha, config.lifetime));
            const gravityValue = ParticleSystem.evaluateInterpolation(config.interpolations, "gravity", lifeTime, config.gravity, config.lifetime);
            const velocityValue = ParticleSystem.evaluateInterpolation(config.interpolations, "velocity", lifeTime, config.velocity, config.lifetime);
            const direction = normalizeDirection(0, 1, 0);
            const pathPoint = ParticleSystem.evaluatePathFollow(config.path_follow, lifeTime);
            const meshPosition = useMesh ? sampleMeshPosition(mesh, rand) : null;
            const theta = rand() * Math.PI * 2;
            const radius = Math.sqrt(rand());
            const sphereZ = rand() * 2 - 1;
            const sphereRadius = Math.sqrt(Math.max(0, 1 - sphereZ * sphereZ));
            const base = meshPosition || (
                config.emitter === "sphere"
                    ? [
                        Math.cos(theta) * sphereRadius * radius * config.radius,
                        sphereZ * radius * config.radius,
                        Math.sin(theta) * sphereRadius * radius * config.radius,
                    ]
                    : [
                        (rand() - 0.5) * config.spread_x * config.radius,
                        config.emitter === "plane" ? 0 : (rand() - 0.5) * config.spread_y * config.radius,
                        (rand() - 0.5) * config.spread_z * config.radius,
                    ]
            );
            const swirl = config.orbit * life * Math.PI * 2;
            const c = Math.cos(swirl);
            const s = Math.sin(swirl);
            const vx = config.velocity_x + direction.x * velocityValue + (rand() - 0.5) * config.velocity_randomness;
            const vy = config.velocity_y + direction.y * velocityValue + (rand() - 0.5) * config.velocity_randomness + gravityValue * life;
            const vz = config.velocity_z + direction.z * velocityValue + (rand() - 0.5) * config.velocity_randomness;
            const flow = rootAnimationFactor(config.root_animation, life);
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
            const localPosition = [
                root[0] * c - root[2] * s + vx * life + noise[0],
                root[1] + vy * life + noise[1],
                root[0] * s + root[2] * c + vz * life + noise[2],
            ];
            const x = (pathEnabled ? localPosition[0] + pathTranslate.x : localPosition[0]) + config.direction_x;
            const y = (pathEnabled ? localPosition[1] + pathTranslate.y : localPosition[1]) + config.direction_y;
            const z = (pathEnabled ? localPosition[2] + pathTranslate.z : localPosition[2]) + config.direction_z;
            const fade = Math.sin(Math.PI * life);
            const randomScale = 1 - randomSizeValue * rand();
            const fadeScale = 0.55 + fade * 0.45;
            const sizeX = Math.max(0.1, config.size * sizeXValue * randomScale * fadeScale);
            const sizeY = Math.max(0.1, config.size * sizeYValue * randomScale * fadeScale);
            const pointSize = Math.max(sizeX, sizeY, 1);

            positions.push(x, y, z);
            sizes.push(pointSize);
            scales.push(sizeX / pointSize, sizeY / pointSize);
            alphas.push(clamp(alphaValue, 0, 1) * Math.max(0.05, fade));
            colors.push(...sampleColorRamp(config.color_ramp, life, config.color));
            phases.push(phase);
            rotations.push(config.rotation * Math.PI / 180);
        }

        return {
            stride: 12,
            count: config.count,
            positions,
            sizes,
            scales,
            alphas,
            colors,
            phases,
            rotations,
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
