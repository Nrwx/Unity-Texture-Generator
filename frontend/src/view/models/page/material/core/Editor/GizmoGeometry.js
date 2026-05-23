import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { sceneToRendererVector } from "@/models/layer/3D/coordinateSystem";

const toNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};
const axisVectors = Object.freeze({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
const planeAxes = Object.freeze({ xy: [[1,0,0],[0,1,0]], xz: [[1,0,0],[0,0,1]], yz: [[0,1,0],[0,0,1]] });
const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
const len = a => Math.hypot(a[0], a[1], a[2]);

const toArray3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        return [
            toNumber(value[0], fallback[0]),
            toNumber(value[1], fallback[1]),
            toNumber(value[2], fallback[2]),
        ];
    }

    if (value && typeof value === "object") {
        const source = value.data || value;

        return [
            toNumber(source.x ?? source[0], fallback[0]),
            toNumber(source.y ?? source[1], fallback[1]),
            toNumber(source.z ?? source[2], fallback[2]),
        ];
    }

    return [fallback[0], fallback[1], fallback[2]];
};

const projectPointSource = (point, rendererSpace = false) => (
    rendererSpace === true
        ? sceneToRendererVector(point)
        : toArray3(point)
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

const createProjector = (camera, viewport = { width: 1, height: 1 }, options = {}) => {
    const matrixSource = camera?.viewProjectionMatrix || camera?.viewProj || camera?.matrix;

    if (!matrixSource) {
        return null;
    }

    const matrix = matrixSource instanceof Matrix
        ? matrixSource
        : Matrix.from(matrixSource);
    const m = matrix.data;
    const width = Math.max(1, viewport.width);
    const height = Math.max(1, viewport.height);
    const rendererSpace = options.rendererSpace === true;

    return point => {
        const source = projectPointSource(point, rendererSpace);
        const x = source[0];
        const y = source[1];
        const z = source[2];
        const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
        const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
        const clipZ = m[2] * x + m[6] * y + m[10] * z + m[14];
        const clipW = m[3] * x + m[7] * y + m[11] * z + m[15];
        const invW = Math.abs(clipW) > 1e-7 ? 1 / clipW : 1;
        const xNdc = clipX * invW;
        const yNdc = clipY * invW;

        if (!Number.isFinite(xNdc) || !Number.isFinite(yNdc)) {
            return null;
        }

        return {
            x: (xNdc * 0.5 + 0.5) * width,
            y: (1 - (yNdc * 0.5 + 0.5)) * height,
            z: clipZ * invW,
        };
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

const ringPoint = (ring, angle) => {
    const origin = ring.origin;
    const radius = ring.radius;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    if ((ring.axis || "z") === "x") {
        return [origin[0], origin[1] + cos * radius, origin[2] + sin * radius];
    }

    if ((ring.axis || "z") === "y") {
        return [origin[0] + cos * radius, origin[1], origin[2] + sin * radius];
    }

    return [origin[0] + cos * radius, origin[1] + sin * radius, origin[2]];
};

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

        for (const point of gizmo.points || []) {
            const hit = Intersection.raySphere(ray, point.point, point.radius || pointThreshold);
            if (hit) choose({ ...point, type: point.tool === "pivot" ? "pivot" : "handle", distance: 0, rayDistance: hit.distance, hitPoint: hit.point });
        }

        for (const line of gizmo.lines || []) {
            if (line.tool === "guide") continue;
            const hit = Intersection.raySegmentDistance(ray, line.a, line.b);
            const tolerance = axisThreshold * (line.width || 1);
            if (hit.distance <= tolerance) choose({ ...line, type: "axis", distance: hit.distance, rayDistance: hit.rayDistance, hitPoint: hit.pointOnSegment });
        }

        for (const plane of gizmo.planes || []) {
            const [a, b, c, d] = plane.points;
            const h0 = Intersection.rayTriangle(ray, a, b, c);
            const h1 = h0 || Intersection.rayTriangle(ray, a, c, d);
            if (h1) choose({ ...plane, type: "plane", distance: 0, rayDistance: h1.distance, hitPoint: h1.point });
        }

        for (const ring of gizmo.rings || []) {
            const planeHit = Intersection.rayPlane(ray, { point: ring.origin, normal: ring.normal });
            if (!planeHit) continue;
            const radiusDelta = Math.abs(len(sub(planeHit.point, ring.origin)) - ring.radius);
            if (radiusDelta <= ringThreshold) choose({ ...ring, type: "ring", distance: radiusDelta, rayDistance: planeHit.distance, hitPoint: planeHit.point });
        }

        return best;
    }

    static pickScreen(gizmo, options = {}) {
        const local = options.local;

        if (!options.camera || !local || !gizmo) {
            return null;
        }

        const project = createProjector(options.camera, options.viewport || { width: 1, height: 1 }, options);

        if (!project) {
            return null;
        }

        const pointer = {
            x: toNumber(local.x, 0),
            y: toNumber(local.y, 0),
        };
        let best = null;
        const choose = hit => {
            if (hit && (!best || hit.screenDistance < best.screenDistance)) {
                best = hit;
            }
        };
        const axisThreshold = Math.max(0, toNumber(options.axisPixelThreshold, 1.5));
        const ringThreshold = Math.max(0, toNumber(options.ringPixelThreshold, 3));

        for (const point of gizmo.points || []) {
            const screen = project(point.point);

            if (!screen) {
                continue;
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
        }

        for (const line of gizmo.lines || []) {
            if (line.tool === "guide") {
                continue;
            }

            const a = project(line.a);
            const b = project(line.b);

            if (!a || !b) {
                continue;
            }

            const hit = distanceToScreenSegment(pointer, a, b);

            if (hit.distance <= axisThreshold) {
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
        }

        for (const plane of gizmo.planes || []) {
            const planePoints = plane.points || [];
            const projected = [];
            let valid = true;

            for (let index = 0; index < planePoints.length; index += 1) {
                const point = project(planePoints[index]);

                if (!point) {
                    valid = false;
                    break;
                }

                projected.push(point);
            }

            if (!valid) {
                continue;
            }

            let edgeDistance = Infinity;
            let depth = 0;

            for (let index = 0; index < projected.length; index += 1) {
                const point = projected[index];
                const next = projected[(index + 1) % projected.length];
                depth += point.z;
                edgeDistance = Math.min(edgeDistance, distanceToScreenSegment(pointer, point, next).distance);
            }

            if (pointInScreenPolygon(pointer, projected) || edgeDistance <= Math.max(4, toNumber(options.planePixelInset, 2))) {
                choose({
                    ...plane,
                    type: "plane",
                    distance: edgeDistance,
                    screenDistance: Math.max(0, edgeDistance - 2),
                    rayDistance: depth / projected.length,
                    hitPoint: plane.points[0],
                });
            }
        }

        for (const ring of gizmo.rings || []) {
            const steps = Math.max(16, Math.min(96, Math.trunc(toNumber(options.ringSteps, options.dragging ? 48 : 64))));
            let previousPoint = ringPoint(ring, 0);
            let previousScreen = project(previousPoint);

            for (let index = 1; index <= steps; index += 1) {
                const point = ringPoint(ring, (index / steps) * Math.PI * 2);
                const screen = project(point);

                if (previousScreen && screen) {
                    const hit = distanceToScreenSegment(pointer, previousScreen, screen);

                    if (hit.distance <= ringThreshold) {
                        choose({
                            ...ring,
                            type: "ring",
                            distance: hit.distance,
                            screenDistance: hit.distance,
                            rayDistance: previousScreen.z + (screen.z - previousScreen.z) * hit.t,
                            hitPoint: lerp3(previousPoint, point, hit.t),
                        });
                    }
                }

                previousPoint = point;
                previousScreen = screen;
            }
        }

        return best;
    }
}
