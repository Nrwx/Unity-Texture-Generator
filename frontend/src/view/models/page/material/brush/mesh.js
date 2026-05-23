import { BRUSH_MODIFIERS, resolveBrushModifier } from "./modifier";
import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";
import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { UV } from "@/view/models/page/material/core/UV/UV";
import { clamp } from "@/utils/tools";
import { number } from "@/utils/math";

const POSITION_OFFSET = Mesh.POSITION_OFFSET;
const NORMAL_OFFSET = Mesh.NORMAL_OFFSET;

/**
 * Computes UVs for a triangle using either centroid average or barycentric weights.
 */
const triangleUv = (uvA, uvB, uvC, barycentric = null) => {
    if (!barycentric) {
        return [
            (uvA[0] + uvB[0] + uvC[0]) / 3,
            (uvA[1] + uvB[1] + uvC[1]) / 3,
        ];
    }

    return [
        uvA[0] * barycentric[0] + uvB[0] * barycentric[1] + uvC[0] * barycentric[2],
        uvA[1] * barycentric[0] + uvB[1] * barycentric[1] + uvC[1] * barycentric[2],
    ];
};

/**
 * Normalizes brush config.
 */
const normalizeBrush = (brush) => ({
    enabled: brush?.enabled === true,
    mode: String(brush?.mode || "draw"),
    radius: Math.max(0.001, number(brush?.radius, 0.18)),
    strength: Math.max(0, number(brush?.strength, 0.04)),
    sharpness: clamp(brush?.sharpness ?? 0.35, 0, 1),
    hardness: clamp(brush?.hardness ?? brush?.sharpness ?? 0.35, 0, 1),
    spacing: clamp(brush?.spacing ?? 0.18, 0.02, 1),
    softness: clamp(brush?.softness ?? 0.68, 0, 1),
    falloffOffset: clamp(brush?.falloffOffset ?? brush?.offset ?? 0, 0, 0.95),
    invert: brush?.invert === true,
    detailEnabled: brush?.detail?.enabled === true || brush?.dynamicTopology === true,
    detailPercent: clamp(brush?.detail?.percent ?? brush?.detailPercent ?? 0, 0, 200),
    detailTolerance: clamp(brush?.detail?.tolerance ?? brush?.detailTolerance ?? 0.42, 0.01, 1),
    detailMaxTriangles: Math.max(128, Math.trunc(number(brush?.detail?.maxTriangles, 4096))),
    texture: brush?.texture || "",
    opacity: clamp(brush?.opacity ?? brush?.strength ?? 1, 0, 1),
    textureMode: brush?.textureMode || "alpha",
});

/**
 * Subdivision inside brush radius.
 */
const refineMeshInBrush = ({ vertices, indices, stride, hit, brush }) => {
    if (!brush.detailEnabled || brush.detailPercent <= 0 || indices.length >= brush.detailMaxTriangles * 3) {
        return { vertices, indices, changed: false };
    }

    const radius = brush.radius;
    const detailFactor = clamp(brush.detailPercent / 100, 0, 2);
    const targetEdge = Math.max(0.003, radius * (0.78 - detailFactor * 0.34) * brush.detailTolerance);

    const nextIndices = [];
    let changed = false;
    const midpointCache = new Map();

    const getMidpoint = (a, b) => {
        const key = Mesh.edgeKey(a, b);

        if (!midpointCache.has(key)) {
            const midpoint = Mesh.midpointVertex(vertices, stride, a, b);
            const index = Mesh.vertexCount(vertices, stride);
            Mesh.pushVertexArray(vertices, stride, midpoint);
            midpointCache.set(key, index);
        }

        return midpointCache.get(key);
    };

    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];

        const pa = Mesh.read3(vertices, stride, a, POSITION_OFFSET);
        const pb = Mesh.read3(vertices, stride, b, POSITION_OFFSET);
        const pc = Mesh.read3(vertices, stride, c, POSITION_OFFSET);

        const centroid = [
            (pa[0] + pb[0] + pc[0]) / 3,
            (pa[1] + pb[1] + pc[1]) / 3,
            (pa[2] + pb[2] + pc[2]) / 3,
        ];

        const inside =
            Vector.from(centroid).distance(hit.point) <= radius ||
            Math.min(
                Vector.from(pa).distance(hit.point),
                Vector.from(pb).distance(hit.point),
                Vector.from(pc).distance(hit.point),
            ) <= radius;

        const maxEdge = Math.max(
            Vector.from(pa).distance(pb),
            Vector.from(pb).distance(pc),
            Vector.from(pc).distance(pa),
        );

        const shouldSplit = inside && maxEdge > targetEdge;

        if (!shouldSplit) {
            nextIndices.push(a, b, c);
            continue;
        }

        const ab = getMidpoint(a, b);
        const bc = getMidpoint(b, c);
        const ca = getMidpoint(c, a);

        nextIndices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
        changed = true;
    }

    return { vertices, indices: changed ? nextIndices : indices, changed };
};

/**
 * UV at hit triangle using UV class.
 */
const createHitUv = (vertices, indices, stride, hit) => {
    const triangleIndex = Math.max(0, Math.trunc(number(hit?.triangleIndex, 0)));
    const offset = triangleIndex * 3;

    if (offset + 2 >= indices.length) return null;

    const a = indices[offset];
    const b = indices[offset + 1];
    const c = indices[offset + 2];

    return triangleUv(
        UV.getVertexUv({ vertices, stride }, a),
        UV.getVertexUv({ vertices, stride }, b),
        UV.getVertexUv({ vertices, stride }, c),
        Array.isArray(hit.barycentric) ? hit.barycentric : null,
    );
};

export const createDefaultSculptBrush = () => ({
    enabled: false,
    mode: "draw",
    radius: 0.18,
    strength: 0.04,
    sharpness: 0.35,
    hardness: 0.35,
    spacing: 0.18,
    softness: 0.68,
    falloffOffset: 0,
    invert: false,
    dynamicTopology: false,
    detail: {
        enabled: false,
        percent: 100,
        tolerance: 0.42,
        maxTriangles: 4096,
    },
    texture: "",
    opacity: 1,
    textureMode: "alpha",
});

export const SCULPT_BRUSH_MODES = Object.freeze(Object.keys(BRUSH_MODIFIERS));

export const buildSculptBrushOverlay = ({ brush: rawBrush, hit = null } = {}) => {
    const brush = normalizeBrush(rawBrush);

    if (!brush.enabled || !hit?.point) {
        return { enabled: false };
    }

    return {
        enabled: true,
        point: hit.point,
        normal: Vector.normalize(hit.normal || [0, 0, 1], [0, 0, 1]).toArray(),
        radius: brush.radius,
        softness: brush.softness,
        falloffOffset: brush.falloffOffset,
        color:
            brush.mode === "smooth"
                ? [0.45, 0.86, 1.0, 0.92]
                : brush.mode === "inflate" || brush.mode === "extrude"
                    ? [1.0, 0.72, 0.24, 0.92]
                    : [0.82, 0.58, 1.0, 0.9],
    };
};

export const applySculptBrushToMesh = ({ mesh, hit, brush: rawBrush }) => {
    if (!mesh || !hit?.point) return { mesh, changed: false };

    const brush = normalizeBrush(rawBrush);
    if (!brush.enabled) return { mesh, changed: false };

    const editable = Mesh.normalizeEditableMesh(mesh);
    if (!editable) return { mesh, changed: false };

    const vertices = editable.vertices;
    let indices = editable.indices;
    const stride = editable.stride;

    const refine = refineMeshInBrush({ vertices, indices, stride, hit, brush });
    indices = refine.indices;

    const neighbors = Mesh.buildNeighbors(indices, vertices, stride);
    const modifier = resolveBrushModifier(brush.mode);

    const nextMesh = {
        ...mesh,
        __stampWritten: false,
    };

    const hitContext = {
        ...hit,
        uv: createHitUv(vertices, indices, stride, hit),
        normal: Vector.normalize(hit.normal || [0, 0, 1], [0, 0, 1]).toArray(),
    };

    let deformed = false;

    for (let index = 0; index < Mesh.vertexCount(vertices, stride); index++) {
        const position = Mesh.read3(vertices, stride, index, POSITION_OFFSET);
        const distance = Vector.from(position).distance(hitContext.point);

        if (distance > brush.radius && brush.mode !== "stamp" && brush.mode !== "textureStamp") {
            continue;
        }

        const vertex = {
            index,
            original: position,
            position: position.slice(),
            normal: Mesh.read3(vertices, stride, index, NORMAL_OFFSET),
            distance,
        };

        modifier.apply({
            mesh: nextMesh,
            vertex,
            brush,
            hit: hitContext,
            neighbors,
        });

        if (
            distance <= brush.radius &&
            (vertex.position[0] !== position[0] ||
                vertex.position[1] !== position[1] ||
                vertex.position[2] !== position[2])
        ) {
            Mesh.write3(vertices, stride, index, POSITION_OFFSET, vertex.position);
            deformed = true;
        }
    }

    const stamped = nextMesh.__stampWritten === true;
    delete nextMesh.__stampWritten;

    if (!deformed && !refine.changed && !stamped) {
        return { mesh, changed: false };
    }

    const finalized = Mesh.finalizeMesh(nextMesh, {
        vertices,
        indices,
        stride,
        source: "sculpt",
        meta: {
            sculpted: true,
            brushRevision: Math.trunc(number(mesh.meta?.brushRevision, 0)) + 1,
        },
    });

    return { mesh: finalized, changed: true };
};