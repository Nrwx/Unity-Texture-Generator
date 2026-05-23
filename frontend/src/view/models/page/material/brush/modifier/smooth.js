import { brushFalloff, mix3 } from "./math";

export const smoothModifier = {
    key: "smooth",
    label: "Smooth",
    apply(context) {
        const { vertex, brush, neighbors } = context;
        const list = neighbors.get(vertex.index) || [];

        if (!list.length) {
            return;
        }

        const average = list.reduce(
            (acc, item) => ([acc[0] + item[0] / list.length, acc[1] + item[1] / list.length, acc[2] + item[2] / list.length]),
            [0, 0, 0]
        );
        const amount = brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset) * brush.strength;

        vertex.position = mix3(vertex.position, average, amount);
    },
};
