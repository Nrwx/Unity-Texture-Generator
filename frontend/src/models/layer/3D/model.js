import {
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";
import {
    applyCanvasShader,
    createCubeVertices, createImage,
    CUBE_FACES, drawTextureFace,
    faceDepth,
    polygonArea,
    resolvePrincipled
} from "@/view/models/page/material/core/model";

const SURFACE_DEFAULTS = Object.freeze({
    baseColor: [1, 1, 1, 1],
    subsurface: 0,
    subsurfaceRadius: [1, 0.2, 0.1],
    subsurfaceColor: [1, 1, 1, 1],
    metallic: 0,
    specular: 0.5,
    specularTint: 0,
    roughness: 0.4,
    anisotropic: 0,
    anisotropicRotation: 0,
    sheen: 0,
    sheenTint: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.03,
    ior: 1.45,
    transmission: 0,
    transmissionRoughness: 0,
    emission: [0, 0, 0, 1],
    emissionStrength: 0,
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
    specularTint: ["specularTint", "specular_tint"],
    anisotropicRotation: ["anisotropicRotation", "anisotropic_rotation"],
    sheenTint: ["sheenTint", "sheen_tint"],
    clearcoatRoughness: ["clearcoatRoughness", "clearcoat_roughness"],
    transmissionRoughness: ["transmissionRoughness", "transmission_roughness"],
    emissionStrength: ["emissionStrength", "emission_strength"],
    clearcoatNormal: ["clearcoatNormal", "clearcoat_normal"],
    bumpStrength: ["bumpStrength", "bump_strength"],
    displacementStrength: ["displacementStrength", "displacement_strength"],
});

const SURFACE_RANGES = Object.freeze({
    emissionStrength: [0, 20],
    ior: [1, 3],
});

const VISIBLE_TEXTURE_SLOTS = Object.freeze([
    "baseColor",
    "base_color",
    "subsurfaceColor",
    "subsurface_color",
    "emission",
    "emission_color",
]);

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

    let frameId = null;
    let textureImages = {};
    let materialPackage = null;
    let rotation = 0;
    let initToken = 0;
    let running = false;

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const resolveMaterialLayer = layer => {
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
            },
            settings: {
                ...settings,
                ...parsePlainObject(layer?.settings),
            },
        };
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
            const strength = Number(slot.strength ?? 1);
            const offset = Number(slot.offset ?? 0);

            if (Array.isArray(baseValue)) {
                const next = baseValue.slice();

                if (slot.enabled && slot.blend !== "replace") {
                    for (let index = 0; index < 3; index += 1) {
                        const channel = clamp01((Number(next[index] ?? 1) * strength) + offset);
                        next[index] = slot.invert ? 1 - channel : channel;
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
                ? ((slot.invert ? 1 - clamp01(number) : number) * strength) + offset
                : number;

            const range = SURFACE_RANGES[key] || [0, 1];

            resolved[key] = Math.min(Math.max(mapped, range[0]), range[1]);
        });

        return resolved;
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

    const draw = () => {
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
        const surface = normalizeSurface(materialLayer);

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

        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;

        faces.forEach(face => {
            const points = face.points;

            applyCanvasShader(ctx, points, surface, face.shade);

            const faceTexture = getTextureForFace(materialLayer, face.name);

            if (faceTexture?.image) {
                drawTextureFace(
                    ctx,
                    faceTexture.image,
                    face,
                    points,
                    uv,
                    surface.alpha,
                    faceTexture.channel || "rgba"
                );

                ctx.save();

                ctx.beginPath();

                points.forEach((point, index) => {
                    if (index === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                });

                ctx.closePath();
                ctx.clip();

                ctx.globalCompositeOperation = face.shade >= 1 ? "screen" : "multiply";
                ctx.fillStyle = face.shade >= 1
                    ? `rgba(255,255,255,${Math.min((face.shade - 1) * 0.34, 0.38)})`
                    : `rgba(0,0,0,${Math.min((1 - face.shade) * 0.44, 0.52)})`;

                ctx.fill();
                ctx.globalCompositeOperation = "source-over";

                ctx.restore();
            }
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
                    faces: [],
                    channel: bitmap.channel || "rgba",
                });
            }

            uvEntries.get(bitmap.url).faces.push(faceName);
        });

        if (uvEntries.size) {
            return Array.from(uvEntries.values());
        }

        const graphNodes = layer?.shader_graph?.nodes || [];
        const entries = [];

        graphNodes.forEach(node => {
            const settings = node?.settings || {};

            if (Array.isArray(settings.texture_groups)) {
                settings.texture_groups.forEach(group => {
                    if (!group?.url) {
                        return;
                    }

                    entries.push({
                        key: group.url,
                        url: group.url,
                        faces: group.faces || [],
                        channel: group.channel || settings.channel || "rgba",
                    });
                });

                return;
            }

            if (node?.type === "bitmap" && settings.url) {
                entries.push({
                    key: settings.url,
                    url: settings.url,
                    faces: Object.keys(layer?.uv?.faces || {}),
                    channel: settings.channel || "rgba",
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
                        key: group.url,
                        url: group.url,
                        faces: group.faces || Object.keys(layer?.uv?.faces || {}),
                        channel: group.channel || slot.channel || "rgba",
                    });
                });
                return;
            }

            if (slot?.url) {
                entries.push({
                    key: slot.url,
                    url: slot.url,
                    faces: Object.keys(layer?.uv?.faces || {}),
                    channel: slot.channel || "rgba",
                });
            }
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

    const getTextureForFace = (layer, faceName) => {
        const faceUv = layer?.uv?.faces?.[faceName];

        if (faceUv?.bitmap?.url && textureImages[faceUv.bitmap.url]?.image) {
            return {
                ...textureImages[faceUv.bitmap.url],
                channel: faceUv.bitmap.channel || textureImages[faceUv.bitmap.url].channel || "rgba",
            };
        }

        const mapped = Object.values(textureImages).find(item => (
            item.image &&
            Array.isArray(item.faces) &&
            item.faces.includes(faceName)
        ));

        return mapped || Object.values(textureImages).find(item => item.image) || null;
    };

    const loop = () => {
        if (!running) {
            frameId = null;
            return;
        }

        const shouldAnimate =
            props.rotate ||
            resolveMaterialLayer(props.layer)?.preview?.idle_rotation?.enabled ||
            resolveMaterialLayer(props.layer)?.preview?.rotate;

        if (!shouldAnimate) {
            frameId = null;
            return;
        }

        rotation += resolveMaterialLayer(props.layer)?.preview?.idle_rotation?.speed || 0.006;
        draw();

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

        if (token !== initToken) {
            return;
        }

        running = true;

        // wichtig: immer einmal zeichnen, auch ohne Rotation
        draw();

        const shouldAnimate =
            props.rotate ||
            resolveMaterialLayer(props.layer)?.preview?.idle_rotation?.enabled ||
            resolveMaterialLayer(props.layer)?.preview?.rotate;

        if (shouldAnimate) {
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
        () => [
            props.layer?.id,
            props.layer?.time,
            props.layer?.url,
            props.layer?.texture?.url,
            props.layer?.package?.url,
            props.layer?.surface && JSON.stringify(props.layer.surface),
            props.layer?.geometry && JSON.stringify(props.layer.geometry),
            props.layer?.uv && JSON.stringify(props.layer.uv),
            props.layer?.bitmap_maps && JSON.stringify(props.layer.bitmap_maps),
            props.layer?.shader_graph && JSON.stringify(props.layer.shader_graph),
            props.layer?.bitmap_maps?.baseColor?.url,
            props.rotate,
            props.layer?.preview?.idle_rotation?.enabled,
            props.layer?.preview?.rotate,
        ].join("|"),
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
    });

    return {
        canvasRef,
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
    selected: {
        type: Boolean,
        required: false,
        default: false,
    },
    rotate: {
        type: Boolean,
        required: false,
        default: false,
    },
};
