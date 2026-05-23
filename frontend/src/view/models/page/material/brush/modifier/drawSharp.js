import { add3, brushFalloff, mul3, normalize3 } from "./math";

export const drawSharpModifier = {
    key: "drawSharp",
    label: "Draw Sharp",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const normal = normalize3(vertex.normal, hit.normal || [0, 0, 1]);
        const falloff = Math.pow(brushFalloff(vertex.distance, brush.radius, Math.min(brush.softness, 0.42), brush.falloffOffset), 1.9);
        vertex.position = add3(vertex.position, mul3(normal, brush.strength * direction * falloff * 1.35));
    },
};
