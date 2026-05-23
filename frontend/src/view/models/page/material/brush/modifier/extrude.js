import { add3, brushFalloff, mul3, normalize3 } from "./math";

export const extrudeModifier = {
    key: "extrude",
    label: "Extrude",
    apply(context) {
        const { vertex, brush, hit } = context;
        const direction = brush.invert === true ? -1 : 1;
        const normal = normalize3(hit.normal || vertex.normal, [0, 0, 1]);
        const ridge = Math.pow(brushFalloff(vertex.distance, brush.radius, brush.softness, brush.falloffOffset), 0.65);
        const amount = brush.strength * direction * ridge;

        vertex.position = add3(vertex.position, mul3(normal, amount));
    },
};
