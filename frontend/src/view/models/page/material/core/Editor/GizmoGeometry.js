import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";

const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const axisVectors = Object.freeze({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
const planeAxes = Object.freeze({ xy: [[1,0,0],[0,1,0]], xz: [[1,0,0],[0,0,1]], yz: [[0,1,0],[0,0,1]] });
const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const len = a => Math.hypot(a[0], a[1], a[2]);

const sceneToRendererVector = value => {
    const vector = Vector.from(value, [0, 0, 0]);

    return [
        vector.x,
        vector.z,
        vector.y,
    ];
};

const projectPointSource = (point, options = {}) => (
    options.rendererSpace === true
        ? sceneToRendererVector(point)
        : Vector.from(point, [0, 0, 0]).toArray()
);

const pickPointRadius = (point, options = {}) => {
    const extra = Math.max(0, toNumber(options.pointPixelExtra, 2));

    if (Number.isFinite(Number(point?.screenRadius))) {
        return Math.max(0, Number(point.screenRadius)) + extra;
    }

    const id = String(point?.id || "");

    if (id.includes("scale")) {
        return 7.5 + extra;
    }

    if (id.includes("translate")) {
        return 6.75 + extra;
    }

    if (id.includes("pivot")) {
        return 5.5 + extra;
    }

    return Math.max(4, toNumber(options.pointPixelThreshold, 6)) + extra;
};

const isFiniteNumber = value => Number.isFinite(Number(value));

const projectToViewport = (camera, point, viewport = { width: 1, height: 1 }, options = {}) => {
    const matrixSource = camera?.viewProjectionMatrix || camera?.viewProj || camera?.matrix;

    if (!matrixSource) {
        return null;
    }

    const matrix = matrixSource instanceof Matrix
        ? matrixSource
        : Matrix.from(matrixSource);
    const source = projectPointSource(point, options);
    const ndc = matrix.transformPoint(source, 1);
    const w = isFiniteNumber(ndc.w) && Math.abs(Number(ndc.w)) > 1e-7
        ? Number(ndc.w)
        : 1;
    const xNdc = Number(ndc.x) / w;
    const yNdc = Number(ndc.y) / w;

    if (!Number.isFinite(xNdc) || !Number.isFinite(yNdc)) {
        return null;
    }

    return {
        x: (xNdc * 0.5 + 0.5) * Math.max(1, viewport.width),
        y: (1 - (yNdc * 0.5 + 0.5)) * Math.max(1, viewport.height),
        z: Number(ndc.z || 0) / w,
    };
};

const distanceToScreenSegment = (point, a, b) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;

    if (lenSq <= 1e-7) {
        return {
            distance: Math.hypot(point.x - a.x, point.y - a.y),
            t: 0,
        };
    }

    const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lenSq));
    const x = a.x + abx * t;
    const y = a.y + aby * t;

    return {
        distance: Math.hypot(point.x - x, point.y - y),
        t,
    };
};

const pointInScreenPolygon = (point, polygon = []) => {
    if (polygon.length < 3) {
        return false;
    }

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const pi = polygon[i];
        const pj = polygon[j];
        const intersects = ((pi.y > point.y) !== (pj.y > point.y)) &&
            (point.x < ((pj.x - pi.x) * (point.y - pi.y)) / Math.max(1e-7, pj.y - pi.y) + pi.x);

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
};

const lerp3 = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

const pointToArray = value => ([
    toNumber(value?.x ?? value?.[0], 0),
    toNumber(value?.y ?? value?.[1], 0),
    toNumber(value?.z ?? value?.[2], 0),
]);

export class GizmoGeometry {
    static originFromGeometry(geometry = {}) {
        return [
            toNumber(geometry.position_x, 0) + toNumber(geometry.pivot_x, 0),
            toNumber(geometry.position_y, 0) + toNumber(geometry.pivot_y, 0),
            toNumber(geometry.position_z, 0) + toNumber(geometry.pivot_z, 0),
        ];
    }

    static sizeFromGeometry(geometry = {}, fallback = 0.85) {
        const sx = Math.abs(toNumber(geometry.width, 1) * toNumber(geometry.scale_x, 1));
        const sy = Math.abs(toNumber(geometry.height, 1) * toNumber(geometry.scale_y, 1));
        const sz = Math.abs(toNumber(geometry.depth, 1) * toNumber(geometry.scale_z, 1));
        const maxDim = Math.max(sx, sy, sz, 0.25);
        return Math.max(0.18, Math.min(0.92, maxDim * 0.48 || fallback));
    }

    static build({
        geometry = {},
        origin = null,
        size = null,
        tool = "translate",
        renderPlaneHandles = false,
        showAxisHandles = true,
        showRotateRings = true,
        showScaleHandles = true,
        showPivot = true,
        showAxisGuide = false,
        activeAxis = "free",
    } = {}) {
        const resolvedOrigin = origin ? pointToArray(origin) : GizmoGeometry.originFromGeometry(geometry);
        const resolvedSize = Math.max(0.16, Math.min(0.92, toNumber(size, GizmoGeometry.sizeFromGeometry(geometry))));
        const lines = [];
        const planes = [];
        const rings = [];
        const points = [];
        const pushLine = (a, b, color, id, axis, lineTool = "translate", width = 1) => lines.push({ a, b, color, id, axis, tool: lineTool, width });
        const activeTool = String(tool || "translate").toLowerCase();

        if (showAxisHandles !== false && (activeTool === "translate" || activeTool === "pivot")) {
            Object.entries(axisVectors).forEach(([axis, dir]) => {
                const tip = add(resolvedOrigin, mul(dir, resolvedSize));
                pushLine(resolvedOrigin, tip, axis === "x" ? [1,0.15,0.13,1] : axis === "y" ? [0.25,1,0.45,1] : [0.35,0.58,1,1], `translate:${axis}`, axis, "translate", 1.65);
                points.push({ id: `translate-tip:${axis}`, axis, tool: "translate", point: tip, radius: Math.max(resolvedSize * 0.26, 0.16) });
            });
        }

        if (renderPlaneHandles === true && activeTool === "translate") {
            Object.entries(planeAxes).forEach(([axis, [u, v]]) => {
                const s = resolvedSize * 0.26;
                const p0 = add(resolvedOrigin, add(mul(u, s), mul(v, s)));
                const p1 = add(resolvedOrigin, add(mul(u, s * 1.7), mul(v, s)));
                const p2 = add(resolvedOrigin, add(mul(u, s * 1.7), mul(v, s * 1.7)));
                const p3 = add(resolvedOrigin, add(mul(u, s), mul(v, s * 1.7)));
                planes.push({ id: `plane:${axis}`, axis, tool: "translate", points: [p0, p1, p2, p3] });
                pushLine(p0, p1, [1,1,1,0.45], `plane-line:${axis}:0`, axis, "translate", 1);
                pushLine(p1, p2, [1,1,1,0.45], `plane-line:${axis}:1`, axis, "translate", 1);
                pushLine(p2, p3, [1,1,1,0.45], `plane-line:${axis}:2`, axis, "translate", 1);
                pushLine(p3, p0, [1,1,1,0.45], `plane-line:${axis}:3`, axis, "translate", 1);
            });
        }

        if (showRotateRings !== false && activeTool === "rotate") {
            ["x", "y", "z"].forEach(axis => {
                rings.push({ id: `rotate:${axis}`, axis, tool: "rotate", origin: resolvedOrigin, normal: axisVectors[axis], radius: resolvedSize * 0.88 });
            });
        }

        if (showScaleHandles !== false && activeTool === "scale") {
            Object.entries(axisVectors).forEach(([axis, dir]) => {
                const tip = add(resolvedOrigin, mul(dir, resolvedSize * 0.82));
                pushLine(resolvedOrigin, tip, axis === "x" ? [1,0.15,0.13,1] : axis === "y" ? [0.25,1,0.45,1] : [0.35,0.58,1,1], `scale:${axis}`, axis, "scale", 1.55);
                points.push({ id: `scale-box:${axis}`, axis, tool: "scale", point: tip, radius: Math.max(resolvedSize * 0.28, 0.16) });
            });
            points.push({ id: "scale:free", axis: "free", tool: "scale", point: add(resolvedOrigin, [resolvedSize * 0.32, resolvedSize * 0.32, resolvedSize * 0.32]), radius: Math.max(resolvedSize * 0.26, 0.15) });
        }

        if (showPivot !== false) {
            points.push({ id: "pivot:free", axis: "free", tool: "pivot", point: resolvedOrigin, radius: Math.max(resolvedSize * 0.24, 0.14) });
        }

        if (showAxisGuide && activeAxis && activeAxis !== "free" && axisVectors[activeAxis]) {
            const dir = axisVectors[activeAxis];
            const guide = resolvedSize * 3.0;
            pushLine(add(resolvedOrigin, mul(dir, -guide)), add(resolvedOrigin, mul(dir, guide)), [1, 1, 1, 0.32], `axis-guide:${activeAxis}`, activeAxis, "guide", 0.7);
        }

        return { origin: resolvedOrigin, size: resolvedSize, lines, planes, rings, points };
    }

    static pick(ray, gizmo, threshold = 0.16, options = {}) {
        const screenHit = GizmoGeometry.pickScreen(gizmo, options);

        if (screenHit) {
            return screenHit;
        }

        if (options.strictScreen === true && options.camera && options.local) {
            return null;
        }

        let best = null;
        const axisThreshold = toNumber(options.axisThreshold, threshold);
        const ringThreshold = toNumber(options.ringThreshold, threshold);
        const pointThreshold = toNumber(options.pointThreshold, threshold);
        const choose = hit => {
            if (!hit) return;
            if (!best || hit.rayDistance < best.rayDistance || (hit.rayDistance === best.rayDistance && hit.distance < best.distance)) best = hit;
        };

        gizmo.points?.forEach(point => {
            const hit = Intersection.raySphere(ray, point.point, point.radius || pointThreshold);
            if (hit) choose({ ...point, type: point.tool === "pivot" ? "pivot" : "handle", distance: 0, rayDistance: hit.distance, hitPoint: hit.point });
        });

        gizmo.lines?.forEach(line => {
            if (line.tool === "guide") return;
            const hit = Intersection.raySegmentDistance(ray, line.a, line.b);
            const tolerance = axisThreshold * (line.width || 1);
            if (hit.distance <= tolerance) choose({ ...line, type: "axis", distance: hit.distance, rayDistance: hit.rayDistance, hitPoint: hit.pointOnSegment });
        });

        gizmo.planes?.forEach(plane => {
            const [a, b, c, d] = plane.points;
            const h0 = Intersection.rayTriangle(ray, a, b, c);
            const h1 = Intersection.rayTriangle(ray, a, c, d);
            const hit = h0 || h1;
            if (hit) choose({ ...plane, type: "plane", distance: 0, rayDistance: hit.distance, hitPoint: hit.point });
        });

        gizmo.rings?.forEach(ring => {
            const planeHit = Intersection.rayPlane(ray, { point: ring.origin, normal: ring.normal });
            if (!planeHit) return;
            const radiusDelta = Math.abs(len(sub(planeHit.point, ring.origin)) - ring.radius);
            if (radiusDelta <= ringThreshold) choose({ ...ring, type: "ring", distance: radiusDelta, rayDistance: planeHit.distance, hitPoint: planeHit.point });
        });

        return best;
    }

    static pickScreen(gizmo, options = {}) {
        const camera = options.camera;
        const viewport = options.viewport || { width: 1, height: 1 };
        const local = options.local;

        if (!camera || !local || !gizmo) {
            return null;
        }

        const pointer = {
            x: toNumber(local.x, 0),
            y: toNumber(local.y, 0),
        };
        let best = null;
        const choose = hit => {
            if (!hit) return;
            if (!best || hit.screenDistance < best.screenDistance) {
                best = hit;
            }
        };
        const axisThreshold = Math.max(0, toNumber(options.axisPixelThreshold, 1.5));
        const ringThreshold = Math.max(0, toNumber(options.ringPixelThreshold, 3));

        gizmo.points?.forEach(point => {
            const screen = projectToViewport(camera, point.point, viewport, options);

            if (!screen) {
                return;
            }

            const radius = pickPointRadius(point, options);
            const distance = Math.hypot(pointer.x - screen.x, pointer.y - screen.y);

            if (distance <= radius) {
                choose({
                    ...point,
                    type: point.tool === "pivot" ? "pivot" : "handle",
                    distance,
                    screenDistance: distance,
                    rayDistance: screen.z,
                    hitPoint: point.point,
                    screenPoint: screen,
                });
            }
        });

        gizmo.lines?.forEach(line => {
            if (line.tool === "guide") {
                return;
            }

            const a = projectToViewport(camera, line.a, viewport, options);
            const b = projectToViewport(camera, line.b, viewport, options);

            if (!a || !b) {
                return;
            }

            const hit = distanceToScreenSegment(pointer, a, b);
            const tolerance = axisThreshold;

            if (hit.distance <= tolerance) {
                choose({
                    ...line,
                    type: "axis",
                    distance: hit.distance,
                    screenDistance: hit.distance,
                    rayDistance: a.z + (b.z - a.z) * hit.t,
                    hitPoint: lerp3(line.a, line.b, hit.t),
                    screenPoint: {
                        x: a.x + (b.x - a.x) * hit.t,
                        y: a.y + (b.y - a.y) * hit.t,
                    },
                });
            }
        });

        gizmo.planes?.forEach(plane => {
            const projected = (plane.points || []).map(point => projectToViewport(camera, point, viewport, options));

            if (projected.some(point => !point)) {
                return;
            }

            const edgeDistance = projected.reduce((distance, point, index) => {
                const next = projected[(index + 1) % projected.length];
                return Math.min(distance, distanceToScreenSegment(pointer, point, next).distance);
            }, Infinity);

            if (pointInScreenPolygon(pointer, projected) || edgeDistance <= Math.max(4, toNumber(options.planePixelInset, 2))) {
                choose({
                    ...plane,
                    type: "plane",
                    distance: edgeDistance,
                    screenDistance: Math.max(0, edgeDistance - 2),
                    rayDistance: projected.reduce((sum, point) => sum + point.z, 0) / projected.length,
                    hitPoint: plane.points[0],
                });
            }
        });

        gizmo.rings?.forEach(ring => {
            const samples = [];
            const steps = 96;
            const normal = ring.axis || "z";

            for (let index = 0; index <= steps; index += 1) {
                const angle = (index / steps) * Math.PI * 2;
                let point;

                if (normal === "x") {
                    point = [ring.origin[0], ring.origin[1] + Math.cos(angle) * ring.radius, ring.origin[2] + Math.sin(angle) * ring.radius];
                } else if (normal === "y") {
                    point = [ring.origin[0] + Math.cos(angle) * ring.radius, ring.origin[1], ring.origin[2] + Math.sin(angle) * ring.radius];
                } else {
                    point = [ring.origin[0] + Math.cos(angle) * ring.radius, ring.origin[1] + Math.sin(angle) * ring.radius, ring.origin[2]];
                }

                const screen = projectToViewport(camera, point, viewport, options);

                if (screen) {
                    samples.push({ point, screen });
                }
            }

            for (let index = 0; index < samples.length - 1; index += 1) {
                const left = samples[index];
                const right = samples[index + 1];
                const hit = distanceToScreenSegment(pointer, left.screen, right.screen);

                if (hit.distance <= ringThreshold) {
                    choose({
                        ...ring,
                        type: "ring",
                        distance: hit.distance,
                        screenDistance: hit.distance,
                        rayDistance: left.screen.z + (right.screen.z - left.screen.z) * hit.t,
                        hitPoint: lerp3(left.point, right.point, hit.t),
                    });
                }
            }
        });

        return best;
    }}
