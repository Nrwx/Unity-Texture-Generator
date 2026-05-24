import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { number} from "@/utils/math";

const PICK_CACHE = new WeakMap();
const PICK_TRIANGLE_CACHE = new WeakMap();

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

const interpolate3 = (a, b, c, weights = [1 / 3, 1 / 3, 1 / 3]) => ([
    a[0] * weights[0] + b[0] * weights[1] + c[0] * weights[2],
    a[1] * weights[0] + b[1] * weights[1] + c[1] * weights[2],
    a[2] * weights[0] + b[2] * weights[1] + c[2] * weights[2],
]);

const normalize3 = (value, fallback = [0, 0, 1]) => {
    const x = number(value?.[0], fallback[0]);
    const y = number(value?.[1], fallback[1]);
    const z = number(value?.[2], fallback[2]);
    const length = Math.hypot(x, y, z);

    if (!Number.isFinite(length) || length <= 0.00000001) {
        return fallback.slice();
    }

    return [x / length, y / length, z / length];
};

const triangleNormal = (a, b, c, fallback = [0, 0, 1]) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

    return normalize3([
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    ], fallback);
};

const buildPickTriangleGraph = indices => {
    if (!indices?.length) {
        return { triangles: [], vertexTriangles: new Map() };
    }

    const cached = PICK_TRIANGLE_CACHE.get(indices);
    const signature = `${indices.length}`;

    if (cached?.signature === signature) {
        return cached.graph;
    }

    const triangleCount = Math.floor(indices.length / 3);
    const triangles = new Array(triangleCount);
    const vertexTriangles = new Map();

    const addVertexTriangle = (vertex, triangleIndex) => {
        if (!vertexTriangles.has(vertex)) {
            vertexTriangles.set(vertex, []);
        }

        vertexTriangles.get(vertex).push(triangleIndex);
    };

    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const triangleIndex = offset / 3;
        const a = Math.trunc(Number(indices[offset]));
        const b = Math.trunc(Number(indices[offset + 1]));
        const c = Math.trunc(Number(indices[offset + 2]));

        if (![a, b, c].every(Number.isInteger) || a < 0 || b < 0 || c < 0 || a === b || b === c || c === a) {
            triangles[triangleIndex] = null;
            continue;
        }

        triangles[triangleIndex] = { offset, a, b, c, neighbors: [] };
        addVertexTriangle(a, triangleIndex);
        addVertexTriangle(b, triangleIndex);
        addVertexTriangle(c, triangleIndex);
    }

    triangles.forEach((triangle, triangleIndex) => {
        if (!triangle) {
            return;
        }

        const neighbors = new Set();
        [triangle.a, triangle.b, triangle.c].forEach(vertex => {
            (vertexTriangles.get(vertex) || []).forEach(other => {
                if (other !== triangleIndex) {
                    neighbors.add(other);
                }
            });
        });
        triangle.neighbors = Array.from(neighbors);
    });

    const graph = { triangles, vertexTriangles };
    PICK_TRIANGLE_CACHE.set(indices, { signature, graph });

    return graph;
};

const collectSeedTriangleOrder = (indices, seedTriangleIndex, maxTriangles = 96) => {
    const seed = Math.trunc(Number(seedTriangleIndex));

    if (!Number.isInteger(seed) || seed < 0) {
        return null;
    }

    const graph = buildPickTriangleGraph(indices);

    if (!graph.triangles[seed]) {
        return null;
    }

    const order = [];
    const queue = [seed];
    const visited = new Set(queue);
    const limit = Math.max(1, Math.trunc(Number(maxTriangles) || 96));

    while (queue.length && order.length < limit) {
        const current = queue.shift();
        const triangle = graph.triangles[current];

        if (!triangle) {
            continue;
        }

        order.push(current);

        for (const neighbor of triangle.neighbors || []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    return order.length ? order : null;
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
        const localPositionAt = matrixData ? createPositionResolver(normalized, null) : positionAt;
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

        const scanTriangle = i => {
            const ia = indices[i];
            const ib = indices[i + 1];
            const ic = indices[i + 2];
            const a = positionAt(ia);
            const b = positionAt(ib);
            const c = positionAt(ic);

            if (needFace) {
                const hit = Intersection.rayTriangle(ray, a, b, c, { cullBackface: false });

                if (hit && (!bestFace || hit.distance < bestFace.distance)) {
                    const localA = localPositionAt(ia);
                    const localB = localPositionAt(ib);
                    const localC = localPositionAt(ic);
                    const localPoint = interpolate3(localA, localB, localC, hit.barycentric);
                    const localNormal = triangleNormal(localA, localB, localC, hit.normal);

                    bestFace = {
                        type: "face",
                        triangleIndex: i / 3,
                        indices: [ia, ib, ic],
                        distance: hit.distance,
                        point: matrixData ? localPoint : hit.point,
                        normal: matrixData ? localNormal : hit.normal,
                        worldPoint: matrixData ? hit.point : undefined,
                        worldNormal: matrixData ? hit.normal : undefined,
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
                        const leftLocal = localPositionAt(left);
                        const rightLocal = localPositionAt(right);
                        const t = Math.max(0, Math.min(1, number(edgeHit.segmentT, 0)));

                        bestEdge = {
                            type: "edge",
                            key,
                            indices: [left, right],
                            distance: edgeHit.distance,
                            rayDistance: edgeHit.rayDistance,
                            point: matrixData
                                ? [
                                    leftLocal[0] + (rightLocal[0] - leftLocal[0]) * t,
                                    leftLocal[1] + (rightLocal[1] - leftLocal[1]) * t,
                                    leftLocal[2] + (rightLocal[2] - leftLocal[2]) * t,
                                ]
                                : edgeHit.pointOnSegment,
                            worldPoint: matrixData ? edgeHit.pointOnSegment : undefined,
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
                            point: matrixData ? localPositionAt(index).slice() : point,
                            worldPoint: matrixData ? point : undefined,
                        };
                    }
                }
            }
        };

        const seedOrder = collectSeedTriangleOrder(
            indices,
            thresholds.seedTriangleIndex ?? thresholds.preferTriangleIndex,
            thresholds.seedTriangleLimit ?? 96,
        );
        const scannedTriangles = new Set();

        if (seedOrder) {
            for (const triangleIndex of seedOrder) {
                const offset = triangleIndex * 3;
                scannedTriangles.add(triangleIndex);
                scanTriangle(offset);
            }

            if (mode === "face" && bestFace) {
                return bestFace;
            }
        }

        for (let i = 0; i < indices.length; i += 3) {
            const triangleIndex = i / 3;

            if (scannedTriangles.has(triangleIndex)) {
                continue;
            }

            scanTriangle(i);
        }

        if (mode === "vertex") return bestVertex;
        if (mode === "edge") return bestEdge;
        if (mode === "face") return bestFace;
        return bestVertex || bestEdge || bestFace;
    }
}
