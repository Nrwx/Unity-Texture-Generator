import { add3, brushFalloff, mix3, mul3, normalize3 } from "./math";

export const creaseModifier = {
    key: "crease",
    label: "Crease",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const falloff = brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset);
        const normal = normalize3(hit.normal || vertex.normal, [0, 0, 1]);
        const pull = mix3(vertex.position, hit.point, falloff * brush.strength * 1.75);
        vertex.position = add3(pull, mul3(normal, brush.strength * direction * falloff * 0.42));
    },
};
