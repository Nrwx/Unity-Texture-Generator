import { add3, brushFalloff, mul3, normalize3 } from "./math";

export const raiseModifier = {
    key: "raise",
    label: "Draw / Raise",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const normal = normalize3(vertex.normal, hit.normal || [0, 0, 1]);
        const amount = brush.strength * direction * brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset);

        vertex.position = add3(vertex.position, mul3(normal, amount));
    },
};
