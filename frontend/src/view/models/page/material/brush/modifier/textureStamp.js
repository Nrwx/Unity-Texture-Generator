import { brushFalloff, clamp } from "./math";

export const textureStampModifier = {
    key: "textureStamp",
    label: "Texture Stamp",
    apply(context) {
        const { mesh, brush, hit } = context;

        if (!mesh.__stampWritten) {
            const uv = Array.isArray(hit.uv)
                ? hit.uv
                : [0.5, 0.5];

            mesh.texture_stamps = Array.isArray(mesh.texture_stamps)
                ? mesh.texture_stamps.slice(-128)
                : [];
            mesh.texture_stamps.push({
                id: `stamp:${Date.now()}:${Math.round(Math.random() * 100000)}`,
                uv: [clamp(uv[0], 0, 1), clamp(uv[1], 0, 1)],
                radius: brush.radius,
                opacity: clamp(brush.opacity ?? brush.strength, 0, 1),
                softness: clamp(brush.softness, 0, 1),
                texture: brush.texture || brush.stampTexture || brush.brushUrl || "",
                mode: brush.textureMode || "alpha",
            });
            mesh.__stampWritten = true;
        }
    },
};

export const stampVertexColor = (vertex, brush) => {
    const opacity = clamp((brush.opacity ?? brush.strength) * brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset), 0, 1);

    return opacity;
};
