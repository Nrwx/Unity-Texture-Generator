import { brushFalloff, dot3, mul3, normalize3, sub3 } from "./math";

export const scrapeModifier = {
    key: "scrape",
    label: "Scrape / Peaks",
    apply(context) {
        const { vertex, brush, hit } = context;
        const normal = normalize3(hit.normal || vertex.normal, [0, 0, 1]);
        const planeDelta = dot3(sub3(vertex.position, hit.point), normal);
        const falloff = brushFalloff(vertex.distance, brush.radius, brush.softness * 0.55, brush.falloffOffset);
        const scrape = Math.max(0, planeDelta) * falloff * Math.min(1, brush.strength * 3.5);
        vertex.position = sub3(vertex.position, mul3(normal, scrape));
    },
};
