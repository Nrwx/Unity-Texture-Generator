import { add3, brushFalloff, mul3, normalize3, sub3 } from "./math";

export const blobModifier = {
    key: "blob",
    label: "Blob",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const radial = normalize3(sub3(vertex.position, hit.point), hit.normal || [0, 0, 1]);
        const falloff = Math.pow(brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset), 0.55);
        vertex.position = add3(vertex.position, mul3(radial, brush.strength * direction * falloff));
    },
};
