import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { CoordinateSystem } from "@/models/layer/3D/core/coordinate/model";
import { clamp } from "@/utils/tools";
import {AXIS_VECTORS, PLANE_AXES, number, isFiniteNumber} from "@/utils/math";

const axisColor = axis =>
    axis === "x"
        ? [1, 0.15, 0.13, 1]
        : axis === "y"
            ? [0.25, 1, 0.45, 1]
            : [0.35, 0.58, 1, 1];

const projectPointSource = (point, rendererSpace = false) =>
    rendererSpace === true
        ? CoordinateSystem.sceneToRendererVector(point)
        : Vector.from(point, [0, 0, 0]).toArray();

const pickPointRadius = (point, options = {}) => {
    const extra = Math.max(0, number(options.pointPixelExtra, 2));

    if (isFiniteNumber(point?.screenRadius)) {
        return Math.max(0, Number(point.screenRadius)) + extra;
    }

    const id = String(point?.id || "");

    if (id.includes("scale")) return 7.5 + extra;
    if (id.includes("translate")) return 6.75 + extra;
    if (id.includes("pivot")) return 5.5 + extra;

    return clamp(number(options.pointPixelThreshold, 6), 4, Infinity) + extra;
};

const createProjector = (camera, viewport = { width: 1, height: 1 }, options = {}) => {
    const matrixSource =
        camera?.viewProjectionMatrix ||
        camera?.viewProj ||
        camera?.matrix;

    if (!matrixSource) return null;

    const matrix = Matrix.from(matrixSource);

    const width = clamp(number(viewport.width, 1), 1, Infinity);
    const height = clamp(number(viewport.height, 1), 1, Infinity);

    const rendererSpace = options.rendererSpace === true;

    return point => {
        const source = projectPointSource(point, rendererSpace);
        const projected = matrix.transformPoint(source, 1);

        const w = projected.w;
        const invW = Math.abs(w) < 1e-7 ? 0 : 1 / w;

        const xNdc = projected.x * invW;
        const yNdc = projected.y * invW;

        return {
            x: (xNdc + 1) * 0.5 * width,
            y: (1 - (yNdc + 1) * 0.5) * height,
            z: projected.z * invW,
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

    const t = clamp(
        ((point.x - a.x) * abx + (point.y - a.y) * aby) / lenSq,
        0,
        1
    );

    const x = a.x + abx * t;
    const y = a.y + aby * t;

    return {
        distance: Math.hypot(point.x - x, point.y - y),
        t,
    };
};

const pointInScreenPolygon = (point, polygon = []) => {
    if (polygon.length < 3) return false;

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];

        const intersects =
            (pi.y > point.y) !== (pj.y > point.y) &&
            point.x <
            ((pj.x - pi.x) * (point.y - pi.y)) /
            Math.max(1e-7, pj.y - pi.y) +
            pi.x;

        if (intersects) inside = !inside;
        i++;
    }

    return inside;
};

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

const createAxisLine = (origin, dir, size, axis, tool) => {
    const tip = Vector.add(origin, Vector.scale(dir, size).toArray()).toArray();

    return {
        line: {
            a: origin,
            b: tip,
            color: axisColor(axis),
            id: `${tool}:${axis}`,
            axis,
            tool,
            width: tool === "scale" ? 1.55 : 1.65,
        },
        point: {
            id: `${tool === "translate" ? "translate-tip" : "scale-box"}:${axis}`,
            axis,
            tool,
            point: tip,
            radius: Math.max(size * (tool === "scale" ? 0.28 : 0.26), 0.16),
        },
    };
};

export class GizmoGeometry {
    static originFromGeometry(geometry = {}) {
        return [
            number(geometry.position_x, 0) + number(geometry.pivot_x, 0),
            number(geometry.position_y, 0) + number(geometry.pivot_y, 0),
            number(geometry.position_z, 0) + number(geometry.pivot_z, 0),
        ];
    }

    static sizeFromGeometry(geometry = {}, fallback = 0.85) {
        const sx = Math.abs(number(geometry.width, 1) * number(geometry.scale_x, 1));
        const sy = Math.abs(number(geometry.height, 1) * number(geometry.scale_y, 1));
        const sz = Math.abs(number(geometry.depth, 1) * number(geometry.scale_z, 1));

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
        const resolvedOrigin = origin
            ? Vector.from(origin, [0, 0, 0]).toArray()
            : GizmoGeometry.originFromGeometry(geometry);

        const resolvedSize = clamp(
            number(size, GizmoGeometry.sizeFromGeometry(geometry)),
            0.16,
            0.92
        );

        const activeTool = String(tool || "translate").toLowerCase();

        const lines = [];
        const planes = [];
        const rings = [];
        const points = [];

        const pushLine = (a, b, color, id, axis, lineTool = "translate", width = 1) => {
            lines.push({ a, b, color, id, axis, tool: lineTool, width });
        };

        const addAxisHandle = (axis, dir, sizeScale = 1, toolName = "translate") => {
            const { line, point } = createAxisLine(
                resolvedOrigin,
                dir,
                resolvedSize * sizeScale,
                axis,
                toolName
            );

            pushLine(line.a, line.b, line.color, line.id, line.axis, line.tool, line.width);
            points.push(point);
        };

        if (showAxisHandles && (activeTool === "translate" || activeTool === "pivot")) {
            Object.entries(AXIS_VECTORS).forEach(([axis, dir]) =>
                addAxisHandle(axis, dir, 1, "translate")
            );
        }

        if (renderPlaneHandles && activeTool === "translate") {
            Object.entries(PLANE_AXES).forEach(([axis, [u, v]]) => {
                const s = resolvedSize * 0.26;

                const p0 = Vector.add(resolvedOrigin,
                    Vector.add(Vector.scale(u, s).toArray(),
                        Vector.scale(v, s).toArray()).toArray()
                ).toArray();

                const p1 = Vector.add(resolvedOrigin,
                    Vector.add(Vector.scale(u, s * 1.7).toArray(),
                        Vector.scale(v, s).toArray()).toArray()
                ).toArray();

                const p2 = Vector.add(resolvedOrigin,
                    Vector.add(Vector.scale(u, s * 1.7).toArray(),
                        Vector.scale(v, s * 1.7).toArray()).toArray()
                ).toArray();

                const p3 = Vector.add(resolvedOrigin,
                    Vector.add(Vector.scale(u, s).toArray(),
                        Vector.scale(v, s * 1.7).toArray()).toArray()
                ).toArray();

                planes.push({ id: `plane:${axis}`, axis, tool: "translate", points: [p0, p1, p2, p3] });

                pushLine(p0, p1, [1, 1, 1, 0.45], `plane-line:${axis}:0`, axis, "translate", 1);
                pushLine(p1, p2, [1, 1, 1, 0.45], `plane-line:${axis}:1`, axis, "translate", 1);
                pushLine(p2, p3, [1, 1, 1, 0.45], `plane-line:${axis}:2`, axis, "translate", 1);
                pushLine(p3, p0, [1, 1, 1, 0.45], `plane-line:${axis}:3`, axis, "translate", 1);
            });
        }

        if (showRotateRings && activeTool === "rotate") {
            ["x", "y", "z"].forEach(axis => {
                rings.push({
                    id: `rotate:${axis}`,
                    axis,
                    tool: "rotate",
                    origin: resolvedOrigin,
                    normal: AXIS_VECTORS[axis],
                    radius: resolvedSize * 0.88,
                });
            });
        }

        if (showScaleHandles && activeTool === "scale") {
            Object.entries(AXIS_VECTORS).forEach(([axis, dir]) =>
                addAxisHandle(axis, dir, 0.82, "scale")
            );

            points.push({
                id: "scale:free",
                axis: "free",
                tool: "scale",
                point: Vector.add(resolvedOrigin,
                    [resolvedSize * 0.32, resolvedSize * 0.32, resolvedSize * 0.32]
                ).toArray(),
                radius: Math.max(resolvedSize * 0.26, 0.15),
            });
        }

        if (showPivot) {
            points.push({
                id: "pivot:free",
                axis: "free",
                tool: "pivot",
                point: resolvedOrigin,
                radius: Math.max(resolvedSize * 0.24, 0.14),
            });
        }

        if (showAxisGuide && activeAxis && activeAxis !== "free" && AXIS_VECTORS[activeAxis]) {
            const dir = AXIS_VECTORS[activeAxis];
            const guide = resolvedSize * 3.0;

            pushLine(
                Vector.add(resolvedOrigin, Vector.scale(dir, -guide).toArray()).toArray(),
                Vector.add(resolvedOrigin, Vector.scale(dir, guide).toArray()).toArray(),
                [1, 1, 1, 0.32],
                `axis-guide:${activeAxis}`,
                activeAxis,
                "guide",
                0.7
            );
        }

        return { origin: resolvedOrigin, size: resolvedSize, lines, planes, rings, points };
    }

    static pick(ray, gizmo, threshold = 0.16, options = {}) {
        const screenHit = GizmoGeometry.pickScreen(gizmo, options);
        if (screenHit) return screenHit;

        if (options.strictScreen && options.camera && options.local) return null;

        let best = null;

        const axisThreshold = number(options.axisThreshold, threshold);
        const ringThreshold = number(options.ringThreshold, threshold);
        const pointThreshold = number(options.pointThreshold, threshold);

        const choose = hit => {
            if (!hit) return;

            if (
                !best ||
                hit.rayDistance < best.rayDistance ||
                (hit.rayDistance === best.rayDistance && hit.distance < best.distance)
            ) {
                best = hit;
            }
        };

        for (const point of gizmo.points || []) {
            const hit = Intersection.raySphere(ray, point.point, point.radius || pointThreshold);
            if (hit) {
                choose({
                    ...point,
                    type: point.tool === "pivot" ? "pivot" : "handle",
                    distance: 0,
                    rayDistance: hit.distance,
                    hitPoint: hit.point,
                });
            }
        }

        for (const line of gizmo.lines || []) {
            if (line.tool === "guide") continue;

            const hit = Intersection.raySegmentDistance(ray, line.a, line.b);
            const tolerance = axisThreshold * (line.width || 1);

            if (hit.distance <= tolerance) {
                choose({
                    ...line,
                    type: "axis",
                    distance: hit.distance,
                    rayDistance: hit.rayDistance,
                    hitPoint: hit.pointOnSegment,
                });
            }
        }

        for (const plane of gizmo.planes || []) {
            const [a, b, c, d] = plane.points;
            const h0 = Intersection.rayTriangle(ray, a, b, c);
            const h1 = h0 || Intersection.rayTriangle(ray, a, c, d);

            if (h1) {
                choose({
                    ...plane,
                    type: "plane",
                    distance: 0,
                    rayDistance: h1.distance,
                    hitPoint: h1.point,
                });
            }
        }

        for (const ring of gizmo.rings || []) {
            const planeHit = Intersection.rayPlane(ray, {
                point: ring.origin,
                normal: ring.normal,
            });

            if (!planeHit) continue;

            const radiusDelta = Math.abs(
                Vector.from(planeHit.point).distance(ring.origin) - ring.radius
            );

            if (radiusDelta <= ringThreshold) {
                choose({
                    ...ring,
                    type: "ring",
                    distance: radiusDelta,
                    rayDistance: planeHit.distance,
                    hitPoint: planeHit.point,
                });
            }
        }

        return best;
    }

    static pickScreen(gizmo, options = {}) {
        const local = options.local;

        if (!options.camera || !local || !gizmo) return null;

        const project = createProjector(
            options.camera,
            options.viewport || { width: 1, height: 1 },
            options
        );

        if (!project) return null;

        const pointer = {
            x: number(local.x, 0),
            y: number(local.y, 0),
        };

        let best = null;

        const axisThreshold = Math.max(0, number(options.axisPixelThreshold, 1.5));
        const ringThreshold = Math.max(0, number(options.ringPixelThreshold, 3));

        const choose = hit => {
            if (hit && (!best || hit.screenDistance < best.screenDistance)) {
                best = hit;
            }
        };

        for (const point of gizmo.points || []) {
            const screen = project(point.point);
            if (!screen) continue;

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
            if (line.tool === "guide") continue;

            const a = project(line.a);
            const b = project(line.b);
            if (!a || !b) continue;

            const hit = distanceToScreenSegment(pointer, a, b);

            if (hit.distance <= axisThreshold) {
                choose({
                    ...line,
                    type: "axis",
                    distance: hit.distance,
                    screenDistance: hit.distance,
                    rayDistance: a.z + (b.z - a.z) * hit.t,
                    hitPoint: Vector.from(line.a).lerp(line.b, hit.t).toArray(),
                    screenPoint: {
                        x: a.x + (b.x - a.x) * hit.t,
                        y: a.y + (b.y - a.y) * hit.t,
                    },
                });
            }
        }

        for (const plane of gizmo.planes || []) {
            const projected = [];

            for (const p of plane.points) {
                const pr = project(p);
                if (!pr) continue;
                projected.push(pr);
            }

            if (projected.length < 3) continue;

            let edgeDistance = Infinity;
            let depth = 0;

            for (let i = 0; i < projected.length; i++) {
                const p = projected[i];
                const n = projected[(i + 1) % projected.length];

                depth += p.z;
                edgeDistance = Math.min(
                    edgeDistance,
                    distanceToScreenSegment(pointer, p, n).distance
                );
            }

            if (
                pointInScreenPolygon(pointer, projected) ||
                edgeDistance <= Math.max(4, number(options.planePixelInset, 2))
            ) {
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
            const steps = Math.max(
                16,
                Math.min(
                    96,
                    Math.trunc(number(options.ringSteps, options.dragging ? 48 : 64))
                )
            );

            let prev = ringPoint(ring, 0);
            let prevScreen = project(prev);

            for (let i = 1; i <= steps; i++) {
                const p = ringPoint(ring, (i / steps) * Math.PI * 2);
                const s = project(p);

                if (prevScreen && s) {
                    const hit = distanceToScreenSegment(pointer, prevScreen, s);

                    if (hit.distance <= ringThreshold) {
                        choose({
                            ...ring,
                            type: "ring",
                            distance: hit.distance,
                            screenDistance: hit.distance,
                            rayDistance:
                                prevScreen.z + (s.z - prevScreen.z) * hit.t,
                            hitPoint: Vector.from(prev).lerp(p, hit.t).toArray(),
                        });
                    }
                }

                prev = p;
                prevScreen = s;
            }
        }

        return best;
    }
}