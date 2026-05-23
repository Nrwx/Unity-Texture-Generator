import { brushFalloff, dot3, mul3, normalize3, sub3 } from "./math";

export const flattenModifier = {
    key: "flatten",
    label: "Flatten",
    apply(context) {
        const { vertex, brush, hit } = context;
        const normal = normalize3(hit.normal || vertex.normal, [0, 0, 1]);
        const planeDelta = dot3(sub3(vertex.position, hit.point), normal);
        const amount = brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset) * brush.strength;
        const correction = mul3(normal, planeDelta * amount);

        vertex.position = sub3(vertex.position, correction);
    },
};
