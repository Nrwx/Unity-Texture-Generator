import {isFiniteNumber, number} from "@/utils/math";

const clamp = (value, min = 0, max = 1) => {
    const n = number(value);

    if (!isFiniteNumber(n)) {
        return min;
    }

    return Math.min(Math.max(n, min), max);
};

export const CUBE_FACE_NAMES = [
    "front",
    "back",
    "left",
    "right",
    "top",
    "bottom",
];

export const CUBE_FACES = [
    { name: "back", indices: [0, 1, 2, 3], shade: 0.66 },
    { name: "front", indices: [4, 5, 6, 7], shade: 1.04 },
    { name: "bottom", indices: [0, 4, 5, 1], shade: 0.7 },
    { name: "top", indices: [3, 2, 6, 7], shade: 1.18 },
    { name: "right", indices: [1, 5, 6, 2], shade: 0.94 },
    { name: "left", indices: [0, 3, 7, 4], shade: 0.78 },
];

export const createImage = (src) => {
    return new Promise(resolve => {
        if (!src) {
            resolve(null);
            return;
        }

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
};

export const resolveTextureUrl = layer => {
    return (
        layer?.texture?.url ||
        layer?.url ||
        layer?.svg ||
        ""
    );
};

export const resolvePrincipled = material => {
    const surface = material?.surface || material?.principled_bsdf || material || {};

    return {
        baseColor: surface.baseColor || surface.base_color || [1, 1, 1, 1],
        subsurface: surface.subsurface ?? 0,
        subsurfaceRadius: surface.subsurfaceRadius || surface.subsurface_radius || [1, 0.2, 0.1],
        subsurfaceColor: surface.subsurfaceColor || surface.subsurface_color || [1, 1, 1, 1],

        metallic: surface.metallic ?? 0,
        specular: surface.specular ?? 0.5,
        specularTint: surface.specularTint ?? surface.specular_tint ?? 0,
        roughness: surface.roughness ?? 0.4,

        anisotropic: surface.anisotropic ?? 0,
        anisotropicRotation: surface.anisotropicRotation ?? surface.anisotropic_rotation ?? 0,

        sheen: surface.sheen ?? 0,
        sheenTint: surface.sheenTint ?? surface.sheen_tint ?? 0.5,

        clearcoat: surface.clearcoat ?? 0,
        clearcoatRoughness: surface.clearcoatRoughness ?? surface.clearcoat_roughness ?? 0.03,

        ior: surface.ior ?? 1.45,
        transmission: surface.transmission ?? 0,
        transmissionRoughness: surface.transmissionRoughness ?? surface.transmission_roughness ?? 0,

        emission: surface.emission || surface.emission_color || [0, 0, 0, 1],
        emissionStrength: surface.emissionStrength ?? surface.emission_strength ?? 0,

        alpha: surface.alpha ?? 1,

        normal: surface.normal ?? 0,
        clearcoatNormal: surface.clearcoatNormal ?? surface.clearcoat_normal ?? 0,
        tangent: surface.tangent ?? 0,

        bumpStrength: surface.bumpStrength ?? surface.bump_strength ?? 0,
        displacementStrength: surface.displacementStrength ?? surface.displacement_strength ?? 0,
    };
};

export const createCubeVertices = (width, height, rotation = 0, geometry = {}) => {
    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height) * 0.264;

    const toRadians = value => (number(value || 0) * Math.PI) / 180;
    const maxDimension = Math.max(
        Math.abs(number(geometry.width || 1)),
        Math.abs(number(geometry.height || 1)),
        Math.abs(number(geometry.depth || 1)),
        0.001
    );

    const geometryScale = [
        (number(geometry.width || 1) * number(geometry.scale_x || 1)) / maxDimension,
        (number(geometry.height || 1) * Number(geometry.scale_y || 1)) / maxDimension,
        (number(geometry.depth || 1) * number(geometry.scale_z || 1)) / maxDimension,
    ];
    const pivot = [
        number(geometry.pivot_x || 0) / maxDimension,
        number(geometry.pivot_y || 0) / maxDimension,
        number(geometry.pivot_z || 0) / maxDimension,
    ];

    const yaw = rotation + toRadians(geometry.rotation_y);
    const pitch = -0.34 + toRadians(geometry.rotation_x);
    const roll = toRadians(geometry.rotation_z);

    const vertices3d = [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1],
    ];

    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const sinX = Math.sin(pitch);
    const cosX = Math.cos(pitch);
    const sinZ = Math.sin(roll);
    const cosZ = Math.cos(roll);

    return vertices3d.map(([x, y, z]) => {
        x *= geometryScale[0];
        y *= geometryScale[1];
        z *= geometryScale[2];

        x -= pivot[0];
        y -= pivot[1];
        z -= pivot[2];

        let rx = x * cosY - z * sinY;
        let rz = x * sinY + z * cosY;
        let ry = y;

        const ry2 = ry * cosX - rz * sinX;
        const rz2 = ry * sinX + rz * cosX;

        ry = ry2;
        rz = rz2;

        const rx2 = rx * cosZ - ry * sinZ;
        const ry3 = rx * sinZ + ry * cosZ;

        rx = rx2;
        ry = ry3;

        const perspective = 3.25 / (3.25 + rz * 0.26);

        return {
            x: cx + rx * size * perspective,
            y: cy + ry * size * perspective,
            z: rz,
        };
    });
};

export const faceDepth = (face, vertices) => {
    return face.indices.reduce((sum, index) => {
        return sum + vertices[index].z;
    }, 0) / face.indices.length;
};

export const polygonArea = points => {
    let area = 0;

    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];

        area += current.x * next.y - next.x * current.y;
    }

    return area / 2;
};

export const rgbToCss = (array, alpha = 1) => {
    const r = Math.round(clamp(array?.[0] ?? 1, 0, 1) * 255);
    const g = Math.round(clamp(array?.[1] ?? 1, 0, 1) * 255);
    const b = Math.round(clamp(array?.[2] ?? 1, 0, 1) * 255);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const applyCanvasShader = (ctx, points, surface, shade = 1, light = {}) => {
    const alpha = clamp(surface.alpha ?? 1, 0, 1);
    const metallic = clamp(surface.metallic ?? 0, 0, 1);
    const roughness = clamp(surface.roughness ?? 0.4, 0, 1);
    const specular = clamp(surface.specular ?? 0.5, 0, 1);
    const specularTint = clamp(surface.specularTint ?? 0, 0, 1);
    const subsurface = clamp(surface.subsurface ?? 0, 0, 1);
    const anisotropic = clamp(surface.anisotropic ?? 0, 0, 1);
    const anisotropicRotation = clamp(surface.anisotropicRotation ?? 0, 0, 1);
    const sheen = clamp(surface.sheen ?? 0, 0, 1);
    const sheenTint = clamp(surface.sheenTint ?? 0.5, 0, 1);
    const clearcoat = clamp(surface.clearcoat ?? 0, 0, 1);
    const clearcoatRoughness = clamp(surface.clearcoatRoughness ?? 0.03, 0, 1);
    const ior = clamp((Number(surface.ior ?? 1.45) - 1) / 2, 0, 1);
    const transmission = clamp(surface.transmission ?? 0, 0, 1);
    const transmissionRoughness = clamp(surface.transmissionRoughness ?? 0, 0, 1);
    const normal = clamp(surface.normal ?? 0, 0, 1);
    const clearcoatNormal = clamp(surface.clearcoatNormal ?? 0, 0, 1);
    const tangent = clamp(surface.tangent ?? 0, 0, 1);
    const bumpStrength = clamp(surface.bumpStrength ?? 0, 0, 1);
    const displacementStrength = clamp(surface.displacementStrength ?? 0, 0, 1);
    const emissionStrength = clamp(surface.emissionStrength ?? 0, 0, 20);
    const baseColor = surface.baseColor || [1, 1, 1, 1];
    const subsurfaceColor = surface.subsurfaceColor || [1, 1, 1, 1];
    const lightSoftness = clamp(light.softness ?? 0.32, 0, 1);

    const specularBoost = 1 + metallic * 0.22 + specular * 0.18 + clearcoat * 0.24 + ior * 0.08;
    const roughnessDamping = 1 - roughness * 0.24 - transmissionRoughness * transmission * 0.12;
    const subsurfaceLift = 1 + subsurface * (1 - Math.abs(1 - shade)) * 0.18;
    const lightFactor = (shade * (1 - lightSoftness * 0.18) + lightSoftness * 0.18) * specularBoost * roughnessDamping * subsurfaceLift;

    const materialColor = [
        baseColor[0] * (1 - subsurface) + subsurfaceColor[0] * subsurface,
        baseColor[1] * (1 - subsurface) + subsurfaceColor[1] * subsurface,
        baseColor[2] * (1 - subsurface) + subsurfaceColor[2] * subsurface,
    ];

    const shaded = [
        clamp(materialColor[0] * lightFactor + transmission * 0.08, 0, 1),
        clamp(materialColor[1] * lightFactor + transmission * 0.10, 0, 1),
        clamp(materialColor[2] * lightFactor + transmission * 0.12, 0, 1),
    ];

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
    ctx.fillStyle = rgbToCss(shaded, alpha * (1 - transmission * 0.45));
    ctx.fill();

    if (metallic > 0.01 || clearcoat > 0.01 || anisotropic > 0.01 || specular > 0.01) {
        const bounds = points.reduce(
            (acc, point) => ({
                minX: Math.min(acc.minX, point.x),
                minY: Math.min(acc.minY, point.y),
                maxX: Math.max(acc.maxX, point.x),
                maxY: Math.max(acc.maxY, point.y),
            }),
            {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity,
            }
        );

        const spanX = bounds.maxX - bounds.minX;
        const spanY = bounds.maxY - bounds.minY;
        const angle = anisotropicRotation * Math.PI * 2;
        const gradient = ctx.createLinearGradient(
            bounds.minX + spanX * 0.5 - Math.cos(angle) * spanX * 0.5,
            bounds.minY + spanY * 0.5 - Math.sin(angle) * spanY * 0.5,
            bounds.minX + spanX * 0.5 + Math.cos(angle) * spanX * 0.5,
            bounds.minY + spanY * 0.5 + Math.sin(angle) * spanY * 0.5
        );

        const highlightAlpha = 0.05 + metallic * 0.14 + specular * 0.06 + clearcoat * (0.22 - clearcoatRoughness * 0.12) + anisotropic * 0.10;
        const tint = specularTint > 0
            ? [
                Math.round((255 * (1 - specularTint)) + (baseColor[0] * 255 * specularTint)),
                Math.round((255 * (1 - specularTint)) + (baseColor[1] * 255 * specularTint)),
                Math.round((255 * (1 - specularTint)) + (baseColor[2] * 255 * specularTint)),
            ]
            : [255, 255, 255];

        gradient.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${highlightAlpha})`);
        gradient.addColorStop(0.5, "rgba(255,255,255,0)");
        gradient.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},${highlightAlpha * 0.52})`);

        ctx.fillStyle = gradient;
        ctx.fill();
    }

    if (sheen > 0.01 || transmission > 0.01) {
        const sheenColor = [
            Math.round((255 * (1 - sheenTint)) + (baseColor[0] * 255 * sheenTint)),
            Math.round((255 * (1 - sheenTint)) + (baseColor[1] * 255 * sheenTint)),
            Math.round((255 * (1 - sheenTint)) + (baseColor[2] * 255 * sheenTint)),
        ];

        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(${sheenColor[0]}, ${sheenColor[1]}, ${sheenColor[2]}, ${sheen * 0.10 + transmission * 0.08})`;
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
    }

    if (emissionStrength > 0) {
        const emission = surface.emission || [0, 0, 0, 1];
        const power = Math.min(emissionStrength / 20, 1);

        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(${emission[0] * 255}, ${emission[1] * 255}, ${emission[2] * 255}, ${power * 0.25})`;
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
    }

    if (normal > 0.01 || clearcoatNormal > 0.01 || tangent > 0.01 || bumpStrength > 0.01 || displacementStrength > 0.01) {
        const textureAlpha =
            normal * 0.06 +
            clearcoatNormal * 0.045 +
            tangent * 0.025 +
            bumpStrength * 0.11 +
            displacementStrength * 0.13;

        ctx.globalCompositeOperation = "overlay";
        ctx.strokeStyle = `rgba(255,255,255,${textureAlpha})`;
        ctx.lineWidth = 1;

        for (let index = 1; index <= 3; index += 1) {
            const t = index / 4;
            const left = {
                x: points[0].x + (points[3].x - points[0].x) * t,
                y: points[0].y + (points[3].y - points[0].y) * t,
            };
            const right = {
                x: points[1].x + (points[2].x - points[1].x) * t,
                y: points[1].y + (points[2].y - points[1].y) * t,
            };

            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(right.x, right.y);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = "source-over";
    }

    ctx.strokeStyle = `rgba(255,255,255,${0.18 + clearcoat * 0.12})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
};

export const getFaceUv = (uv, faceName) => {
    return uv?.faces?.[faceName] || {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        translate_x: 0,
        translate_y: 0,
        scale_x: 1,
        scale_y: 1,
        rotate: 0,
        flip_x: false,
        flip_y: false,
    };
};

const resolveTextureSettings = (channelOrSettings = "rgba") => {
    if (typeof channelOrSettings === "object") {
        return {
            channel: ["rgb", "rgba"].includes(channelOrSettings.channel) ? channelOrSettings.channel : "rgba",
            color_mode: ["color", "bw"].includes(channelOrSettings.color_mode) ? channelOrSettings.color_mode : "color",
            alpha_mode: ["OPAQUE", "BLEND", "HASHED", "CLIP"].includes(channelOrSettings.alpha_mode) ? channelOrSettings.alpha_mode : "BLEND",
            alpha_clip: clamp(channelOrSettings.alpha_clip ?? 0.5, 0, 1),
            mask_composite: channelOrSettings.mask_composite === true,
            mask_only: channelOrSettings.mask_only === true,
        };
    }

    return {
        channel: ["rgb", "rgba"].includes(channelOrSettings) ? channelOrSettings : "rgba",
        color_mode: "color",
        alpha_mode: channelOrSettings === "rgb" ? "OPAQUE" : "BLEND",
        alpha_clip: 0.5,
        mask_composite: false,
        mask_only: false,
    };
};

const createTextureCanvas = (image, sx, sy, sw, sh, settings) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
        return null;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let index = 0; index < data.length; index += 4) {
        if (settings.color_mode === "bw") {
            const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
            data[index] = gray;
            data[index + 1] = gray;
            data[index + 2] = gray;
        }

        if (settings.channel === "rgb" || settings.alpha_mode === "OPAQUE") {
            data[index + 3] = 255;
            continue;
        }

        if (settings.alpha_mode === "CLIP") {
            data[index + 3] = data[index + 3] / 255 >= settings.alpha_clip ? 255 : 0;
            continue;
        }

        if (settings.alpha_mode === "HASHED") {
            const pixel = index / 4;
            const x = pixel % canvas.width;
            const y = Math.floor(pixel / canvas.width);
            const threshold = (((x * 13 + y * 17) % 16) + 0.5) / 16;
            data[index + 3] = data[index + 3] / 255 >= threshold ? 255 : 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
};

export const drawTextureFace = (ctx, image, face, points, uv, alpha = 1, channelOrSettings = "rgba") => {
    if (!image) {
        return;
    }

    const settings = resolveTextureSettings(channelOrSettings);
    const [p0, p1, , p3] = points;
    const faceUv = getFaceUv(uv, face.name);

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;

    const faceOwnsBitmap = Boolean(faceUv.bitmap?.url);
    const sx = faceOwnsBitmap ? 0 : faceUv.x * imageWidth;
    const sy = faceOwnsBitmap ? 0 : faceUv.y * imageHeight;
    const sw = (faceOwnsBitmap ? 1 : faceUv.width) * imageWidth;
    const sh = (faceOwnsBitmap ? 1 : faceUv.height) * imageHeight;

    if (sw <= 0 || sh <= 0) {
        return;
    }

    ctx.save();

    ctx.globalAlpha *= alpha;

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

    ctx.setTransform(
        (p1.x - p0.x) / sw,
        (p1.y - p0.y) / sw,
        (p3.x - p0.x) / sh,
        (p3.y - p0.y) / sh,
        p0.x,
        p0.y
    );

    const tx = faceUv.translate_x * sw;
    const ty = faceUv.translate_y * sh;
    const scaleX = faceUv.flip_x ? -faceUv.scale_x : faceUv.scale_x;
    const scaleY = faceUv.flip_y ? -faceUv.scale_y : faceUv.scale_y;

    ctx.translate(sw / 2, sh / 2);
    ctx.rotate((faceUv.rotate * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-sw / 2 + tx, -sh / 2 + ty);

    if (!settings.mask_only && (settings.channel === "rgb" || settings.alpha_mode === "OPAQUE")) {
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillRect(0, 0, sw, sh);
    }

    const textureCanvas = createTextureCanvas(image, sx, sy, sw, sh, settings);

    if (textureCanvas) {
        if (!settings.mask_only) {
            ctx.drawImage(textureCanvas, 0, 0, sw, sh);
        }

        if (settings.mask_composite === true) {
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(textureCanvas, 0, 0, sw, sh);
            ctx.globalCompositeOperation = "source-over";
        }
    } else {
        if (!settings.mask_only) {
            ctx.drawImage(
                image,
                sx,
                sy,
                sw,
                sh,
                0,
                0,
                sw,
                sh
            );
        }

        if (settings.mask_composite === true) {
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
            ctx.globalCompositeOperation = "source-over";
        }
    }

    ctx.restore();
};
