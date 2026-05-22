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

export function layer3DModel(props, emit) {
    const canvasRef = ref(null);

    let frameId = null;
    let textureImages = {};
    let rotation = 0;
    let initToken = 0;
    let running = false;

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const isMaterialConnected = layer => {
        const graph =
            layer?.shader_graph ||
            layer?.shader?.graph ||
            {};

        const edges = graph?.edges || [];

        return edges.some(edge => (
            edge?.from?.node === "principled-bsdf" &&
            edge?.from?.socket === "bsdf" &&
            edge?.to?.node === "material-output" &&
            edge?.to?.socket === "surface"
        ));
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

        const surface = resolvePrincipled(
            props.layer?.surface ||
            props.layer?.material ||
            {}
        );

        const uv = props.layer?.uv || {};

        const vertices = createCubeVertices(width, height, rotation, props.layer?.geometry || {});

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

            const faceTexture = getTextureForFace(props.layer, face.name);

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

        const graphNodes = layer?.shader_graph?.nodes || layer?.shader?.graph?.nodes || [];
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

        Object.values(layer?.bitmap_maps || {}).forEach(slot => {
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
        const entries = getLayerTextureEntries(layer);

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
            props.layer?.preview?.idle_rotation?.enabled;

        if (!shouldAnimate) {
            frameId = null;
            return;
        }

        rotation += props.layer?.preview?.idle_rotation?.speed || 0.006;
        draw();

        frameId = requestAnimationFrame(loop);
    };

    const init = async () => {
        await nextTick();

        const token = initToken + 1;
        initToken = token;

        stopLoop();

        textureImages = await resolveLayerTextureImages(props.layer);

        if (token !== initToken) {
            return;
        }

        running = true;

        // wichtig: immer einmal zeichnen, auch ohne Rotation
        draw();

        const shouldAnimate =
            props.rotate ||
            props.layer?.preview?.idle_rotation?.enabled;

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
            props.layer?.bitmap_maps?.baseColor?.url,
            props.rotate,
            props.layer?.preview?.idle_rotation?.enabled,
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
