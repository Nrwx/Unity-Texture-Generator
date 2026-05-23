import { brushFalloff, mix3 } from "./math";

export const pinchModifier = {
    key: "pinch",
    label: "Pinch",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const amount = brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset) * brush.strength;

        vertex.position = direction >= 0
            ? mix3(vertex.position, hit.point, amount)
            : mix3(vertex.position, vertex.original, -amount);
    },
};
