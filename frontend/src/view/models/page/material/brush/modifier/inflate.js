import { add3, brushFalloff, mul3, normalize3, sub3 } from "./math";

export const inflateModifier = {
    key: "inflate",
    label: "Inflate / Deflate",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const radial = normalize3(sub3(vertex.position, hit.point), vertex.normal || hit.normal || [0, 0, 1]);
        const amount = brush.strength * direction * brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset);

        vertex.position = add3(vertex.position, mul3(radial, amount));
    },
};
