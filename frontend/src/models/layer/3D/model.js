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
    resolvePrincipled, resolveTextureUrl
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

        const surface = resolvePrincipled(
            props.layer?.surface ||
            props.layer?.material ||
            {}
        );

        const uv = props.layer?.uv || {};

        const vertices = createCubeVertices(width, height, rotation);

        const faces = [...CUBE_FACES]
            .map(face => ({
                ...face,
                points: face.indices.map(index => vertices[index]),
                depth: faceDepth(face, vertices),
            }))
            .filter(face => polygonArea(face.points) > 0)
            .sort((a, b) => a.depth - b.depth);

        ctx.save();

        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;

        faces.forEach(face => {
            const points = face.points;

            applyCanvasShader(ctx, points, surface, face.shade);

            const faceTextureImage = getTextureImageForFace(props.layer, face.name);

            if (faceTextureImage) {
                drawTextureFace(
                    ctx,
                    faceTextureImage,
                    face,
                    points,
                    uv,
                    surface.alpha
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

    const resolveLayerTextureImages = async layer => {
        const baseMap = layer?.bitmap_maps?.baseColor;
        const uv = layer?.uv || {};

        const entries = [];

        if (baseMap?.source_type === "multitexture") {
            (baseMap.texture_groups || []).forEach(group => {
                entries.push({
                    key: group.url,
                    url: group.url,
                    faces: group.faces || [],
                });
            });
        } else if (baseMap?.source_type === "single" && baseMap.url) {
            entries.push({
                key: baseMap.url,
                url: baseMap.url,
                faces: Object.keys(uv.faces || {}),
            });
        } else {
            const fallback = resolveTextureUrl(layer);

            if (fallback) {
                entries.push({
                    key: fallback,
                    url: fallback,
                    faces: Object.keys(uv.faces || {}),
                });
            }
        }

        const loaded = {};

        await Promise.all(entries.map(async entry => {
            loaded[entry.key] = {
                ...entry,
                image: await createImage(entry.url),
            };
        }));

        return loaded;
    };

    const getTextureImageForFace = (layer, faceName) => {
        const baseMap = layer?.bitmap_maps?.baseColor;
        const faceUv = layer?.uv?.faces?.[faceName];

        if (faceUv?.bitmap?.url && textureImages[faceUv.bitmap.url]?.image) {
            return textureImages[faceUv.bitmap.url].image;
        }

        if (baseMap?.source_type === "multitexture") {
            const group = (baseMap.texture_groups || []).find(item => (
                Array.isArray(item.faces) && item.faces.includes(faceName)
            ));

            if (group?.url && textureImages[group.url]?.image) {
                return textureImages[group.url].image;
            }
        }

        if (baseMap?.url && textureImages[baseMap.url]?.image) {
            return textureImages[baseMap.url].image;
        }

        const first = Object.values(textureImages).find(item => item.image);

        return first?.image || null;
    };

    const loop = () => {
        if (!running) {
            return;
        }

        if (props.rotate || props.layer?.preview?.idle_rotation?.enabled) {
            rotation += props.layer?.preview?.idle_rotation?.speed || 0.006;
        }

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
        loop();
    };

    watch(
        () => [
            props.layer?.id,
            props.layer?.url,
            props.layer?.texture?.url,
            props.layer?.bitmap_maps?.baseColor?.url,
            JSON.stringify(props.layer?.surface || {}),
            JSON.stringify(props.layer?.bitmap_maps || {}),
            JSON.stringify(props.layer?.uv || {}),
            JSON.stringify(props.layer?.shader_graph || {}),
            props.rotate,
        ].join("|"),
        async () => {
            await init();
        }
    );

    onMounted(async () => {
        await init();
    });

    onBeforeUnmount(() => {
        initToken += 1;
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