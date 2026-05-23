import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";

import { WebGLMaterialRenderer } from "@/models/layer/3D/webglMaterialRenderer";
import { ParticleSystem } from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";
import {
    createCubeVertices, createImage,
    CUBE_FACES,
    drawTextureFace,
    faceDepth,
    polygonArea, resolvePrincipled
} from "@/models/layer/3D/canvas2DMaterialRender";

const SURFACE_DEFAULTS = Object.freeze({
    baseColor: [1, 1, 1, 1],
    subsurface: 0,
    subsurfaceRadius: [1, 0.2, 0.1],
    subsurfaceColor: [1, 1, 1, 1],
    subsurfaceScale: 1,
    subsurfaceIor: 1.45,
    subsurfaceAnisotropy: 0,
    metallic: 0,
    specular: 0.5,
    specularTint: 0,
    roughness: 0.5,
    diffuseRoughness: 0,
    anisotropic: 0,
    anisotropicRotation: 0,
    sheen: 0,
    sheenRoughness: 0.5,
    sheenTint: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.03,
    coatIor: 1.5,
    coatTint: [1, 1, 1, 1],
    ior: 1.45,
    transmission: 0,
    transmissionRoughness: 0,
    emission: [0, 0, 0, 1],
    emissionStrength: 0,
    thinFilmThickness: 0,
    thinFilmIor: 1.33,
    alpha: 1,
    normal: 0,
    clearcoatNormal: 0,
    tangent: 0,
    bumpStrength: 0,
    displacementStrength: 0,
});

const SURFACE_ALIASES = Object.freeze({
    baseColor: ["baseColor", "base_color"],
    subsurfaceRadius: ["subsurfaceRadius", "subsurface_radius"],
    subsurfaceColor: ["subsurfaceColor", "subsurface_color"],
    subsurfaceScale: ["subsurfaceScale", "subsurface_scale"],
    subsurfaceIor: ["subsurfaceIor", "subsurface_ior"],
    subsurfaceAnisotropy: ["subsurfaceAnisotropy", "subsurface_anisotropy"],
    specularTint: ["specularTint", "specular_tint"],
    diffuseRoughness: ["diffuseRoughness", "diffuse_roughness"],
    anisotropicRotation: ["anisotropicRotation", "anisotropic_rotation"],
    sheenRoughness: ["sheenRoughness", "sheen_roughness"],
    sheenTint: ["sheenTint", "sheen_tint"],
    clearcoatRoughness: ["clearcoatRoughness", "clearcoat_roughness"],
    coatIor: ["coatIor", "coat_ior", "clearcoatIor", "clearcoat_ior"],
    coatTint: ["coatTint", "coat_tint", "clearcoatTint", "clearcoat_tint"],
    transmissionRoughness: ["transmissionRoughness", "transmission_roughness"],
    emissionStrength: ["emissionStrength", "emission_strength"],
    thinFilmThickness: ["thinFilmThickness", "thin_film_thickness"],
    thinFilmIor: ["thinFilmIor", "thin_film_ior"],
    clearcoatNormal: ["clearcoatNormal", "clearcoat_normal"],
    bumpStrength: ["bumpStrength", "bump_strength"],
    displacementStrength: ["displacementStrength", "displacement_strength"],
});

const SURFACE_RANGES = Object.freeze({
    emissionStrength: [0, 10],
    ior: [1, 4],
    subsurfaceScale: [0, 50],
    subsurfaceIor: [1, 2],
    coatIor: [1, 2],
    thinFilmThickness: [0, 1200],
    thinFilmIor: [1, 2],
});

const SCALAR_TEXTURE_SLOT_KEYS = Object.freeze([
    "subsurface",
    "subsurfaceScale",
    "subsurface_scale",
    "subsurfaceIor",
    "subsurface_ior",
    "subsurfaceAnisotropy",
    "subsurface_anisotropy",
    "metallic",
    "specular",
    "specularTint",
    "specular_tint",
    "roughness",
    "diffuseRoughness",
    "diffuse_roughness",
    "anisotropic",
    "anisotropicRotation",
    "anisotropic_rotation",
    "sheen",
    "sheenRoughness",
    "sheen_roughness",
    "sheenTint",
    "sheen_tint",
    "clearcoat",
    "clearcoatRoughness",
    "clearcoat_roughness",
    "coatIor",
    "coat_ior",
    "ior",
    "transmission",
    "transmissionRoughness",
    "transmission_roughness",
    "emissionStrength",
    "emission_strength",
    "thinFilmThickness",
    "thin_film_thickness",
    "thinFilmIor",
    "thin_film_ior",
    "normal",
    "clearcoatNormal",
    "clearcoat_normal",
    "tangent",
    "bumpStrength",
    "bump_strength",
    "displacementStrength",
    "displacement_strength",
]);

const SLOT_CANONICAL_KEYS = Object.freeze({
    base_color: "baseColor",
    subsurface_radius: "subsurfaceRadius",
    subsurface_color: "subsurfaceColor",
    subsurface_scale: "subsurfaceScale",
    subsurface_ior: "subsurfaceIor",
    subsurface_anisotropy: "subsurfaceAnisotropy",
    specular_tint: "specularTint",
    diffuse_roughness: "diffuseRoughness",
    anisotropic_rotation: "anisotropicRotation",
    sheen_roughness: "sheenRoughness",
    sheen_tint: "sheenTint",
    clearcoat_roughness: "clearcoatRoughness",
    coat_ior: "coatIor",
    clearcoat_ior: "coatIor",
    coat_tint: "coatTint",
    clearcoat_tint: "coatTint",
    transmission_roughness: "transmissionRoughness",
    emission_color: "emission",
    emission_strength: "emissionStrength",
    thin_film_thickness: "thinFilmThickness",
    thin_film_ior: "thinFilmIor",
    clearcoat_normal: "clearcoatNormal",
    bump_strength: "bumpStrength",
    displacement_strength: "displacementStrength",
});

const VISIBLE_TEXTURE_SLOTS = Object.freeze([
    "baseColor",
    "base_color",
    "subsurfaceColor",
    "subsurface_color",
    "coatTint",
    "coat_tint",
    "clearcoatTint",
    "clearcoat_tint",
    "emission",
    "emission_color",
    "alpha",
    ...SCALAR_TEXTURE_SLOT_KEYS,
]);

const COLOR_TEXTURE_SLOTS = Object.freeze([
    "baseColor",
    "base_color",
    "subsurfaceColor",
    "subsurface_color",
    "coatTint",
    "coat_tint",
    "clearcoatTint",
    "clearcoat_tint",
]);

const ALPHA_TEXTURE_SLOTS = Object.freeze([
    "alpha",
]);

const MATERIAL_TEXTURE_SLOTS = Object.freeze([
    "baseColor",
    "base_color",
    "subsurfaceColor",
    "subsurface_color",
]);

const CANVAS2D_TEXTURE_SLOTS = Object.freeze([
    "baseColor",
    "base_color",
]);

const FACE_NORMALS = Object.freeze({
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
});

const LIGHT_DEFAULTS = Object.freeze({
    enabled: true,
    lightType: "sun",
    mode: "sun",
    intensity: 1,
    ambient: 0.34,
    softness: 0.32,
    color: "#fff4e6",
    ambient_color: "#b3c7e6",
    environment_color: "#b8d1ff",
    range: 4,
    radius: 0.25,
    decay: 2,
    innerCone: 0.35,
    outerCone: 0.75,
    castShadow: false,
    temperature: 6500,
    position_x: 0,
    position_y: 1.4,
    position_z: 2.8,
    direction_x: -0.35,
    direction_y: -0.65,
    direction_z: 0.72,
});

const TEXTURE_SETTING_DEFAULTS = Object.freeze({
    channel: "rgba",
    color_mode: "color",
});

const normalizeTextureSettings = (...sources) => {
    const settings = sources.reduce((acc, source) => ({
        ...acc,
        ...(source || {}),
    }), {});
    const rawStrength = Number.isFinite(Number(settings.strength)) ? Number(settings.strength) : 1;
    const strength = settings.invert === true && rawStrength > 0 ? -rawStrength : rawStrength;

    return {
        channel: ["rgb", "rgba"].includes(settings.channel) ? settings.channel : TEXTURE_SETTING_DEFAULTS.channel,
        color_mode: ["color", "bw"].includes(settings.color_mode) ? settings.color_mode : TEXTURE_SETTING_DEFAULTS.color_mode,
        strength,
        offset: Number.isFinite(Number(settings.offset)) ? Number(settings.offset) : 0,
        invert: false,
    };
};

const applySignedSlotValue = (value, strength = 1, offset = 0) => {
    const amount = Math.abs(Number(strength) || 0);
    const input = Number(strength) < 0 ? 1 - clamp01(value) : Number(value ?? 0);

    return input * amount + Number(offset || 0);
};

const drawFacePath = (ctx, points) => {
    ctx.beginPath();

    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });

    ctx.closePath();
};

const applyAdditiveSurfaceColor = (ctx, points, surface, slotKey) => {
    if (!COLOR_TEXTURE_SLOTS.includes(slotKey)) {
        return;
    }

    const color = slotKey === "subsurfaceColor" || slotKey === "subsurface_color"
        ? surface.subsurfaceColor || [1, 1, 1, 1]
        : surface.baseColor || [1, 1, 1, 1];

    ctx.save();
    drawFacePath(ctx, points);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(${Math.round(clamp01(color[0]) * 255)}, ${Math.round(clamp01(color[1]) * 255)}, ${Math.round(clamp01(color[2]) * 255)}, ${clamp01(color[3] ?? 1) * 0.32})`;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
};

const applyCanvasColorShader = (ctx, points, surface, shade = 1) => {
    const baseColor = surface.baseColor || [1, 1, 1, 1];
    const alpha = clamp01(surface.alpha ?? 1);
    const specular = clamp01(surface.specular ?? 0);
    const diffuse = [
        clamp01(baseColor[0] * shade),
        clamp01(baseColor[1] * shade),
        clamp01(baseColor[2] * shade),
    ];
    const highlight = Math.max(0, shade - 1) * specular;

    const lit = diffuse.map(channel => clamp01(
        channel * (1 - highlight) + highlight
    ));

    ctx.save();
    drawFacePath(ctx, points);
    ctx.fillStyle = `rgba(${Math.round(lit[0] * 255)}, ${Math.round(lit[1] * 255)}, ${Math.round(lit[2] * 255)}, ${alpha})`;
    ctx.fill();
    ctx.restore();
};

const resolvePreviewOverlaySettings = materialLayer => {
    const settings = materialLayer?.settings || {};
    const preview = materialLayer?.preview || {};

    return {
        wireframe:
            settings.wireframe_preview === true ||
            preview.wireframe === true ||
            preview.wireframe_preview === true,

        faces:
            settings.faces_preview === true ||
            preview.faces === true ||
            preview.faces_preview === true,

        vertices:
            settings.vertices_preview === true ||
            preview.vertices === true ||
            preview.vertices_preview === true,
    };
};

const drawCanvasFaceOverlay = (ctx, points, faceName, index = 0) => {
    ctx.save();

    drawFacePath(ctx, points);
    ctx.fillStyle = index % 2 === 0
        ? "rgba(97, 230, 255, 0.105)"
        : "rgba(181, 138, 255, 0.09)";
    ctx.fill();

    const center = points.reduce(
        (acc, point) => ({
            x: acc.x + point.x / points.length,
            y: acc.y + point.y / points.length,
        }),
        { x: 0, y: 0 }
    );

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(faceName || "").toUpperCase(), center.x, center.y);

    ctx.restore();
};

const drawCanvasWireframeOverlay = (ctx, points) => {
    ctx.save();

    drawFacePath(ctx, points);
    ctx.strokeStyle = "rgba(97, 230, 255, 0.82)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.shadowColor = "rgba(97, 230, 255, 0.44)";
    ctx.shadowBlur = 5;
    ctx.stroke();

    ctx.restore();
};

const drawCanvasVertexOverlay = (ctx, points) => {
    ctx.save();

    points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(97, 230, 255, 0.88)";
        ctx.shadowColor = "rgba(97, 230, 255, 0.55)";
        ctx.shadowBlur = 5;
        ctx.stroke();
    });

    ctx.restore();
};

const drawCanvasTopologyOverlay = (ctx, points, faceName, overlaySettings, index) => {
    if (overlaySettings.faces) {
        drawCanvasFaceOverlay(ctx, points, faceName, index);
    }

    if (overlaySettings.wireframe) {
        drawCanvasWireframeOverlay(ctx, points);
    }

    if (overlaySettings.vertices) {
        drawCanvasVertexOverlay(ctx, points);
    }
};

const resolveObjectTextureSettings = materialLayer => {
    const settings = materialLayer?.settings || {};
    const blendMode = settings.blend_mode || materialLayer?.blend_mode || "BLEND";

    return {
        alpha_mode: ["OPAQUE", "BLEND", "HASHED", "CLIP"].includes(blendMode) ? blendMode : "BLEND",
        alpha_clip: Math.min(Math.max(Number(settings.alpha_clip ?? materialLayer?.alpha_clip ?? 0.5), 0), 1),
        shadow_method: ["NONE", "OPAQUE", "HASHED", "CLIP"].includes(settings.shadow_method)
            ? settings.shadow_method
            : "HASHED",
        backface_culling: settings.backface_culling === true || materialLayer?.backface_culling === true,
        show_backface: settings.show_backface !== false && materialLayer?.show_backface !== false,
        screen_space_refraction: settings.screen_space_refraction === true || materialLayer?.screen_space_refraction === true,
        refraction_depth: Math.min(Math.max(Number(settings.refraction_depth ?? materialLayer?.refraction_depth ?? 0), 0), 100),
        subsurface_translucency: settings.subsurface_translucency === true || materialLayer?.subsurface_translucency === true,
    };
};

const normalizeVector3 = vector => {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

    return [
        vector[0] / length,
        vector[1] / length,
        vector[2] / length,
    ];
};

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const canonicalSlotKey = slot => SLOT_CANONICAL_KEYS[slot] || slot;
const isBwTextureSlot = slot => SCALAR_TEXTURE_SLOT_KEYS.includes(slot) || slot === "alpha";

const clamp01 = value => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.min(Math.max(number, 0), 1);
};

const clonePlain = value => {
    if (!value || typeof value !== "object") {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

const parsePlainObject = value => {
    if (!value) {
        return {};
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (_error) {
            return {};
        }
    }

    return typeof value === "object" ? value : {};
};

const pickFirst = (source, keys, fallback) => {
    const list = Array.isArray(keys) ? keys : [keys];

    for (const key of list) {
        if (source?.[key] !== undefined && source?.[key] !== null) {
            return source[key];
        }
    }

    return fallback;
};

export function layer3DModel(props, emit) {
    const canvasRef = ref(null);
    const webglCanvasRef = ref(null);
    const activeRenderer = ref("WEBGL2");

    let frameId = null;
    let textureImages = {};
    let textureSampleCache = {};
    let materialPackage = null;
    let webglRenderer = null;
    let rotation = 0;
    let particleAge = 0;
    let lastFrameTime = 0;
    let initToken = 0;
    let running = false;

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const shouldPauseLayerAnimation = (materialLayer = null) => {
        if (materialLayer && isAnimatorViewport(materialLayer)) {
            return false;
        }

        return (
            props.pauseWebgl === true ||
            props.exportState === true
        );
    };

    const resolveExportAnimationTime = materialLayer => {
        if (props.exportState !== true) {
            return null;
        }

        const rawTime =
            props.layer?.time ??
            materialLayer?.time ??
            materialLayer?.particle_system?.time ??
            materialLayer?.particle_system?.age ??
            0;

        const time = Number(rawTime);

        return Number.isFinite(time) ? time : 0;
    };

    const resolveRotationSpeedPerSecond = materialLayer => {
        const raw =
            materialLayer?.preview?.idle_rotation?.speed_per_second ??
            materialLayer?.preview?.idle_rotation?.speedPerSecond ??
            materialLayer?.preview?.idle_rotation?.speed ??
            0.006;

        return Number.isFinite(Number(raw)) ? Number(raw) : 0.006;
    };

    const applyDeterministicExportTime = materialLayer => {
        const animationTime = resolveExportAnimationTime(materialLayer);

        if (animationTime === null) {
            return false;
        }

        if (particleSystemEnabled(materialLayer)) {
            const system = materialLayer.particle_system || {};
            const lifetime = Math.max(0.1, Number(system.lifetime) || 1);
            const speed = Math.max(0, Number(system.time_scale) || 1);

            particleAge = (animationTime * speed) % lifetime;
        }

        if (shouldRotatePreview(materialLayer)) {
            const speed = resolveRotationSpeedPerSecond(materialLayer);
            rotation = animationTime * speed;
        }

        return true;
    };

    const hasObjectKeys = value => (
        value &&
        typeof value === "object" &&
        Object.keys(value).length > 0
    );

    const pickViewportCamera = layer => {
        const candidates = [
            layer?.viewport_camera,
            layer?.settings?.viewport_camera,
            layer?.preview?.viewport_camera,
            layer?.shader?.viewport_camera,
            layer?.material?.viewport_camera,
        ];

        for (const candidate of candidates) {
            const parsed = parsePlainObject(candidate);

            if (hasObjectKeys(parsed)) {
                return parsed;
            }
        }

        return {};
    };

    const resolveMaterialLayer = layer => {
        const viewportCamera = pickViewportCamera(layer);

        const packageData = parsePlainObject(materialPackage);
        const material = parsePlainObject(packageData.values || materialPackage || layer?.values || layer?.material || {});
        const shader = parsePlainObject(layer?.shader || material.shader || {});
        const settings = parsePlainObject(layer?.settings || material.settings || {});

        return {
            ...clonePlain(material),

            surface: {
                ...parsePlainObject(material.principled_bsdf),
                ...parsePlainObject(material.surface),
                ...parsePlainObject(layer?.surface),
            },

            geometry: {
                ...parsePlainObject(material.geometry),
                ...parsePlainObject(shader.geometry),
                ...parsePlainObject(layer?.geometry),
            },

            mesh: {
                ...parsePlainObject(material.mesh),
                ...parsePlainObject(shader.mesh),
                ...parsePlainObject(layer?.mesh),
            },

            particle_system: {
                ...parsePlainObject(material.particle_system),
                ...parsePlainObject(shader.particle_system),
                ...parsePlainObject(layer?.particle_system),
            },

            light: {
                ...parsePlainObject(material.light),
                ...parsePlainObject(shader.light),
                ...parsePlainObject(settings.light),
                ...parsePlainObject(layer?.light),
            },

            bitmap_maps: {
                ...parsePlainObject(material.bitmap_maps),
                ...parsePlainObject(shader.bitmap_maps),
                ...parsePlainObject(layer?.bitmap_maps),
            },

            uv: {
                ...parsePlainObject(material.uv),
                ...parsePlainObject(shader.uv),
                ...parsePlainObject(layer?.uv),
            },

            shader_graph: {
                ...parsePlainObject(material.shader_graph),
                ...parsePlainObject(shader.graph),
                ...parsePlainObject(layer?.shader_graph),
            },

            preview: {
                ...parsePlainObject(material.preview),
                ...parsePlainObject(layer?.preview),
                viewport_camera: viewportCamera,
            },

            viewport_camera: viewportCamera,

            settings: {
                ...settings,
                ...parsePlainObject(layer?.settings),
                viewport_camera: viewportCamera,
            },
        };
    };

    const particleSystemEnabled = layer => layer?.particle_system?.enabled === true;

    const isAnimatorViewport = materialLayer => (
        materialLayer?.settings?.animator_viewport === true ||
        materialLayer?.viewport_camera?.mode === "world_orbit" ||
        materialLayer?.preview?.viewport_camera?.mode === "world_orbit"
    );

    const hasViewportCamera = materialLayer => (
        hasObjectKeys(materialLayer?.viewport_camera) ||
        hasObjectKeys(materialLayer?.settings?.viewport_camera) ||
        hasObjectKeys(materialLayer?.preview?.viewport_camera)
    );

    const shouldRotatePreview = materialLayer => (
        props.exportState !== true &&
        !isAnimatorViewport(materialLayer) &&
        (
            materialLayer?.preview?.idle_rotation?.enabled === true ||
            materialLayer?.preview?.rotate === true ||
            materialLayer?.settings?.rotate_preview === true
        )
    );

    const resolveAnimatedMaterialLayer = materialLayer => {
        if (!particleSystemEnabled(materialLayer)) {
            return materialLayer;
        }

        const sourceParticleSystem = materialLayer.particle_system || {};
        const particleSystem = ParticleSystem.update(
            sourceParticleSystem,
            { age: particleAge },
            {
                mesh: materialLayer.mesh,
                volume: materialLayer.mesh?.volume || materialLayer.geometry?.volume,
                fluid: materialLayer.mesh?.fluid || materialLayer.geometry?.fluid,
                physics: materialLayer.mesh?.physics || materialLayer.physics,
            }
        );
        const particleLayers = Array.isArray(particleSystem.layers)
            ? particleSystem.layers.map(layer => {
                if (!layer?.settings || typeof layer.settings !== "object") {
                    return layer;
                }

                const layerSystem = ParticleSystem.update(
                    {
                        ...particleSystem,
                        ...layer.settings,
                        active_layer_id: layer.id,
                        texture_slot: layer.texture_slot || particleSystem.texture_slot,
                        layers: [layer],
                    },
                    { age: particleAge },
                    {
                        mesh: materialLayer.mesh,
                        volume: materialLayer.mesh?.volume || materialLayer.geometry?.volume,
                        fluid: materialLayer.mesh?.fluid || materialLayer.geometry?.fluid,
                        physics: materialLayer.mesh?.physics || materialLayer.physics,
                    }
                );

                return {
                    ...layer,
                    particles: layerSystem.particles,
                    count: layerSystem.count,
                    alpha: layerSystem.alpha,
                    color: layerSystem.color,
                };
            })
            : [];

        return {
            ...materialLayer,
            particle_system: {
                ...particleSystem,
                layers: particleLayers.length ? particleLayers : particleSystem.layers,
            },
        };
    };

    const resolveRendererMode = materialLayer => {
        const value = String(
            materialLayer?.settings?.render_backend ||
            materialLayer?.settings?.renderer_mode ||
            materialLayer?.render_backend ||
            materialLayer?.renderer_mode ||
            "WEBGL2"
        ).toUpperCase();

        return value === "CANVAS2D" || value === "CANVAS_2D" || value === "CANVAS"
            ? "CANVAS2D"
            : "WEBGL2";
    };

    const isMaterialConnected = layer => {
        const materialLayer = resolveMaterialLayer(layer);
        const graph =
            materialLayer.shader_graph ||
            {};

        const edges = graph?.edges || [];

        return edges.some(edge => (
            edge?.from?.node === "principled-bsdf" &&
            edge?.from?.socket === "bsdf" &&
            edge?.to?.node === "material-output" &&
            edge?.to?.socket === "surface"
        ));
    };

    const normalizeSurface = materialLayer => {
        const resolved = resolvePrincipled({
            ...SURFACE_DEFAULTS,
            ...materialLayer.surface,
        });
        const maps = materialLayer.bitmap_maps || {};

        Object.keys(SURFACE_DEFAULTS).forEach(key => {
            const aliases = SURFACE_ALIASES[key] || [key];
            const baseValue = pickFirst(materialLayer.surface, aliases, resolved[key]);
            const slot = maps[key] || aliases.map(alias => maps[alias]).find(Boolean) || {};
            const strength = Number(slot.invert === true && Number(slot.strength ?? 1) > 0
                ? -Number(slot.strength ?? 1)
                : slot.strength ?? 1);
            const offset = Number(slot.offset ?? 0);

            if (Array.isArray(baseValue)) {
                const next = baseValue.slice();
                const shouldApplySlot =
                    slot.enabled ||
                    Number(slot.strength ?? 1) !== 1 ||
                    Number(slot.offset ?? 0) !== 0 ||
                    Number(strength) < 0 ||
                    slot.invert === true;

                if (shouldApplySlot) {
                    for (let index = 0; index < 3; index += 1) {
                        next[index] = clamp01(applySignedSlotValue(next[index] ?? 1, strength, offset));
                    }
                }

                resolved[key] = next;
                return;
            }

            const number = Number(baseValue ?? resolved[key] ?? 0);

            if (!Number.isFinite(number)) {
                return;
            }

            const mapped = slot.enabled
            || Number(slot.strength ?? 1) !== 1
            || Number(slot.offset ?? 0) !== 0
            || Number(strength) < 0
            || slot.invert === true
                ? applySignedSlotValue(number, strength, offset)
                : number;

            const range = SURFACE_RANGES[key] || [0, 1];

            resolved[key] = Math.min(Math.max(mapped, range[0]), range[1]);
        });

        return resolved;
    };

    const resolveCanvas2DSurface = (surface, { wireframe = false } = {}) => {
        const baseColor = Array.isArray(surface.baseColor)
            ? surface.baseColor.slice(0, 4)
            : SURFACE_DEFAULTS.baseColor.slice();

        while (baseColor.length < 4) {
            baseColor.push(1);
        }

        return {
            baseColor: [
                clamp01(baseColor[0]),
                clamp01(baseColor[1]),
                clamp01(baseColor[2]),
                clamp01(baseColor[3] ?? 1),
            ],
            alpha: clamp01(surface.alpha ?? 1) * (wireframe ? 0.2 : 1),
            specular: clamp01(surface.specular ?? SURFACE_DEFAULTS.specular),
        };
    };

    const resolveLight = materialLayer => {
        const input = {
            ...LIGHT_DEFAULTS,
            ...parsePlainObject(materialLayer?.light),
            ...parsePlainObject(materialLayer?.settings?.light),
        };

        const lightType = ["sun", "directional", "point", "spot", "area"].includes(input.lightType || input.light_type || input.mode)
            ? (input.lightType || input.light_type || input.mode)
            : LIGHT_DEFAULTS.lightType;

        return {
            enabled: input.enabled !== false,
            mode: lightType,
            lightType,
            intensity: Math.min(Math.max(Number(input.intensity ?? LIGHT_DEFAULTS.intensity), 0), 2),
            ambient: Math.min(Math.max(Number(input.ambient ?? LIGHT_DEFAULTS.ambient), 0), 1),
            softness: Math.min(Math.max(Number(input.softness ?? LIGHT_DEFAULTS.softness), 0), 1),
            color: input.color || LIGHT_DEFAULTS.color,
            ambient_color: input.ambient_color || LIGHT_DEFAULTS.ambient_color,
            environment_color: input.environment_color || LIGHT_DEFAULTS.environment_color,
            range: Math.min(Math.max(Number(input.range ?? LIGHT_DEFAULTS.range), 0.001), 100),
            radius: Math.min(Math.max(Number(input.radius ?? LIGHT_DEFAULTS.radius), 0), 10),
            decay: Math.min(Math.max(Number(input.decay ?? LIGHT_DEFAULTS.decay), 0), 4),
            innerCone: Math.min(Math.max(Number(input.innerCone ?? input.inner_cone ?? LIGHT_DEFAULTS.innerCone), 0), 1),
            outerCone: Math.min(Math.max(Number(input.outerCone ?? input.outer_cone ?? LIGHT_DEFAULTS.outerCone), 0), 1),
            castShadow: input.castShadow === true || input.cast_shadow === true,
            temperature: Math.min(Math.max(Number(input.temperature ?? LIGHT_DEFAULTS.temperature), 1000), 20000),
            position_x: Number(input.position_x ?? input.position?.[0] ?? LIGHT_DEFAULTS.position_x),
            position_y: Number(input.position_y ?? input.position?.[1] ?? LIGHT_DEFAULTS.position_y),
            position_z: Number(input.position_z ?? input.position?.[2] ?? LIGHT_DEFAULTS.position_z),
            direction_x: Number(input.direction_x ?? LIGHT_DEFAULTS.direction_x),
            direction_y: Number(input.direction_y ?? LIGHT_DEFAULTS.direction_y),
            direction_z: Number(input.direction_z ?? LIGHT_DEFAULTS.direction_z),
        };
    };

    const lightOverlay = computed(() => {
        const materialLayer = resolveMaterialLayer(props.layer);
        const light = resolveLight(materialLayer);
        const editing = materialLayer?.settings?.light_editing === true || light.editing === true;

        if (!editing) {
            return {
                visible: false,
            };
        }

        const lightType = light.lightType || light.mode || "sun";
        const position = [
            Number(light.position_x || 0),
            Number(light.position_y || 0),
            Number(light.position_z || 0),
        ];
        const direction = normalizeVector3([
            Number(light.direction_x || 0),
            Number(light.direction_y || -1),
            Number(light.direction_z || 0),
        ]);
        const distance = Math.hypot(position[0], position[1], position[2]);
        const range = Math.max(Number(light.range || 4), 0.001);
        const radius = Math.max(Number(light.radius || 0), 0);
        const intensity = Math.max(Number(light.intensity || 0), 0);
        const ambient = Math.max(Number(light.ambient || 0), 0);
        const softness = Math.max(Number(light.softness || 0), 0);
        const temperature = Math.max(Number(light.temperature || 6500), 1000);
        const innerCone = Math.max(0, Math.min(1, Number(light.innerCone ?? 0.35)));
        const outerCone = Math.max(0, Math.min(1, Number(light.outerCone ?? 0.75)));
        const decay = Math.max(0, Math.min(4, Number(light.decay ?? 2)));
        const castsShadow = light.castShadow === true;
        const isDirectional = lightType === "sun" || lightType === "directional";
        const isSpot = lightType === "spot";
        const hasRange = ["point", "spot"].includes(lightType);
        const localScale = Math.max(range, Math.abs(position[0]), Math.abs(position[1]), Math.abs(position[2]), 1);
        const projectedX = position[0] / localScale;
        const projectedY = position[1] / localScale;
        const pointX = isDirectional
            ? 50 - direction[0] * 32
            : 50 + projectedX * 42;
        const pointY = isDirectional
            ? 50 + direction[1] * 32
            : 50 - projectedY * 42;
        const clampedX = Math.max(6, Math.min(94, pointX));
        const clampedY = Math.max(6, Math.min(94, pointY));
        const dx = clampedX - 50;
        const dy = clampedY - 50;
        const overlayDistance = Math.hypot(dx, dy);
        const directionAngle = isDirectional
            ? Math.atan2(direction[1], -direction[0])
            : Math.atan2(-direction[1], direction[0]);
        const coneSpread = Math.max(16, Math.min(112, outerCone * 128));
        const innerSpread = Math.max(8, Math.min(coneSpread, innerCone * 128));
        const rangeSize = hasRange
            ? Math.max(28, Math.min(92, 24 + (range / 100) * 68))
            : Math.max(38, Math.min(74, 42 + radius * 3.2));
        const radiusSize = Math.max(12, Math.min(72, 14 + radius * 6.5));
        const glow = Math.max(0.18, Math.min(1, 0.28 + intensity * 0.35));
        const blur = Math.max(0, Math.min(18, softness * 18));
        const isOffscreen = !isDirectional && distance > range;
        const localMetrics = isDirectional
            ? [
                `${lightType}`,
                `dir ${direction[0].toFixed(2)} ${direction[1].toFixed(2)} ${direction[2].toFixed(2)}`,
                `rad ${radius.toFixed(2)}`,
                `int ${intensity.toFixed(2)}`,
                `amb ${ambient.toFixed(2)}`,
                `soft ${softness.toFixed(2)}`,
                `${Math.round(temperature)}K`,
                castsShadow ? "shadow on" : "shadow off",
            ]
            : [
                `${lightType}`,
                `pos ${position[0].toFixed(2)} ${position[1].toFixed(2)} ${position[2].toFixed(2)}`,
                isOffscreen ? "outside range" : "inside range",
                ["spot", "area"].includes(lightType) ? `dir ${direction[0].toFixed(2)} ${direction[1].toFixed(2)} ${direction[2].toFixed(2)}` : "",
                `dist ${distance.toFixed(2)}`,
                hasRange ? `range ${range.toFixed(2)}` : `rad ${radius.toFixed(2)}`,
                isSpot ? `cone ${innerCone.toFixed(2)}/${outerCone.toFixed(2)}` : `decay ${decay.toFixed(2)}`,
                `int ${intensity.toFixed(2)}`,
                `amb ${ambient.toFixed(2)}`,
                `soft ${softness.toFixed(2)}`,
                `${Math.round(temperature)}K`,
                castsShadow ? "shadow on" : "shadow off",
            ].filter(Boolean);

        return {
            visible: true,
            type: lightType,
            isSpot,
            isDirectional,
            metrics: localMetrics,
            style: {
                "--light-x": `${clampedX}%`,
                "--light-y": `${clampedY}%`,
                "--light-angle": `${Math.atan2(dy, dx)}rad`,
                "--light-dir-angle": `${directionAngle}rad`,
                "--light-distance": `${overlayDistance}%`,
                "--light-color": light.color || "#fff4e6",
                "--light-range-size": `${rangeSize}%`,
                "--light-radius-size": `${radiusSize}px`,
                "--light-cone-spread": `${coneSpread}px`,
                "--light-inner-spread": `${innerSpread}px`,
                "--light-glow": glow,
                "--light-blur": `${blur}px`,
                "--light-ambient": ambient,
            },
        };
    });

    const getSlotRange = slotKey => SURFACE_RANGES[slotKey] || [0, 1];

    const sampleTextureValue = (entry, faceName, uv) => {
        if (!entry?.image) {
            return null;
        }

        const cacheKey = `${entry.key || entry.url}:${faceName}:${entry.channel}:${entry.color_mode}:${entry.invert}:${entry.strength}:${entry.offset}`;

        if (textureSampleCache[cacheKey] !== undefined) {
            return textureSampleCache[cacheKey];
        }

        const image = entry.image;
        const imageWidth = image.naturalWidth || image.width || 1;
        const imageHeight = image.naturalHeight || image.height || 1;
        const faceUv = uv?.faces?.[faceName] || {};
        const faceOwnsBitmap = Boolean(faceUv.bitmap?.url && faceUv.bitmap.url === entry.url);
        const sx = Math.max(0, Math.floor((faceOwnsBitmap ? 0 : Number(faceUv.x ?? 0)) * imageWidth));
        const sy = Math.max(0, Math.floor((faceOwnsBitmap ? 0 : Number(faceUv.y ?? 0)) * imageHeight));
        const sw = Math.max(1, Math.floor((faceOwnsBitmap ? 1 : Number(faceUv.width ?? 1)) * imageWidth));
        const sh = Math.max(1, Math.floor((faceOwnsBitmap ? 1 : Number(faceUv.height ?? 1)) * imageHeight));
        const sampleSize = 12;
        const canvas = document.createElement("canvas");
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
            return null;
        }

        try {
            const sourceWidth = Math.max(1, Math.min(sw, imageWidth - sx));
            const sourceHeight = Math.max(1, Math.min(sh, imageHeight - sy));

            ctx.drawImage(
                image,
                sx,
                sy,
                sourceWidth,
                sourceHeight,
                0,
                0,
                sampleSize,
                sampleSize
            );

            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
            let total = 0;
            let alphaTotal = 0;

            for (let index = 0; index < data.length; index += 4) {
                total += (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255;
                alphaTotal += data[index + 3] / 255;
            }

            const pixels = data.length / 4;
            let value = total / pixels;

            if (entry.channel === "rgba") {
                value *= alphaTotal / pixels;
            }

            const strength = Number(entry.strength ?? 1);

            if (entry.invert === true || strength < 0) {
                value = 1 - value;
            }

            value = (value * Math.abs(strength)) + Number(entry.offset || 0);

            if (entry.color_mode === "bw" || isBwTextureSlot(canonicalSlotKey(entry.slot))) {
                value = value >= 0.5 ? 1 : 0;
            }

            textureSampleCache[cacheKey] = clamp01(value);
            return textureSampleCache[cacheKey];
        } catch (_error) {
            textureSampleCache[cacheKey] = null;
            return null;
        }
    };

    const getTextureForSlotFace = (slotKey, faceName) => {
        const canonical = canonicalSlotKey(slotKey);
        const mapped = Object.values(textureImages).find(item => (
            item.image &&
            canonicalSlotKey(item.slot) === canonical &&
            Array.isArray(item.faces) &&
            item.faces.includes(faceName)
        ));

        return mapped || Object.values(textureImages).find(item => item.image && canonicalSlotKey(item.slot) === canonical) || null;
    };

    const seededSequenceRandom = (seed, step) => {
        let value = (Math.trunc(Number(seed) || 1) + Math.trunc(Number(step) || 0) * 1013904223) >>> 0;
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };

    const resolveParticleLayerTextureUrl = layer => {
        const sequence = Array.isArray(layer?.texture_sequence)
            ? layer.texture_sequence.filter(item => item?.url)
            : [];

        if (layer?.sequence_enabled === true && sequence.length > 1) {
            const interval = Math.max(16, Number(layer.sequence_interval_ms) || 100);
            const step = Math.floor((particleAge * 1000) / interval);
            const index = layer.sequence_mode === "random"
                ? Math.floor(seededSequenceRandom(layer.id?.length || 1, step) * sequence.length) % sequence.length
                : step % sequence.length;

            return sequence[index]?.url || layer.url || "";
        }

        return layer?.url || "";
    };

    const getParticleTextureForLayer = layer => {
        const url = resolveParticleLayerTextureUrl(layer);

        if (!url) {
            return null;
        }

        return Object.values(textureImages).find(item => (
            item.image &&
            item.kind === "particle" &&
            item.particleLayerId === layer.id &&
            item.url === url
        )) || null;
    };

    const resolveSurfaceForFace = (surface, materialLayer, faceName) => {
        const uv = materialLayer.uv || {};
        const next = {
            ...surface,
            __textureSamples: {},
            __slotInputs: {},
        };
        const seenSlots = new Set();

        SCALAR_TEXTURE_SLOT_KEYS.forEach(slotKey => {
            const canonical = canonicalSlotKey(slotKey);

            if (seenSlots.has(canonical)) {
                return;
            }

            seenSlots.add(canonical);

            if (!Object.prototype.hasOwnProperty.call(next, canonical)) {
                return;
            }

            const slot = materialLayer.bitmap_maps?.[canonical] || materialLayer.bitmap_maps?.[slotKey] || {};
            const texture = getTextureForSlotFace(canonical, faceName);
            const sample = sampleTextureValue(texture, faceName, uv);
            const [minValue, maxValue] = getSlotRange(canonical);
            const strength = Math.min(Math.max(Number(slot.strength ?? texture?.strength ?? 1), -2), 2);
            const offset = Number(slot.offset ?? texture?.offset ?? 0);
            const base = Number(surface[canonical] ?? minValue);

            next.__slotInputs[canonical] = {
                hasTexture: sample !== null && sample !== undefined,
                sample,
                base,
                strength,
                offset,
                explicit: Boolean(
                    slot.enabled ||
                    texture ||
                    Number(slot.strength ?? 1) !== 1 ||
                    Number(slot.offset ?? 0) !== 0 ||
                    base > 0.001
                ),
            };

            if (sample === null || sample === undefined) {
                return;
            }

            next.__textureSamples[canonical] = sample;

            next[canonical] = minValue + sample * (maxValue - minValue);
        });

        return next;
    };

    const applyDisplacementToPoints = points => points;

    const resolveFaceShade = (face, _surface, light) => {
        if (!light.enabled || light.mode === "flat") {
            return light.ambient + face.shade * 0.5;
        }

        const normal = FACE_NORMALS[face.name] || [0, 0, 1];
        const direction = normalizeVector3([
            light.direction_x,
            light.direction_y,
            light.direction_z,
        ]);

        const diffuse = Math.max(0, dot3(normal, direction));
        const backFill = Math.max(0, dot3(normal, [-direction[0] * 0.45, -direction[1] * 0.45, Math.abs(direction[2]) * 0.35]));

        const modeBoost = light.mode === "rim"
            ? backFill * 0.45
            : light.mode === "softbox"
                ? 0.18 + diffuse * 0.82
                : diffuse;
        const direct = modeBoost * light.intensity;
        const softened = direct * (1 - light.softness * 0.35) + light.softness * 0.22;

        return Math.min(Math.max(light.ambient + softened, 0.12), 1.36);
    };

    const loadMaterialPackage = async layer => {
        const packageUrl = layer?.package?.url;

        if (!packageUrl) {
            return null;
        }

        try {
            const response = await fetch(packageUrl, {
                cache: "no-store",
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (_error) {
            return null;
        }
    };

    const stopLoop = () => {
        running = false;

        if (frameId) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
    };

    const drawCanvas2D = () => {
        const canvas = canvasRef.value;

        if (!canvas) {
            return;
        }

        const width = Number(props.layer?.width || 256);
        const height = Number(props.layer?.height || 256);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d", { alpha: true });

        if (!ctx) {
            return;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        if (!isMaterialConnected(props.layer)) {
            ctx.save();
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.strokeStyle = "rgba(255,123,123,0.65)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(12, 12, width - 24, height - 24);
            ctx.fillStyle = "rgba(255,123,123,0.78)";
            ctx.font = "12px sans-serif";
            ctx.fillText("Material Output disconnected", 22, 34);
            ctx.restore();
            return;
        }

        const materialLayer = resolveMaterialLayer(props.layer);
        const overlaySettings = resolvePreviewOverlaySettings(materialLayer);
        const surface = resolveCanvas2DSurface(
            normalizeSurface(materialLayer),
            { wireframe: overlaySettings.wireframe === true }
        );
        const light = resolveLight(materialLayer);
        const objectTextureSettings = resolveObjectTextureSettings(materialLayer);
        const useObjectTextures = overlaySettings.wireframe !== true;

        const uv = materialLayer.uv || {};

        const vertices = createCubeVertices(width, height, rotation, materialLayer.geometry || {});

        const faces = [...CUBE_FACES]
            .map(face => ({
                ...face,
                points: face.indices.map(index => vertices[index]),
                depth: faceDepth(face, vertices),
            }))
            .filter(face => Math.abs(polygonArea(face.points)) > 0.001)
            .sort((a, b) => a.depth - b.depth);

        ctx.save();

        faces.forEach((face, index) => {
            const faceSurface = resolveCanvas2DSurface(
                resolveSurfaceForFace(surface, materialLayer, face.name),
                { wireframe: overlaySettings.wireframe === true }
            );
            const points = applyDisplacementToPoints(face.points);
            const faceShade = resolveFaceShade(face, faceSurface, light);
            const faceAlpha = objectTextureSettings.alpha_mode === "OPAQUE"
                ? 1
                : faceSurface.alpha;

            if (objectTextureSettings.alpha_mode === "CLIP" && faceAlpha < objectTextureSettings.alpha_clip) {
                return;
            }

            const faceCanvas = document.createElement("canvas");
            faceCanvas.width = width;
            faceCanvas.height = height;

            const faceCtx = faceCanvas.getContext("2d", { alpha: true });

            if (!faceCtx) {
                return;
            }

            applyCanvasColorShader(faceCtx, points, {
                ...faceSurface,
                alpha: faceAlpha,
            }, faceShade);

            const faceTexture = useObjectTextures
                ? getCanvas2DTextureForFace(materialLayer, face.name)
                : null;

            if (faceTexture?.image) {
                drawTextureFace(
                    faceCtx,
                    faceTexture.image,
                    face,
                    points,
                    uv,
                    faceAlpha,
                    {
                        ...normalizeTextureSettings(faceTexture),
                        ...objectTextureSettings,
                    }
                );

                applyAdditiveSurfaceColor(
                    faceCtx,
                    points,
                    faceSurface,
                    faceTexture.slot || "baseColor"
                );
            }

            const alphaTexture = useObjectTextures
                ? getAlphaTextureForFace(materialLayer, face.name)
                : null;

            if (alphaTexture?.image) {
                drawTextureFace(
                    faceCtx,
                    alphaTexture.image,
                    face,
                    points,
                    uv,
                    faceAlpha,
                    {
                        ...normalizeTextureSettings(alphaTexture),
                        ...objectTextureSettings,
                        mask_composite: true,
                        mask_only: true,
                    }
                );
            }

            if (faceTexture?.image) {
                faceCtx.save();
                drawFacePath(faceCtx, points);
                faceCtx.clip();

                faceCtx.globalCompositeOperation = faceShade >= 1 ? "screen" : "multiply";
                faceCtx.fillStyle = faceShade >= 1
                    ? `rgba(255,255,255,${Math.min((faceShade - 1) * 0.34, 0.38)})`
                    : `rgba(0,0,0,${Math.min((1 - faceShade) * 0.44, 0.52)})`;

                faceCtx.fill();
                faceCtx.globalCompositeOperation = "source-over";

                faceCtx.restore();
            }

            ctx.drawImage(faceCanvas, 0, 0, width, height);

            drawCanvasTopologyOverlay(
                ctx,
                points,
                face.name,
                overlaySettings,
                index
            );
        });

        ctx.restore();

        if (props.selected) {
            ctx.save();
            ctx.strokeStyle = "rgba(112, 223, 180, 0.88)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(1, 1, width - 2, height - 2);
            ctx.restore();
        }
    };

    const drawWebGL = () => {
        const canvas = webglCanvasRef.value;

        if (!canvas || typeof WebGL2RenderingContext === "undefined") {
            return false;
        }

        if (!isMaterialConnected(props.layer)) {
            return false;
        }

        const width = Number(props.layer?.width || 256);
        const height = Number(props.layer?.height || 256);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const materialLayer = resolveAnimatedMaterialLayer(resolveMaterialLayer(props.layer));
        const rendererMode = resolveRendererMode(materialLayer);

        if (rendererMode !== "WEBGL2") {
            if (webglRenderer) {
                webglRenderer.destroy();
                webglRenderer = null;
            }

            return false;
        }

        const viewportCamera =
            materialLayer?.viewport_camera ||
            materialLayer?.settings?.viewport_camera ||
            materialLayer?.preview?.viewport_camera ||
            materialLayer?.shader?.viewport_camera ||
            null;
        const surface = normalizeSurface(materialLayer);
        const light = resolveLight(materialLayer);
        const objectTextureSettings = resolveObjectTextureSettings(materialLayer);

        try {
            if (!webglRenderer) {
                webglRenderer = new WebGLMaterialRenderer(canvas);
            }

            return webglRenderer.render({
                width,
                height,
                dpr,
                materialLayer,
                surface,
                light,
                objectTextureSettings,
                rotation,
                viewportCamera,
                previewOverlay: resolvePreviewOverlaySettings(materialLayer),
                resolveSurfaceForFace,
                getTextureForFace,
                getTextureForSlotFace,
                getAlphaTextureForFace,
                getParticleTextureForLayer,
            });
        } catch (error) {
            console.warn("Layer3D WebGL renderer failed.", error);
            return false;
        }
    };

    const draw = () => {
        const materialLayer = resolveMaterialLayer(props.layer);
        activeRenderer.value = resolveRendererMode(materialLayer);

        if (drawWebGL()) {
            return;
        }

        activeRenderer.value = "CANVAS2D";
        drawCanvas2D();
    };

    const getLayerTextureEntries = layer => {
        const uvEntries = new Map();

        Object.entries(layer?.uv?.faces || {}).forEach(([faceName, face]) => {
            const bitmap = face?.bitmap || {};

            if (!bitmap.url) {
                return;
            }

            if (!uvEntries.has(bitmap.url)) {
                uvEntries.set(bitmap.url, {
                    key: bitmap.url,
                    url: bitmap.url,
                    slot: "baseColor",
                    faces: [],
                    ...normalizeTextureSettings(bitmap),
                });
            }

            uvEntries.get(bitmap.url).faces.push(faceName);
        });

        const graphNodes = layer?.shader_graph?.nodes || [];
        const entries = Array.from(uvEntries.values());

        graphNodes.forEach(node => {
            const settings = node?.settings || {};

            if (Array.isArray(settings.texture_groups)) {
                settings.texture_groups.forEach(group => {
                    if (!group?.url) {
                        return;
                    }

                    entries.push({
                        key: `${settings.slot || settings.target_slot || "baseColor"}:${group.url}`,
                        url: group.url,
                        slot: settings.slot || settings.target_slot || "baseColor",
                        faces: group.faces || [],
                        ...normalizeTextureSettings(settings, group),
                    });
                });

                return;
            }

            const nodeKey = settings.node_key || "";

            if (nodeKey === "texture.bitmap" && settings.url) {
                entries.push({
                    key: `${settings.slot || settings.target_slot || "baseColor"}:${settings.url}`,
                    url: settings.url,
                    slot: settings.slot || settings.target_slot || "baseColor",
                    faces: Object.keys(layer?.uv?.faces || {}),
                    ...normalizeTextureSettings(settings),
                });
            }
        });

        Object.entries(layer?.bitmap_maps || {}).forEach(([slotKey, slot]) => {
            if (!VISIBLE_TEXTURE_SLOTS.includes(slotKey)) {
                return;
            }

            if (Array.isArray(slot?.texture_groups)) {
                slot.texture_groups.forEach(group => {
                    if (!group?.url) {
                        return;
                    }

                    entries.push({
                        key: `${slotKey}:${group.url}`,
                        url: group.url,
                        slot: slotKey,
                        faces: group.faces || Object.keys(layer?.uv?.faces || {}),
                        ...normalizeTextureSettings(slot, group),
                    });
                });
                return;
            }

            if (slot?.url) {
                entries.push({
                    key: `${slotKey}:${slot.url}`,
                    url: slot.url,
                    slot: slotKey,
                    faces: Object.keys(layer?.uv?.faces || {}),
                    ...normalizeTextureSettings(slot),
                });
            }
        });

        (layer?.particle_system?.layers || []).forEach(particleLayer => {
            [
                { url: particleLayer?.url, source: particleLayer },
                ...(Array.isArray(particleLayer?.texture_sequence) ? particleLayer.texture_sequence : []),
            ].forEach(sequenceItem => {
                if (!sequenceItem?.url) {
                    return;
                }

                entries.push({
                    key: `particle:${particleLayer.id}:${sequenceItem.url}`,
                    kind: "particle",
                    particleLayerId: particleLayer.id,
                    url: sequenceItem.url,
                    slot: "baseColor",
                    faces: ["front"],
                    ...normalizeTextureSettings(particleLayer),
                });
            });
        });

        return entries;
    };

    const resolveLayerTextureImages = async layer => {
        const materialLayer = resolveMaterialLayer(layer);
        const entries = getLayerTextureEntries(materialLayer);

        const loaded = {};

        await Promise.all(entries.map(async entry => {
            loaded[entry.key] = {
                ...entry,
                image: await createImage(entry.url),
            };
        }));

        return loaded;
    };

    const getCanvas2DTextureForFace = (layer, faceName) => {
        const faceUv = layer?.uv?.faces?.[faceName];

        if (
            faceUv?.bitmap?.url &&
            textureImages[faceUv.bitmap.url]?.image &&
            CANVAS2D_TEXTURE_SLOTS.includes(textureImages[faceUv.bitmap.url].slot)
        ) {
            return {
                ...textureImages[faceUv.bitmap.url],
                ...normalizeTextureSettings(textureImages[faceUv.bitmap.url], faceUv.bitmap),
            };
        }

        const mapped = Object.values(textureImages).find(item => (
            item.image &&
            CANVAS2D_TEXTURE_SLOTS.includes(item.slot) &&
            Array.isArray(item.faces) &&
            item.faces.includes(faceName)
        ));

        return mapped || Object.values(textureImages).find(item => item.image && CANVAS2D_TEXTURE_SLOTS.includes(item.slot)) || null;
    };

    const getTextureForFace = (layer, faceName) => {
        const faceUv = layer?.uv?.faces?.[faceName];

        if (faceUv?.bitmap?.url && textureImages[faceUv.bitmap.url]?.image) {
            return {
                ...textureImages[faceUv.bitmap.url],
                ...normalizeTextureSettings(textureImages[faceUv.bitmap.url], faceUv.bitmap),
            };
        }

        const mapped = Object.values(textureImages).find(item => (
            item.image &&
            MATERIAL_TEXTURE_SLOTS.includes(item.slot) &&
            Array.isArray(item.faces) &&
            item.faces.includes(faceName)
        ));

        return mapped || Object.values(textureImages).find(item => item.image && MATERIAL_TEXTURE_SLOTS.includes(item.slot)) || null;
    };

    const getAlphaTextureForFace = (_layer, faceName) => {
        const mapped = Object.values(textureImages).find(item => (
            item.image &&
            ALPHA_TEXTURE_SLOTS.includes(item.slot) &&
            Array.isArray(item.faces) &&
            item.faces.includes(faceName)
        ));

        return mapped || Object.values(textureImages).find(item => item.image && ALPHA_TEXTURE_SLOTS.includes(item.slot)) || null;
    };

    const loop = (frameTime = performance.now()) => {
        if (!running) {
            frameId = null;
            return;
        }

        const materialLayer = resolveMaterialLayer(props.layer);

        const hasParticles = particleSystemEnabled(materialLayer);
        const shouldRotate = shouldRotatePreview(materialLayer);
        const shouldRenderCamera = isAnimatorViewport(materialLayer) && hasViewportCamera(materialLayer);

        const shouldAnimate =
            hasParticles ||
            shouldRotate ||
            shouldRenderCamera;

        if (!shouldAnimate) {
            frameId = null;
            return;
        }

        const delta = lastFrameTime
            ? Math.min(Math.max((frameTime - lastFrameTime) / 1000, 0), 0.08)
            : 0;

        lastFrameTime = frameTime;

        const didApplyExportTime = applyDeterministicExportTime(materialLayer);

        if (!didApplyExportTime && hasParticles && !shouldPauseLayerAnimation(materialLayer)) {
            const system = materialLayer.particle_system || {};
            const lifetime = Math.max(0.1, Number(system.lifetime) || 1);
            const speed = Math.max(0, Number(system.time_scale) || 1);

            particleAge = (particleAge + delta * speed) % lifetime;
        }

        if (shouldRotate && !shouldPauseLayerAnimation(materialLayer)) {
            rotation += materialLayer?.preview?.idle_rotation?.speed || 0.006;
        }

        // Wichtig:
        // Auch wenn keine Particles/Rotation laufen, rendert der Animator hier
        // jede Kameraänderung kontinuierlich neu.
        draw();

        if (shouldPauseLayerAnimation(materialLayer) && !shouldRenderCamera) {
            frameId = null;
            running = false;
            return;
        }

        frameId = requestAnimationFrame(loop);
    };

    const init = async () => {
        await nextTick();

        const token = initToken + 1;
        initToken = token;

        stopLoop();

        materialPackage = await loadMaterialPackage(props.layer);

        if (token !== initToken) {
            return;
        }

        textureImages = await resolveLayerTextureImages(props.layer);
        textureSampleCache = {};

        if (token !== initToken) {
            return;
        }

        running = true;

        const materialLayer = resolveMaterialLayer(props.layer);
        const didApplyExportTime = applyDeterministicExportTime(materialLayer);

        if (!didApplyExportTime) {
            particleAge = Number(materialLayer?.particle_system?.age || 0);
        }

        lastFrameTime = performance.now();

        draw();

        const shouldRotate = shouldRotatePreview(materialLayer);
        const shouldRenderCamera = isAnimatorViewport(materialLayer) && hasViewportCamera(materialLayer);

        const shouldAnimate =
            particleSystemEnabled(materialLayer) ||
            shouldRotate ||
            shouldRenderCamera;

        if (shouldAnimate && (!shouldPauseLayerAnimation(materialLayer) || shouldRenderCamera)) {
            frameId = requestAnimationFrame(loop);
        }
    };

    let initTimer = null;

    const requestInit = () => {
        if (initTimer) {
            clearTimeout(initTimer);
        }

        initTimer = setTimeout(async () => {
            initTimer = null;
            await init();
        }, 80);
    };

    watch(
        () => [props.layer?.id,
            props.layer?.time,
            props.layer?.url,
            props.exportState,
            props.pauseWebgl,
            props.layer?.settings?.animator_viewport,
            props.layer?.viewport_camera?.mode,
            props.layer?.settings?.viewport_camera?.mode,
            props.layer?.preview?.viewport_camera?.mode,
            props.layer?.texture?.url,
            props.layer?.texture?.thumbnail,
            props.layer?.texture?.lod_url,
            props.layer?.texture?.texture_size,
            props.layer?.texture?.texture_lod_key,
            props.layer?.settings?.texture_size,
            props.layer?.settings?.render_backend,
            props.layer?.settings?.renderer_mode,
            props.layer?.render_backend,
            props.layer?.texture_size,
            props.layer?.texture_lod_key,
            props.layer?.material_preview_request_id,
            props.layer?.package?.url,
            props.layer?.surface && JSON.stringify(props.layer.surface),
            props.layer?.geometry && JSON.stringify(props.layer.geometry),
            props.layer?.mesh && JSON.stringify(props.layer.mesh),
            props.layer?.particle_system && JSON.stringify(props.layer.particle_system),
            props.layer?.light && JSON.stringify(props.layer.light),
            props.layer?.settings?.light && JSON.stringify(props.layer.settings.light),
            props.layer?.uv && JSON.stringify(props.layer.uv),
            props.layer?.bitmap_maps && JSON.stringify(props.layer.bitmap_maps),
            props.layer?.shader_graph && JSON.stringify(props.layer.shader_graph),
            props.layer?.bitmap_maps?.baseColor?.url,
            props.layer?.preview?.idle_rotation?.enabled,
            props.layer?.preview?.rotate,
            props.layer?.preview?.wireframe,
            props.layer?.preview?.faces,
            props.layer?.preview?.vertices].join("|"),
        () => {
            requestInit();
        }
    );

    onMounted(async () => {
        await init();
    });

    onBeforeUnmount(() => {
        initToken += 1;

        if (initTimer) {
            clearTimeout(initTimer);
            initTimer = null;
        }

        stopLoop();

        if (webglRenderer) {
            webglRenderer.destroy();
            webglRenderer = null;
        }
    });

    return {
        canvasRef,
        webglCanvasRef,
        activeRenderer,
        lightOverlay,
        emitEvent,
    };
}

export const layer3DProps = {
    layer: {
        type: Object,
        required: true,
    },
    hidden: {
        type: [Boolean, Number],
        required: false,
        default: false,
    },
    exportState: {
        type: Boolean,
        required: true,
    },
    pauseWebgl: {
        type: Boolean,
        required: true,
    },
    selected: {
        type: Boolean,
        required: false,
        default: false,
    }
};
