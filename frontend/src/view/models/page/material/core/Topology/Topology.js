import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";
import { clamp } from "@/utils/tools";
import { number } from "@/utils/math";

const POSITION_OFFSET = Mesh.POSITION_OFFSET;
const NORMAL_OFFSET = Mesh.NORMAL_OFFSET;
const TRIANGLE_ADJACENCY_CACHE = new WeakMap();

const toIndex = value => {
    const index = Math.trunc(Number(value));
    return Number.isFinite(index) ? index : -1;
};
const vertexBase = (index, stride) => index * stride + POSITION_OFFSET;
const validIndexForCount = (index, count) => Number.isInteger(index) && index >= 0 && index < count;
const finiteValues = values => values.every(Number.isFinite);

const distSqToPoint = (vertices, stride, index, point) => {
    const base = vertexBase(index, stride);
    const dx = vertices[base] - point[0];
    const dy = vertices[base + 1] - point[1];
    const dz = vertices[base + 2] - point[2];

    return dx * dx + dy * dy + dz * dz;
};

const normalizeBarycentric = value => {
    const source = Array.isArray(value) && value.length >= 3
        ? value.map(item => Number(item))
        : [1 / 3, 1 / 3, 1 / 3];
    const sum = source.reduce((total, item) => total + (Number.isFinite(item) ? item : 0), 0);

    if (!Number.isFinite(sum) || Math.abs(sum) <= 0.000001) {
        return [1 / 3, 1 / 3, 1 / 3];
    }

    return source.map(item => (Number.isFinite(item) ? item : 0) / sum);
};

const interpolate3 = (a, b, c, weights) => ([
    a[0] * weights[0] + b[0] * weights[1] + c[0] * weights[2],
    a[1] * weights[0] + b[1] * weights[1] + c[1] * weights[2],
    a[2] * weights[0] + b[2] * weights[1] + c[2] * weights[2],
]);

const interpolate2 = (a, b, c, weights) => ([
    a[0] * weights[0] + b[0] * weights[1] + c[0] * weights[2],
    a[1] * weights[0] + b[1] * weights[1] + c[1] * weights[2],
]);

const buildSourceParts = (parts = [], indexLength = 0) => {
    const safeParts = Array.isArray(parts) && parts.length
        ? parts
            .filter(part => Math.trunc(number(part?.count, 0)) > 0)
            .map(part => ({ ...part }))
        : [];

    if (safeParts.length) {
        return safeParts;
    }

    return [{
        name: "mesh",
        faceName: "front",
        materialSlot: "front",
        start: 0,
        count: indexLength,
    }];
};

const expandPartsForInsertedTriangle = (parts = [], hitOffset = 0, indexLength = 0) => {
    const source = buildSourceParts(parts, indexLength);

    return source.map(part => {
        const start = Math.max(0, Math.trunc(number(part?.start, 0)));
        const count = Math.max(0, Math.trunc(number(part?.count, 0)));
        const end = start + count;
        const containsHit = hitOffset >= start && hitOffset < end;

        return {
            ...part,
            start: start > hitOffset ? start + 6 : start,
            count: containsHit ? count + 6 : count,
        };
    });
};


const compactReferencedGeometry = (vertices, indices, stride) => {
    const vertexCount = Mesh.vertexCount(vertices, stride);
    const remap = new Map();
    const referenced = [];
    const validIndices = [];
    const nextIndices = [];

    if (!vertexCount || !indices?.length) {
        return { vertices, indices, remap, removedVertices: 0 };
    }

    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const a = toIndex(indices[offset]);
        const b = toIndex(indices[offset + 1]);
        const c = toIndex(indices[offset + 2]);

        if (!validIndexForCount(a, vertexCount) || !validIndexForCount(b, vertexCount) || !validIndexForCount(c, vertexCount) || a === b || b === c || c === a) {
            continue;
        }

        validIndices.push(a, b, c);
        [a, b, c].forEach(index => {
            if (!remap.has(index)) {
                remap.set(index, referenced.length);
                referenced.push(index);
            }
        });

        nextIndices.push(remap.get(a), remap.get(b), remap.get(c));
    }

    if (!nextIndices.length) {
        return { vertices, indices, remap, removedVertices: 0 };
    }

    if (referenced.length === vertexCount) {
        return {
            vertices,
            indices: validIndices,
            remap: new Map(Array.from({ length: vertexCount }, (_item, index) => [index, index])),
            removedVertices: 0,
        };
    }

    const nextVertices = [];
    referenced.forEach(sourceIndex => {
        const base = sourceIndex * stride;

        for (let item = 0; item < stride; item += 1) {
            nextVertices.push(Number(vertices[base + item]) || 0);
        }
    });

    return {
        vertices: nextVertices,
        indices: nextIndices,
        remap,
        removedVertices: vertexCount - referenced.length,
    };
};

const buildTriangleAdjacency = (indices, vertexCount) => {
    if (!indices || !indices.length || vertexCount <= 0) {
        return { triangles: [], vertexTriangles: new Map() };
    }

    const cached = TRIANGLE_ADJACENCY_CACHE.get(indices);
    const signature = `${indices.length}:${vertexCount}`;

    if (cached?.signature === signature) {
        return cached.graph;
    }

    const triangleCount = Math.floor(indices.length / 3);
    const triangles = new Array(triangleCount);
    const vertexTriangles = new Map();
    const validIndex = index => validIndexForCount(index, vertexCount);

    const addVertexTriangle = (vertex, triangleIndex) => {
        if (!vertexTriangles.has(vertex)) {
            vertexTriangles.set(vertex, []);
        }

        vertexTriangles.get(vertex).push(triangleIndex);
    };

    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const triangleIndex = offset / 3;
        const a = toIndex(indices[offset]);
        const b = toIndex(indices[offset + 1]);
        const c = toIndex(indices[offset + 2]);

        if (!validIndex(a) || !validIndex(b) || !validIndex(c) || a === b || b === c || c === a) {
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
            (vertexTriangles.get(vertex) || []).forEach(otherIndex => {
                if (otherIndex !== triangleIndex) {
                    neighbors.add(otherIndex);
                }
            });
        });
        triangle.neighbors = Array.from(neighbors);
    });

    const graph = { triangles, vertexTriangles };
    TRIANGLE_ADJACENCY_CACHE.set(indices, { signature, graph });

    return graph;
};

const createHitVertex = ({ vertices, stride, a, b, c, hit }) => {
    const weights = normalizeBarycentric(hit?.barycentric);
    const point = Array.isArray(hit?.point)
        ? hit.point
        : interpolate3(
            Mesh.read3(vertices, stride, a, POSITION_OFFSET),
            Mesh.read3(vertices, stride, b, POSITION_OFFSET),
            Mesh.read3(vertices, stride, c, POSITION_OFFSET),
            weights,
        );
    const hitNormal = Array.isArray(hit?.normal) && hit.normal.length >= 3
        ? Mesh.normalize3(hit.normal, [0, 0, 1])
        : null;
    const normal = hitNormal || Mesh.normalize3(interpolate3(
        Mesh.read3(vertices, stride, a, NORMAL_OFFSET),
        Mesh.read3(vertices, stride, b, NORMAL_OFFSET),
        Mesh.read3(vertices, stride, c, NORMAL_OFFSET),
        weights,
    ));
    const uv = interpolate2(
        Mesh.read2(vertices, stride, a, Mesh.UV_OFFSET),
        Mesh.read2(vertices, stride, b, Mesh.UV_OFFSET),
        Mesh.read2(vertices, stride, c, Mesh.UV_OFFSET),
        weights,
    );
    const tangent = Mesh.normalize3(interpolate3(
        Mesh.read3(vertices, stride, a, Mesh.TANGENT_OFFSET),
        Mesh.read3(vertices, stride, b, Mesh.TANGENT_OFFSET),
        Mesh.read3(vertices, stride, c, Mesh.TANGENT_OFFSET),
        weights,
    ), [1, 0, 0]);

    return Mesh.packVertex(point, normal, uv, tangent);
};

const insertHitAnchorVertex = ({ vertices, indices, stride, hit, brush, parts, maxIndexCount, maxVertexCount }) => {
    const hitPoint = Array.isArray(hit?.point) ? hit.point : null;
    const triangleIndex = Math.trunc(number(hit?.triangleIndex, -1));
    const hitOffset = triangleIndex * 3;
    const vertexCount = Mesh.vertexCount(vertices, stride);

    if (
        !hitPoint ||
        triangleIndex < 0 ||
        hitOffset < 0 ||
        hitOffset + 2 >= indices.length ||
        vertexCount + 1 > maxVertexCount ||
        indices.length + 6 > maxIndexCount
    ) {
        return { vertices, indices, parts, changed: false, limited: true, addedVertices: 0, splitTriangles: 0 };
    }

    const a = toIndex(indices[hitOffset]);
    const b = toIndex(indices[hitOffset + 1]);
    const c = toIndex(indices[hitOffset + 2]);

    if (!validIndexForCount(a, vertexCount) || !validIndexForCount(b, vertexCount) || !validIndexForCount(c, vertexCount) || a === b || b === c || c === a) {
        return { vertices, indices, parts, changed: false, addedVertices: 0, splitTriangles: 0 };
    }

    const minAnchorDistance = Math.max(
        number(brush?.detailMinEdge, 0.003),
        number(brush?.radius, 0.18) * 0.015,
    );
    const minAnchorDistanceSq = minAnchorDistance * minAnchorDistance;
    const nearestExistingSq = Math.min(
        distSqToPoint(vertices, stride, a, hitPoint),
        distSqToPoint(vertices, stride, b, hitPoint),
        distSqToPoint(vertices, stride, c, hitPoint),
    );

    // If a real vertex is already at the brush hit, do not create duplicate anchors.
    if (nearestExistingSq <= minAnchorDistanceSq) {
        return { vertices, indices, parts, changed: false, addedVertices: 0, splitTriangles: 0 };
    }

    const anchorVertex = createHitVertex({ vertices, stride, a, b, c, hit });
    const anchorIndex = Mesh.vertexCount(vertices, stride);
    Mesh.pushVertexArray(vertices, stride, anchorVertex);

    const nextIndices = [];

    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        if (offset === hitOffset) {
            nextIndices.push(a, b, anchorIndex, b, c, anchorIndex, c, a, anchorIndex);
            continue;
        }

        nextIndices.push(toIndex(indices[offset]), toIndex(indices[offset + 1]), toIndex(indices[offset + 2]));
    }

    return {
        vertices,
        indices: nextIndices,
        parts: expandPartsForInsertedTriangle(parts, hitOffset, indices.length),
        changed: true,
        limited: false,
        addedVertices: 1,
        splitTriangles: 1,
        anchorVertex: anchorIndex,
    };
};

const refineMeshInBrush = ({ vertices, indices: sourceIndices, stride, hit, brush, parts = [] }) => {
    if (!brush.detailEnabled || brush.detailPercent <= 0) {
        return { vertices, indices: sourceIndices, changed: false };
    }

    const hitPoint = Array.isArray(hit?.point) ? hit.point : null;
    if (!hitPoint) {
        return { vertices, indices: sourceIndices, changed: false };
    }

    let indices = Array.isArray(sourceIndices) ? sourceIndices.slice() : Array.from(sourceIndices || []);
    let vertexCount = Mesh.vertexCount(vertices, stride);
    const initialTriangleCount = Math.floor(indices.length / 3);
    const maxTriangleCount = Math.max(initialTriangleCount, Math.trunc(number(brush.detailMaxTriangles, 4096)));
    const maxIndexCount = maxTriangleCount * 3;
    const maxVertexCount = Math.max(vertexCount, Math.trunc(number(brush.detailMaxVertices, maxTriangleCount * 2)));
    const maxNewVertices = Math.max(1, Math.min(
        maxVertexCount - vertexCount,
        Math.trunc(number(brush.detailMaxNewVerticesPerStep, 64)),
    ));
    const maxTriangleSplits = Math.max(1, Math.trunc(number(brush.detailMaxTriangleSplitsPerStep, 96)));

    if (
        vertexCount <= 0 ||
        initialTriangleCount <= 0 ||
        indices.length >= maxIndexCount ||
        maxNewVertices <= 0
    ) {
        return { vertices, indices, changed: false, limited: true };
    }

    const anchor = insertHitAnchorVertex({
        vertices,
        indices,
        stride,
        hit,
        brush,
        parts,
        maxIndexCount,
        maxVertexCount,
    });

    if (anchor.changed) {
        indices = anchor.indices;
        parts = anchor.parts;
        vertexCount = Mesh.vertexCount(vertices, stride);
    }

    const finishAnchorOnly = (extra = {}) => anchor.changed
        ? {
            vertices,
            indices,
            parts: anchor.parts,
            changed: true,
            limited: anchor.limited === true || extra.limited === true,
            addedVertices: anchor.addedVertices,
            splitTriangles: anchor.splitTriangles,
            anchorVertex: anchor.anchorVertex,
            ...extra,
        }
        : { vertices, indices, changed: false, ...extra };

    const radius = brush.radius;
    const radiusSq = radius * radius;
    const detailFactor = clamp(brush.detailPercent / 100, 0, 2);
    const targetEdge = Math.max(
        brush.detailMinEdge,
        radius * (0.78 - detailFactor * 0.34) * brush.detailTolerance,
    );
    const targetEdgeSq = targetEdge * targetEdge;
    const splitEdges = new Set();
    const midpointCache = new Map();
    const sourceParts = buildSourceParts(parts, indices.length);

    const validIndex = index => validIndexForCount(index, vertexCount);
    const distSqToHit = (x, y, z) => {
        const dx = x - hitPoint[0];
        const dy = y - hitPoint[1];
        const dz = z - hitPoint[2];
        return dx * dx + dy * dy + dz * dz;
    };
    const edgeLengthSq = (a, b) => {
        const ab = vertexBase(a, stride);
        const bb = vertexBase(b, stride);
        const dx = vertices[ab] - vertices[bb];
        const dy = vertices[ab + 1] - vertices[bb + 1];
        const dz = vertices[ab + 2] - vertices[bb + 2];
        return dx * dx + dy * dy + dz * dz;
    };

    const candidates = [];
    const seedOffset = Math.max(0, Math.trunc(number(hit?.triangleIndex, -1))) * 3;

    for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = toIndex(indices[i]);
        const b = toIndex(indices[i + 1]);
        const c = toIndex(indices[i + 2]);

        if (!validIndex(a) || !validIndex(b) || !validIndex(c) || a === b || b === c || c === a) {
            continue;
        }

        const ab = vertexBase(a, stride);
        const bb = vertexBase(b, stride);
        const cb = vertexBase(c, stride);
        const ax = vertices[ab];
        const ay = vertices[ab + 1];
        const az = vertices[ab + 2];
        const bx = vertices[bb];
        const by = vertices[bb + 1];
        const bz = vertices[bb + 2];
        const cx = vertices[cb];
        const cy = vertices[cb + 1];
        const cz = vertices[cb + 2];

        if (!finiteValues([ax, ay, az, bx, by, bz, cx, cy, cz])) {
            continue;
        }

        const centroidDistSq = distSqToHit(
            (ax + bx + cx) / 3,
            (ay + by + cy) / 3,
            (az + bz + cz) / 3,
        );
        const nearestVertexDistSq = Math.min(
            distSqToHit(ax, ay, az),
            distSqToHit(bx, by, bz),
            distSqToHit(cx, cy, cz),
        );

        // The picked triangle must stay eligible. Otherwise coarse geometry can
        // receive a valid brush hit but still move no vertex because all source
        // vertices are outside the brush radius.
        if (i !== seedOffset && centroidDistSq > radiusSq && nearestVertexDistSq > radiusSq) {
            continue;
        }

        const edges = [];
        const abSq = edgeLengthSq(a, b);
        const bcSq = edgeLengthSq(b, c);
        const caSq = edgeLengthSq(c, a);

        if (abSq > targetEdgeSq) edges.push({ key: Mesh.edgeKey(a, b), lengthSq: abSq });
        if (bcSq > targetEdgeSq) edges.push({ key: Mesh.edgeKey(b, c), lengthSq: bcSq });
        if (caSq > targetEdgeSq) edges.push({ key: Mesh.edgeKey(c, a), lengthSq: caSq });

        if (!edges.length) {
            continue;
        }

        const longestEdgeSq = Math.max(abSq, bcSq, caSq);
        candidates.push({
            offset: i,
            edges,
            score: nearestVertexDistSq + centroidDistSq * 0.35 - longestEdgeSq * 0.08,
        });
    }

    if (!candidates.length) {
        return finishAnchorOnly();
    }

    candidates.sort((a, b) => a.score - b.score);

    let projectedIndexCount = indices.length;
    let projectedVertexCount = vertexCount;
    let projectedNewVertices = anchor.addedVertices || 0;
    let selectedTriangleSplits = 0;

    for (const candidate of candidates) {
        if (selectedTriangleSplits >= maxTriangleSplits) {
            break;
        }

        const candidateEdges = candidate.edges.filter(edge => !splitEdges.has(edge.key));
        if (!candidateEdges.length) {
            continue;
        }

        const splitCount = candidate.edges.length;
        const extraIndexCount = splitCount * 3;
        const newVertexCount = candidateEdges.length;

        if (
            projectedIndexCount + extraIndexCount > maxIndexCount ||
            projectedNewVertices + newVertexCount > maxNewVertices ||
            projectedVertexCount + newVertexCount > maxVertexCount
        ) {
            continue;
        }

        candidateEdges.forEach(edge => splitEdges.add(edge.key));
        projectedIndexCount += extraIndexCount;
        projectedVertexCount += newVertexCount;
        projectedNewVertices += newVertexCount;
        selectedTriangleSplits += 1;
    }

    if (!splitEdges.size) {
        return finishAnchorOnly();
    }

    const getMidpoint = (a, b) => {
        const key = Mesh.edgeKey(a, b);

        if (!splitEdges.has(key)) {
            return null;
        }

        if (!midpointCache.has(key)) {
            if (Mesh.vertexCount(vertices, stride) >= maxVertexCount) {
                return null;
            }

            const midpoint = Mesh.midpointVertex(vertices, stride, a, b);
            const index = Mesh.vertexCount(vertices, stride);
            Mesh.pushVertexArray(vertices, stride, midpoint);
            midpointCache.set(key, index);
        }

        return midpointCache.get(key);
    };

    const nextParts = [];
    let sourcePartIndex = 0;

    const resolvePartForOffset = (offset) => {
        while (sourcePartIndex < sourceParts.length - 1) {
            const part = sourceParts[sourcePartIndex];
            const start = Math.max(0, Math.trunc(number(part?.start, 0)));
            const end = start + Math.max(0, Math.trunc(number(part?.count, 0)));

            if (offset < end) {
                break;
            }

            sourcePartIndex += 1;
        }

        return sourceParts[sourcePartIndex] || sourceParts[0];
    };

    const appendTriangles = (target, triangles, part = null) => {
        const start = target.length;

        for (const triangle of triangles) {
            if (!Array.isArray(triangle) || triangle.length < 3) {
                continue;
            }

            const a = triangle[0];
            const b = triangle[1];
            const c = triangle[2];
            const currentVertexCount = Mesh.vertexCount(vertices, stride);

            if (
                target.length + 3 > maxIndexCount ||
                !Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c) ||
                a < 0 || b < 0 || c < 0 ||
                a >= currentVertexCount || b >= currentVertexCount || c >= currentVertexCount ||
                a === b || b === c || c === a
            ) {
                continue;
            }

            target.push(a, b, c);
        }

        const added = target.length - start;

        if (added <= 0) {
            return;
        }

        const sourcePart = part || sourceParts[0];
        const sourceKey = [
            sourcePart?.faceName || "",
            sourcePart?.name || "",
            sourcePart?.materialSlot || "",
        ].join(":");
        const previous = nextParts[nextParts.length - 1];

        if (!previous || previous.__sourceKey !== sourceKey || previous.start + previous.count !== start) {
            nextParts.push({
                ...sourcePart,
                start,
                count: 0,
                __sourceKey: sourceKey,
            });
        }

        nextParts[nextParts.length - 1].count += added;
    };

    const splitTriangle = (target, a, b, c, part) => {
        const original = [[a, b, c]];
        const hasAB = splitEdges.has(Mesh.edgeKey(a, b));
        const hasBC = splitEdges.has(Mesh.edgeKey(b, c));
        const hasCA = splitEdges.has(Mesh.edgeKey(c, a));
        const count = Number(hasAB) + Number(hasBC) + Number(hasCA);

        if (count === 0) {
            appendTriangles(target, original, part);
            return;
        }

        const ab = hasAB ? getMidpoint(a, b) : null;
        const bc = hasBC ? getMidpoint(b, c) : null;
        const ca = hasCA ? getMidpoint(c, a) : null;

        if ((hasAB && ab === null) || (hasBC && bc === null) || (hasCA && ca === null)) {
            appendTriangles(target, original, part);
            return;
        }

        let proposed;

        if (count === 3) {
            proposed = [
                [a, ab, ca],
                [ab, b, bc],
                [ca, bc, c],
                [ab, bc, ca],
            ];
        } else if (count === 1) {
            if (hasAB) {
                proposed = [[a, ab, c], [ab, b, c]];
            } else if (hasBC) {
                proposed = [[b, bc, a], [bc, c, a]];
            } else {
                proposed = [[c, ca, b], [ca, a, b]];
            }
        } else if (hasAB && hasBC) {
            proposed = [[b, bc, ab], [a, ab, c], [ab, bc, c]];
        } else if (hasBC && hasCA) {
            proposed = [[c, ca, bc], [b, bc, a], [bc, ca, a]];
        } else {
            proposed = [[a, ab, ca], [b, c, ab], [ab, c, ca]];
        }

        appendTriangles(
            target,
            target.length + proposed.length * 3 <= maxIndexCount ? proposed : original,
            part,
        );
    };

    const nextIndices = [];

    for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = toIndex(indices[i]);
        const b = toIndex(indices[i + 1]);
        const c = toIndex(indices[i + 2]);

        if (!validIndexForCount(a, Mesh.vertexCount(vertices, stride)) || !validIndexForCount(b, Mesh.vertexCount(vertices, stride)) || !validIndexForCount(c, Mesh.vertexCount(vertices, stride))) {
            continue;
        }

        splitTriangle(nextIndices, a, b, c, resolvePartForOffset(i));
    }

    if (nextIndices.length < 3) {
        return finishAnchorOnly({ limited: true });
    }

    const changed = anchor.changed || nextIndices.length !== indices.length || midpointCache.size > 0;
    const outputIndices = changed ? nextIndices : indices;
    const compacted = changed
        ? compactReferencedGeometry(vertices, outputIndices, stride)
        : { vertices, indices: outputIndices, remap: new Map(), removedVertices: 0 };
    const anchorVertex = Number.isInteger(anchor.anchorVertex) && compacted.remap?.has(anchor.anchorVertex)
        ? compacted.remap.get(anchor.anchorVertex)
        : anchor.anchorVertex;

    return {
        vertices: compacted.vertices,
        indices: compacted.indices,
        parts: nextParts.length
            ? nextParts.map(({ __sourceKey, ...part }) => {
                if(!__sourceKey) console.log(__sourceKey, 'Topology __sourceKey is missing');
                return part
            })
            : sourceParts,
        changed,
        limited: anchor.limited === true || projectedNewVertices >= maxNewVertices || nextIndices.length >= maxIndexCount,
        addedVertices: (anchor.addedVertices || 0) + midpointCache.size,
        removedVertices: Math.max(0, Math.trunc(number(compacted.removedVertices, 0))),
        splitTriangles: (anchor.splitTriangles || 0) + selectedTriangleSplits,
        anchorVertex,
    };
};

const collectBrushInfluence = ({ vertices, indices, stride, hit, brush }) => {
    const affected = new Set();
    const triangleOffsets = [];
    const hitPoint = Array.isArray(hit?.point) ? hit.point : null;
    const vertexCount = Mesh.vertexCount(vertices, stride);

    if (!hitPoint || vertexCount <= 0 || !indices?.length) {
        return { vertices: [], triangleOffsets: [] };
    }

    const radius = Math.max(0.0001, number(brush?.radius, 0.18));
    const radiusSq = radius * radius;
    const paddedRadiusSq = radiusSq * 1.12;
    const graph = buildTriangleAdjacency(indices, vertexCount);
    const seedTriangle = Math.trunc(number(hit?.triangleIndex, -1));
    const seed = graph.triangles[seedTriangle] ? seedTriangle : -1;

    if (seed < 0) {
        return { vertices: [], triangleOffsets: [] };
    }

    const distSq = (x, y, z) => {
        const dx = x - hitPoint[0];
        const dy = y - hitPoint[1];
        const dz = z - hitPoint[2];
        return dx * dx + dy * dy + dz * dz;
    };
    const addTriangle = triangle => {
        affected.add(triangle.a);
        affected.add(triangle.b);
        affected.add(triangle.c);
        triangleOffsets.push(triangle.offset);
    };
    const triangleInBrush = (triangle, forceSeed = false) => {
        const ab = vertexBase(triangle.a, stride);
        const bb = vertexBase(triangle.b, stride);
        const cb = vertexBase(triangle.c, stride);
        const ax = vertices[ab];
        const ay = vertices[ab + 1];
        const az = vertices[ab + 2];
        const bx = vertices[bb];
        const by = vertices[bb + 1];
        const bz = vertices[bb + 2];
        const cx = vertices[cb];
        const cy = vertices[cb + 1];
        const cz = vertices[cb + 2];

        if (!finiteValues([ax, ay, az, bx, by, bz, cx, cy, cz])) {
            return false;
        }

        if (forceSeed) {
            return true;
        }

        const nearestVertexDistSq = Math.min(
            distSq(ax, ay, az),
            distSq(bx, by, bz),
            distSq(cx, cy, cz),
        );
        const centroidDistSq = distSq(
            (ax + bx + cx) / 3,
            (ay + by + cy) / 3,
            (az + bz + cz) / 3,
        );

        return nearestVertexDistSq <= paddedRadiusSq || centroidDistSq <= radiusSq;
    };

    const queue = [seed];
    const visited = new Set(queue);

    while (queue.length) {
        const triangleIndex = queue.shift();
        const triangle = graph.triangles[triangleIndex];

        if (!triangle) {
            continue;
        }

        const accepted = triangleInBrush(triangle, triangleIndex === seed);

        if (!accepted) {
            continue;
        }

        addTriangle(triangle);

        for (const neighbor of triangle.neighbors || []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    return {
        vertices: Array.from(affected),
        triangleOffsets,
    };
};

const buildScopedNeighbors = (indices, vertices, stride, affectedVertices = []) => {
    const affected = new Set(affectedVertices);
    const neighbors = new Map();

    if (!affected.size) {
        return neighbors;
    }

    const vertexCount = Mesh.vertexCount(vertices, stride);
    const graph = buildTriangleAdjacency(indices, vertexCount);
    const touchedTriangles = new Set();

    affected.forEach(vertex => {
        (graph.vertexTriangles.get(vertex) || []).forEach(triangleIndex => touchedTriangles.add(triangleIndex));
    });

    const addNeighbor = (from, to) => {
        if (!affected.has(from)) {
            return;
        }

        if (!neighbors.has(from)) {
            neighbors.set(from, []);
        }

        neighbors.get(from).push(Mesh.read3(vertices, stride, to));
    };

    touchedTriangles.forEach(triangleIndex => {
        const triangle = graph.triangles[triangleIndex];

        if (!triangle) {
            return;
        }

        const { a, b, c } = triangle;

        addNeighbor(a, b);
        addNeighbor(a, c);
        addNeighbor(b, a);
        addNeighbor(b, c);
        addNeighbor(c, a);
        addNeighbor(c, b);
    });

    return neighbors;
};

const buildVertexDirtyRanges = (indices = [], stride = Mesh.STRIDE) => {
    const sorted = Array.from(new Set(indices))
        .filter(index => Number.isInteger(index) && index >= 0)
        .sort((a, b) => a - b);
    const ranges = [];

    for (const index of sorted) {
        const previous = ranges[ranges.length - 1];

        if (previous && previous.vertexStart + previous.vertexCount === index) {
            previous.vertexCount += 1;
            previous.start = previous.vertexStart * stride;
            previous.count = previous.vertexCount * stride;
            continue;
        }

        ranges.push({
            vertexStart: index,
            vertexCount: 1,
            start: index * stride,
            count: stride,
        });
    }

    return ranges;
};

const normalizeGpuRuntimeFlags = (brush = {}, refine = {}, influence = {}) => ({
    schema: "topology-runtime.v1",
    target: "webgl2",
    cpuRole: "topology-selection-and-index-authoring",
    gpuRole: "dynamic-vbo-ibo-upload-and-instanced-draw",
    dynamicTopology: refine.changed === true,
    dirtyVertexCount: Array.isArray(influence.vertices) ? influence.vertices.length : 0,
    dirtyTriangleCount: Array.isArray(influence.triangleOffsets) ? influence.triangleOffsets.length : 0,
    addedVertices: Math.max(0, Math.trunc(number(refine.addedVertices, 0))),
    removedVertices: Math.max(0, Math.trunc(number(refine.removedVertices, 0))),
    splitTriangles: Math.max(0, Math.trunc(number(refine.splitTriangles, 0))),
    anchorVertex: Number.isInteger(refine.anchorVertex) ? refine.anchorVertex : -1,
    detailPercent: clamp(brush.detailPercent ?? 0, 0, 200),
});

export class Topology {
    static refineBrush(args = {}) {
        return refineMeshInBrush(args);
    }

    static collectBrushInfluence(args = {}) {
        return collectBrushInfluence(args);
    }

    static buildScopedNeighbors(indices, vertices, stride, affectedVertices = []) {
        return buildScopedNeighbors(indices, vertices, stride, affectedVertices);
    }

    static buildVertexDirtyRanges(indices = [], stride = Mesh.STRIDE) {
        return buildVertexDirtyRanges(indices, stride);
    }

    static describeBrushRuntime(brush = {}, refine = {}, influence = {}) {
        return normalizeGpuRuntimeFlags(brush, refine, influence);
    }

    static createBrushRuntimePlan({ vertices, indices, stride, hit, brush, parts = [] } = {}) {
        const refine = Topology.refineBrush({ vertices, indices, stride, hit, brush, parts });
        const nextIndices = refine.indices || indices;
        const influence = Topology.collectBrushInfluence({
            vertices,
            indices: nextIndices,
            stride,
            hit,
            brush,
        });

        return {
            refine,
            influence,
            gpu: Topology.describeBrushRuntime(brush, refine, influence),
        };
    }
}
