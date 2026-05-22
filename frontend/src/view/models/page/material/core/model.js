const clamp = (value, min = 0, max = 1) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return min;
    }

    return Math.min(Math.max(number, min), max);
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
    const size = Math.min(width, height) * 0.33;

    const toRadians = value => (Number(value || 0) * Math.PI) / 180;
    const maxDimension = Math.max(
        Math.abs(Number(geometry.width || 1)),
        Math.abs(Number(geometry.height || 1)),
        Math.abs(Number(geometry.depth || 1)),
        0.001
    );

    const geometryScale = [
        (Number(geometry.width || 1) * Number(geometry.scale_x || 1)) / maxDimension,
        (Number(geometry.height || 1) * Number(geometry.scale_y || 1)) / maxDimension,
        (Number(geometry.depth || 1) * Number(geometry.scale_z || 1)) / maxDimension,
    ];

    const yaw = rotation + toRadians(geometry.rotation_y);
    const pitch = -0.55 + Math.sin(rotation * 0.65) * 0.12 + toRadians(geometry.rotation_x);
    const roll = Math.sin(rotation * 0.37) * 0.08 + toRadians(geometry.rotation_z);

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

        const perspective = 2.8 / (2.8 + rz * 0.45);

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

export const applyCanvasShader = (ctx, points, surface, shade = 1) => {
    const alpha = clamp(surface.alpha ?? 1, 0, 1);
    const metallic = clamp(surface.metallic ?? 0, 0, 1);
    const roughness = clamp(surface.roughness ?? 0.4, 0, 1);
    const specular = clamp(surface.specular ?? 0.5, 0, 1);
    const emissionStrength = clamp(surface.emissionStrength ?? 0, 0, 20);
    const baseColor = surface.baseColor || [1, 1, 1, 1];

    const specularBoost = 1 + metallic * 0.22 + specular * 0.08;
    const roughnessDamping = 1 - roughness * 0.22;
    const lightFactor = shade * specularBoost * roughnessDamping;

    const shaded = [
        clamp(baseColor[0] * lightFactor, 0, 1),
        clamp(baseColor[1] * lightFactor, 0, 1),
        clamp(baseColor[2] * lightFactor, 0, 1),
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
    ctx.fillStyle = rgbToCss(shaded, alpha);
    ctx.fill();

    if (metallic > 0.01) {
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

        const gradient = ctx.createLinearGradient(
            bounds.minX,
            bounds.minY,
            bounds.maxX,
            bounds.maxY
        );

        gradient.addColorStop(0, `rgba(255,255,255,${0.08 + metallic * 0.18})`);
        gradient.addColorStop(0.5, "rgba(255,255,255,0)");
        gradient.addColorStop(1, `rgba(255,255,255,${0.04 + metallic * 0.10})`);

        ctx.fillStyle = gradient;
        ctx.fill();
    }

    if (emissionStrength > 0) {
        const emission = surface.emission || [0, 0, 0, 1];
        const power = Math.min(emissionStrength / 20, 1);

        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(${emission[0] * 255}, ${emission[1] * 255}, ${emission[2] * 255}, ${power * 0.25})`;
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
    }

    ctx.strokeStyle = "rgba(255,255,255,0.24)";
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

export const drawTextureFace = (ctx, image, face, points, uv, alpha = 1, channel = "rgba") => {
    if (!image) {
        return;
    }

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

    if (channel === "rgb") {
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillRect(0, 0, sw, sh);
    }

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

    ctx.restore();
};
