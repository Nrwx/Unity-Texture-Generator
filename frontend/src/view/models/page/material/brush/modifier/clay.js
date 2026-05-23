import { add3, brushFalloff, dot3, mul3, normalize3, sub3 } from "./math";

export const clayModifier = {
    key: "clay",
    label: "Clay / Layer",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const normal = normalize3(hit.normal || vertex.normal, [0, 0, 1]);
        const planeDelta = dot3(sub3(vertex.position, hit.point), normal);
        const falloff = brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset);
        const layerLimit = Math.max(0.002, brush.strength * 1.8);
        const amount = Math.max(-layerLimit, Math.min(layerLimit, brush.strength - Math.abs(planeDelta))) * falloff * direction;
        vertex.position = add3(vertex.position, mul3(normal, amount));
    },
};
