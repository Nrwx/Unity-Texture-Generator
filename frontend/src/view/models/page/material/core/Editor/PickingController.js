import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { number} from "@/utils/math";

const PICK_CACHE = new WeakMap();

const toVertexArray = value => {
    if (value instanceof Float32Array) {
        return value;
    }

    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        return new Float32Array(value);
    }

    if (value && typeof value === "object") {
        return new Float32Array(
            Object.keys(value)
                .sort((a, b) => Number(a) - Number(b))
                .map(key => number(value[key], 0))
        );
    }

    return new Float32Array();
};

const toIndexArray = value => {
    if (value instanceof Uint16Array || value instanceof Uint32Array) {
        return value;
    }

    const array = Array.isArray(value) || ArrayBuffer.isView(value)
        ? value
        : value && typeof value === "object"
            ? Object.keys(value)
                .sort((a, b) => Number(a) - Number(b))
                .map(key => value[key])
            : [];

    let maxIndex = 0;

    for (let index = 0; index < array.length; index += 1) {
        const value = Math.max(0, Math.trunc(Number(array[index]) || 0));

        if (value > maxIndex) {
            maxIndex = value;
        }
    }

    const TargetArray = maxIndex > 65535 ? Uint32Array : Uint16Array;
    const result = new TargetArray(array.length);

    for (let index = 0; index < array.length; index += 1) {
        result[index] = Math.max(0, Math.trunc(Number(array[index]) || 0));
    }

    return result;
};

const resolveMatrixData = modelMatrix => {
    if (!modelMatrix) {
        return null;
    }

    return Matrix.from(modelMatrix).data;
};

const transformPosition = (out, vertices, vertexIndex, stride, matrixData) => {
    const offset = vertexIndex * stride;
    const x = number(vertices[offset], 0);
    const y = number(vertices[offset + 1], 0);
    const z = number(vertices[offset + 2], 0);

    if (!matrixData) {
        out[0] = x;
        out[1] = y;
        out[2] = z;
        return out;
    }

    const tx = matrixData[0] * x + matrixData[4] * y + matrixData[8] * z + matrixData[12];
    const ty = matrixData[1] * x + matrixData[5] * y + matrixData[9] * z + matrixData[13];
    const tz = matrixData[2] * x + matrixData[6] * y + matrixData[10] * z + matrixData[14];
    const tw = matrixData[3] * x + matrixData[7] * y + matrixData[11] * z + matrixData[15];
    const invW = Math.abs(tw) > 1e-7 ? 1 / tw : 1;

    out[0] = tx * invW;
    out[1] = ty * invW;
    out[2] = tz * invW;

    return out;
};

const createPositionResolver = (mesh, matrixData) => {
    const vertices = mesh.__pickVertices;
    const stride = mesh.stride;
    const cache = new Map();

    return vertexIndex => {
        let position = cache.get(vertexIndex);

        if (!position) {
            position = transformPosition([0, 0, 0], vertices, vertexIndex, stride, matrixData);
            cache.set(vertexIndex, position);
        }

        return position;
    };
};

export class PickingController {
    static normalizeMesh(mesh = null) {
        if (!mesh?.vertices || !mesh?.indices) {
            return null;
        }

        const cached = PICK_CACHE.get(mesh);

        if (
            cached &&
            cached.sourceVertices === mesh.vertices &&
            cached.sourceIndices === mesh.indices &&
            cached.sourceStride === Number(mesh.stride || 11)
        ) {
            return cached.normalized;
        }

        const normalized = {
            ...mesh,
            stride: Number(mesh.stride || 11),
            __pickVertices: toVertexArray(mesh.vertices),
            __pickIndices: toIndexArray(mesh.indices),
        };

        PICK_CACHE.set(mesh, {
            sourceVertices: mesh.vertices,
            sourceIndices: mesh.indices,
            sourceStride: normalized.stride,
            normalized,
        });

        return normalized;
    }

    static pickMesh({ ray, mesh, modelMatrix = null, mode = "object", thresholds = {} } = {}) {
        const normalized = PickingController.normalizeMesh(mesh);

        if (!ray || !normalized) {
            return null;
        }

        const indices = normalized.__pickIndices;
        const matrixData = resolveMatrixData(modelMatrix);
        const positionAt = createPositionResolver(normalized, matrixData);
        const edgeThreshold = number(thresholds.edgeThreshold, 0.045);
        const vertexThreshold = number(thresholds.vertexThreshold, 0.055);
        const needFace = mode === "object" || mode === "face";
        const needEdge = mode === "object" || mode === "edge";
        const needVertex = mode === "object" || mode === "vertex";
        const seenEdges = needEdge ? new Set() : null;
        const seenVertices = needVertex ? new Set() : null;
        let bestFace = null;
        let bestEdge = null;
        let bestVertex = null;

        for (let i = 0; i < indices.length; i += 3) {
            const ia = indices[i];
            const ib = indices[i + 1];
            const ic = indices[i + 2];
            const a = positionAt(ia);
            const b = positionAt(ib);
            const c = positionAt(ic);

            if (needFace) {
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
            }

            if (needEdge) {
                const edgePairs = [
                    [ia, ib, a, b],
                    [ib, ic, b, c],
                    [ic, ia, c, a],
                ];

                for (let edgeIndex = 0; edgeIndex < edgePairs.length; edgeIndex += 1) {
                    const [left, right, pa, pb] = edgePairs[edgeIndex];
                    const min = Math.min(left, right);
                    const max = Math.max(left, right);
                    const key = `${min}:${max}`;

                    if (seenEdges.has(key)) {
                        continue;
                    }

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
                }
            }

            if (needVertex) {
                const vertexPairs = [
                    [ia, a],
                    [ib, b],
                    [ic, c],
                ];

                for (let vertexPairIndex = 0; vertexPairIndex < vertexPairs.length; vertexPairIndex += 1) {
                    const [index, point] = vertexPairs[vertexPairIndex];

                    if (seenVertices.has(index)) {
                        continue;
                    }

                    seenVertices.add(index);

                    const rayDistance = ray.projectPoint(point);

                    if (rayDistance < 0) {
                        continue;
                    }

                    const dist = ray.distanceToPoint(point);

                    if (dist <= vertexThreshold && (!bestVertex || rayDistance < bestVertex.rayDistance)) {
                        bestVertex = {
                            type: "vertex",
                            index,
                            distance: dist,
                            rayDistance,
                            point,
                        };
                    }
                }
            }
        }

        if (mode === "vertex") return bestVertex;
        if (mode === "edge") return bestEdge;
        if (mode === "face") return bestFace;
        return bestVertex || bestEdge || bestFace;
    }
}
