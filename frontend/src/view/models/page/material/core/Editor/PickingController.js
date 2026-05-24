import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";

const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const getArrayValues = value => {
    if (value instanceof Float32Array || value instanceof Uint16Array || value instanceof Uint32Array) return Array.from(value);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.keys(value).sort((a, b) => Number(a) - Number(b)).map(key => value[key]);
    return [];
};
const transformPoint = (matrix, point) => {
    if (!matrix) return point;
    const m = matrix instanceof Matrix ? matrix : Matrix.from(matrix);
    const out = m.transformPoint(point, 1);
    const w = out.w || 1;
    return [out.x / w, out.y / w, out.z / w];
};
const getPosition = (mesh, index, modelMatrix = null) => {
    const stride = Number(mesh.stride || 11);
    const vertices = mesh.__pickVertices || getArrayValues(mesh.vertices);
    const offset = index * stride;
    return transformPoint(modelMatrix, [
        toNumber(vertices[offset], 0),
        toNumber(vertices[offset + 1], 0),
        toNumber(vertices[offset + 2], 0),
    ]);
};

export class PickingController {
    static normalizeMesh(mesh = null) {
        if (!mesh || !mesh.vertices || !mesh.indices) return null;
        return {
            ...mesh,
            stride: Number(mesh.stride || 11),
            __pickVertices: getArrayValues(mesh.vertices),
            __pickIndices: getArrayValues(mesh.indices).map(value => Math.max(0, Math.trunc(Number(value) || 0))),
        };
    }

    static pickMesh({ ray, mesh, modelMatrix = null, mode = "object", thresholds = {} } = {}) {
        const normalized = PickingController.normalizeMesh(mesh);
        if (!ray || !normalized) return null;

        const indices = normalized.__pickIndices;
        let bestFace = null;
        let bestEdge = null;
        let bestVertex = null;
        const edgeThreshold = toNumber(thresholds.edgeThreshold, 0.045);
        const vertexThreshold = toNumber(thresholds.vertexThreshold, 0.055);
        const seenEdges = new Set();
        const seenVertices = new Set();

        for (let i = 0; i < indices.length; i += 3) {
            const ia = indices[i];
            const ib = indices[i + 1];
            const ic = indices[i + 2];
            const a = getPosition(normalized, ia, modelMatrix);
            const b = getPosition(normalized, ib, modelMatrix);
            const c = getPosition(normalized, ic, modelMatrix);
            const hit = Intersection.rayTriangle(ray, a, b, c, { cullBackface: false });

            if (hit && (!bestFace || hit.distance < bestFace.distance)) {
                bestFace = {
                    type: "face",
                    triangleIndex: i / 3,
                    indices: [ia, ib, ic],
                    distance: hit.distance,
                    point: hit.point,
                    normal: hit.normal,
                    barycentric: hit.barycentric,
                };
            }

            [[ia, ib, a, b], [ib, ic, b, c], [ic, ia, c, a]].forEach(([left, right, pa, pb]) => {
                const key = `${Math.min(left, right)}:${Math.max(left, right)}`;
                if (seenEdges.has(key)) return;
                seenEdges.add(key);
                const edgeHit = Intersection.raySegmentDistance(ray, pa, pb);
                if (edgeHit.distance <= edgeThreshold && (!bestEdge || edgeHit.rayDistance < bestEdge.rayDistance)) {
                    bestEdge = {
                        type: "edge",
                        key,
                        indices: [left, right],
                        distance: edgeHit.distance,
                        rayDistance: edgeHit.rayDistance,
                        point: edgeHit.pointOnSegment,
                    };
                }
            });

            [[ia, a], [ib, b], [ic, c]].forEach(([index, point]) => {
                if (seenVertices.has(index)) return;
                seenVertices.add(index);
                const dist = ray.distanceToPoint(point);
                const rayDistance = ray.projectPoint(point);
                if (dist <= vertexThreshold && rayDistance >= 0 && (!bestVertex || rayDistance < bestVertex.rayDistance)) {
                    bestVertex = {
                        type: "vertex",
                        index,
                        distance: dist,
                        rayDistance,
                        point,
                    };
                }
            });
        }

        if (mode === "vertex" && bestVertex) return bestVertex;
        if (mode === "edge" && bestEdge) return bestEdge;
        if (mode === "face" && bestFace) return bestFace;
        return bestVertex || bestEdge || bestFace;
    }
}
