import { BRUSH_MODIFIERS, resolveBrushModifier } from "./modifier";
import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";
import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { UV } from "@/view/models/page/material/core/UV/UV";
import { Topology } from "@/view/models/page/material/core/Topology/Topology";
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
const normalizeBrush = (brush) => {
    const maxTriangles = Math.max(128, Math.trunc(number(
        brush?.detail?.maxTriangles ??
        brush?.detail?.maxSubdivisionsPerStroke ??
        brush?.detailMaxTriangles ??
        brush?.maxSubdivisionsPerStroke,
        4096
    )));
    const maxNewVerticesPerStep = Math.max(1, Math.trunc(number(
        brush?.detail?.maxNewVerticesPerStep ??
        brush?.detail?.maxVerticesPerStep ??
        brush?.detail?.batchSize ??
        brush?.detailBatchSize,
        Math.min(96, Math.max(16, Math.ceil(maxTriangles * 0.018)))
    )));
    const maxTriangleSplitsPerStep = Math.max(1, Math.trunc(number(
        brush?.detail?.maxTriangleSplitsPerStep ??
        brush?.detail?.maxSplitsPerStep ??
        brush?.detailTriangleBatchSize,
        Math.min(128, Math.max(24, Math.ceil(maxTriangles * 0.024)))
    )));

    return {
        enabled: brush?.enabled === true,
        mode: String(brush?.tool || brush?.mode || "draw"),
        radius: Math.max(0.001, number(brush?.radius, 0.18)),
        strength: Math.max(0, number(brush?.strength, 0.04)),
        sharpness: clamp(brush?.sharpness ?? 0.35, 0, 1),
        hardness: clamp(brush?.hardness ?? brush?.sharpness ?? 0.35, 0, 1),
        spacing: clamp(brush?.spacing ?? 0.18, 0.02, 1),
        softness: clamp(brush?.softness ?? brush?.smoothness ?? 0.68, 0, 1),
        falloffOffset: clamp(brush?.falloffOffset ?? brush?.offset ?? 0, 0, 0.95),
        invert: brush?.invert === true,
        detailEnabled: brush?.detail?.enabled === true || brush?.dynamicTopology === true,
        detailPercent: clamp(
            brush?.detail?.detailPercent ??
            brush?.detail?.percent ??
            brush?.detailPercent ??
            0,
            0,
            200
        ),
        detailTolerance: clamp(brush?.detail?.tolerance ?? brush?.detailTolerance ?? 0.42, 0.01, 1),
        detailMaxTriangles: maxTriangles,
        detailMaxVertices: Math.max(64, Math.trunc(number(
            brush?.detail?.maxVertices ??
            brush?.detailMaxVertices,
            Math.max(maxTriangles + 1, maxTriangles * 2)
        ))),
        detailMaxNewVerticesPerStep: maxNewVerticesPerStep,
        detailMaxTriangleSplitsPerStep: maxTriangleSplitsPerStep,
        detailMinEdge: Math.max(0.0005, number(brush?.detail?.minEdge ?? brush?.detailMinEdge, 0.003)),
        texture: brush?.texture || "",
        opacity: clamp(brush?.opacity ?? brush?.strength ?? 1, 0, 1),
        textureMode: brush?.textureMode || "alpha",
    };
};

/**
 * Brush-local topology work lives in the core Topology class so sculpt input,
 * DynTopo subdivision and renderer dirty ranges share one implementation path.
 */

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
    tool: "draw",
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
        detailPercent: 100,
        tolerance: 0.42,
        maxTriangles: 4096,
        maxSubdivisionsPerStroke: 4096,
        maxVertices: 8192,
        maxNewVerticesPerStep: 96,
        maxTriangleSplitsPerStep: 128,
        minEdge: 0.003,
    },
    texture: "",
    opacity: 1,
    textureMode: "alpha",
});

export const SCULPT_BRUSH_MODES = Object.freeze(Object.keys(BRUSH_MODIFIERS));


const assignMeshInPlace = (target, source) => {
    if (!target || !source || target === source) {
        return source || target;
    }

    Object.keys(target).forEach(key => {
        if (!(key in source) && key !== "__stampWritten") {
            delete target[key];
        }
    });

    Object.assign(target, source);
    return target;
};

const resolveSculptUv = (mesh, explicitUv = null, context = {}) => {
    const sourceUv = explicitUv || mesh?.uv || mesh?.meta?.uv || null;

    if (!mesh?.vertices || !mesh?.indices) {
        return sourceUv;
    }

    return UV.syncFromMeshVertexUvs(mesh, sourceUv || {}, {
        source: "sculpt",
        name: "sculpt",
        primitive: mesh?.primitive || mesh?.settings?.primitive || "mesh",
        ...context,
    });
};

const isFloat32Vertices = value => value instanceof Float32Array;
const isIndexTypedArray = value => value instanceof Uint16Array || value instanceof Uint32Array;

const ensureDirectEditableMesh = mesh => {
    if (!mesh?.vertices || !mesh?.indices) {
        return null;
    }

    const sourceStride = Math.max(3, Math.trunc(number(mesh.stride, Mesh.STRIDE)));

    if (sourceStride !== Mesh.STRIDE || !isFloat32Vertices(mesh.vertices) || !isIndexTypedArray(mesh.indices)) {
        const editable = Mesh.normalizeEditableMesh(mesh);

        if (!editable) {
            return null;
        }

        mesh.stride = editable.stride;
        mesh.vertices = new Float32Array(editable.vertices);
        mesh.indices = Mesh.createIndexArray(editable.indices, mesh.indexType);
        mesh.indexType = mesh.indices instanceof Uint32Array ? "uint32" : "uint16";
        mesh.count = mesh.indices.length;
        mesh.meta = {
            ...(mesh.meta || {}),
            vertexLayout: "position-normal-uv-tangent",
            runtimeInstanced: true,
        };
    }

    return {
        stride: Math.max(3, Math.trunc(number(mesh.stride, Mesh.STRIDE))),
        vertices: mesh.vertices,
        indices: mesh.indices,
        vertexCount: Mesh.vertexCount(mesh.vertices, mesh.stride),
    };
};

const ensureTopologyEditableMesh = mesh => {
    const editable = Mesh.normalizeEditableMesh(mesh);

    if (!editable) {
        return null;
    }

    return {
        ...editable,
        vertices: Array.isArray(editable.vertices) ? editable.vertices : Array.from(editable.vertices || []),
        indices: Array.isArray(editable.indices) ? editable.indices : Array.from(editable.indices || []),
    };
};

const writeBoundsFromDirtyVertices = (mesh, vertices, stride, dirtyVertexIndices = []) => {
    const existing = mesh.bounds && Array.isArray(mesh.bounds.min) && Array.isArray(mesh.bounds.max)
        ? {
            min: mesh.bounds.min.slice(0, 3),
            max: mesh.bounds.max.slice(0, 3),
        }
        : {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
        };

    for (const index of dirtyVertexIndices) {
        const base = index * stride + POSITION_OFFSET;
        const x = number(vertices[base], 0);
        const y = number(vertices[base + 1], 0);
        const z = number(vertices[base + 2], 0);

        existing.min[0] = Math.min(existing.min[0], x);
        existing.min[1] = Math.min(existing.min[1], y);
        existing.min[2] = Math.min(existing.min[2], z);
        existing.max[0] = Math.max(existing.max[0], x);
        existing.max[1] = Math.max(existing.max[1], y);
        existing.max[2] = Math.max(existing.max[2], z);
    }

    if (existing.min.every(Number.isFinite) && existing.max.every(Number.isFinite)) {
        mesh.bounds = existing;
    }
};

const recomputeDirtyNormals = (vertices, indices, stride, dirtyVertexIndices = [], triangleOffsets = []) => {
    const dirtyVertices = new Set(dirtyVertexIndices.filter(index => Number.isInteger(index) && index >= 0));

    if (!dirtyVertices.size) {
        return;
    }

    const normalSums = new Map();
    dirtyVertices.forEach(index => normalSums.set(index, [0, 0, 0]));

    const addTriangleNormal = offset => {
        if (offset < 0 || offset + 2 >= indices.length) {
            return;
        }

        const a = Math.trunc(Number(indices[offset]));
        const b = Math.trunc(Number(indices[offset + 1]));
        const c = Math.trunc(Number(indices[offset + 2]));

        if (![a, b, c].some(index => dirtyVertices.has(index))) {
            return;
        }

        const pa = Mesh.read3(vertices, stride, a, POSITION_OFFSET);
        const pb = Mesh.read3(vertices, stride, b, POSITION_OFFSET);
        const pc = Mesh.read3(vertices, stride, c, POSITION_OFFSET);
        const normal = Mesh.triangleNormal(pa, pb, pc);

        [a, b, c].forEach(index => {
            const sum = normalSums.get(index);

            if (!sum) {
                return;
            }

            sum[0] += normal[0];
            sum[1] += normal[1];
            sum[2] += normal[2];
        });
    };

    const offsets = Array.isArray(triangleOffsets) && triangleOffsets.length
        ? triangleOffsets
        : [];

    offsets.forEach(offset => addTriangleNormal(Math.trunc(Number(offset))));

    dirtyVertices.forEach(index => {
        const normal = Mesh.normalize3(normalSums.get(index), Mesh.read3(vertices, stride, index, NORMAL_OFFSET));
        Mesh.write3(vertices, stride, index, normal, NORMAL_OFFSET);
    });
};

const finalizeDirectSculptMesh = ({ mesh, vertices, indices, stride, brush, refine, influence, dirtyVertexIndices }) => {
    const geometryDirtyRanges = Topology.buildVertexDirtyRanges(dirtyVertexIndices, stride);

    recomputeDirtyNormals(vertices, indices, stride, dirtyVertexIndices, influence.triangleOffsets);
    writeBoundsFromDirtyVertices(mesh, vertices, stride, dirtyVertexIndices);

    mesh.vertices = vertices;
    mesh.indices = indices;
    mesh.stride = stride;
    mesh.indexType = indices instanceof Uint32Array ? "uint32" : "uint16";
    mesh.count = indices.length;
    mesh.meta = {
        ...(mesh.meta || {}),
        source: "sculpt",
        sculpted: true,
        sculptMode: brush.mode,
        sculptStrength: brush.strength,
        brushRadius: brush.radius,
        brushRevision: Math.trunc(number(mesh.meta?.brushRevision, 0)) + 1,
        editRevision: Math.trunc(number(mesh.meta?.editRevision, 0)) + 1,
        dynamicTopology: mesh.meta?.dynamicTopology === true,
        topologyRuntime: Topology.describeBrushRuntime(brush, refine, influence),
        geometryDirtyRanges,
        runtimeInstanced: true,
        vertexLayout: "position-normal-uv-tangent",
    };

    return mesh;
};

export const buildSculptBrushOverlay = ({ brush: rawBrush, hit = null } = {}) => {
    const brush = normalizeBrush(rawBrush);

    if (!brush.enabled || !hit?.point) {
        return { enabled: false };
    }

    return {
        enabled: true,
        point: hit.worldPoint || hit.point,
        normal: Vector.normalize(hit.worldNormal || hit.normal || [0, 0, 1], [0, 0, 1]).toArray(),
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

export const applySculptBrushToMesh = ({ mesh, hit, brush: rawBrush, uv = null, uvBitmap = null, mutateInPlace = false }) => {
    if (!mesh || !hit?.point) return { mesh, changed: false };

    const brush = normalizeBrush(rawBrush);
    if (!brush.enabled) return { mesh, changed: false };

    const editable = brush.detailEnabled
        ? ensureTopologyEditableMesh(mesh)
        : ensureDirectEditableMesh(mesh);
    if (!editable) return { mesh, changed: false };

    const vertices = editable.vertices;
    let indices = editable.indices;
    const stride = editable.stride;
    const hitUv = createHitUv(vertices, indices, stride, hit);

    const refine = brush.detailEnabled
        ? Topology.refineBrush({ vertices, indices, stride, hit, brush, parts: mesh.parts || [] })
        : { vertices, indices, parts: mesh.parts || [], changed: false, limited: false, addedVertices: 0, splitTriangles: 0 };
    indices = refine.indices;

    const modifier = resolveBrushModifier(brush.mode);
    const stampMode = brush.mode === "stamp" || brush.mode === "textureStamp";
    const influence = stampMode
        ? { vertices: [], triangleOffsets: [] }
        : Topology.collectBrushInfluence({ vertices, indices, stride, hit, brush });
    const neighbors = brush.mode === "smooth"
        ? Topology.buildScopedNeighbors(indices, vertices, stride, influence.vertices)
        : new Map();

    const nextMesh = mutateInPlace
        ? mesh
        : {
            ...mesh,
        };
    nextMesh.__stampWritten = false;

    const hitContext = {
        ...hit,
        uv: hitUv || createHitUv(vertices, indices, stride, hit),
        normal: Vector.normalize(hit.normal || [0, 0, 1], [0, 0, 1]).toArray(),
    };

    let deformed = false;
    const dirtyVertexIndices = [];

    const radiusSq = brush.radius * brush.radius;
    const hitPoint = hitContext.point || [0, 0, 0];

    if (stampMode) {
        modifier.apply({
            mesh: nextMesh,
            vertex: {
                index: -1,
                original: hitPoint,
                position: hitPoint.slice(),
                normal: hitContext.normal,
                distance: 0,
            },
            brush,
            hit: hitContext,
            neighbors,
        });
    }

    for (const index of influence.vertices) {
        const base = index * stride + POSITION_OFFSET;
        const px = vertices[base];
        const py = vertices[base + 1];
        const pz = vertices[base + 2];
        const dx = px - hitPoint[0];
        const dy = py - hitPoint[1];
        const dz = pz - hitPoint[2];
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq > radiusSq) {
            continue;
        }

        const position = [px, py, pz];
        const vertex = {
            index,
            original: position,
            position: position.slice(),
            normal: Mesh.read3(vertices, stride, index, NORMAL_OFFSET),
            distance: Math.sqrt(distanceSq),
        };

        modifier.apply({
            mesh: nextMesh,
            vertex,
            brush,
            hit: hitContext,
            neighbors,
        });

        if (
            vertex.position[0] !== position[0] ||
            vertex.position[1] !== position[1] ||
            vertex.position[2] !== position[2]
        ) {
            Mesh.write3(vertices, stride, index, vertex.position, POSITION_OFFSET);
            dirtyVertexIndices.push(index);
            deformed = true;
        }
    }

    const stamped = nextMesh.__stampWritten === true;
    delete nextMesh.__stampWritten;

    if (!deformed && !refine.changed && !stamped) {
        return { mesh, changed: false };
    }

    if (mutateInPlace && !refine.changed && !stamped) {
        const finalized = finalizeDirectSculptMesh({
            mesh,
            vertices,
            indices,
            stride,
            brush,
            refine,
            influence,
            dirtyVertexIndices,
        });

        return { mesh: finalized, uv, changed: true };
    }

    const finalized = Mesh.finalizeMesh(nextMesh, {
        vertices,
        indices,
        stride,
        source: "sculpt",
        meta: {
            ...(nextMesh.meta || {}),
            sculpted: true,
            sculptMode: brush.mode,
            sculptStrength: brush.strength,
            brushRadius: brush.radius,
            brushRevision: Math.trunc(number(mesh.meta?.brushRevision, 0)) + 1,
            dynamicTopology: refine.changed === true || mesh.meta?.dynamicTopology === true,
            dynTopoLimited: refine.limited === true,
            dynTopoAddedVertices: Math.max(0, Math.trunc(number(refine.addedVertices, 0))),
            dynTopoSplitTriangles: Math.max(0, Math.trunc(number(refine.splitTriangles, 0))),
            dynTopoMaxTriangles: brush.detailMaxTriangles,
            dynTopoMaxVertices: brush.detailMaxVertices,
            topologyRuntime: Topology.describeBrushRuntime(brush, refine, influence),
            geometryDirtyRanges: refine.changed === true ? [] : Topology.buildVertexDirtyRanges(dirtyVertexIndices, stride),
        },
    });

    if (Array.isArray(refine.parts) && refine.parts.length) {
        finalized.parts = refine.parts.map(part => ({ ...part }));
    }

    const sourceUv = uv || finalized.uv || null;
    const uvNeedsSync = refine.changed === true || (
        sourceUv && (
            !Array.isArray(sourceUv.vertices) ||
            !Array.isArray(sourceUv.triangles) ||
            sourceUv.vertices.length === 0 ||
            sourceUv.triangles.length === 0 ||
            Math.trunc(number(sourceUv?.meta?.meshEditRevision, 0)) !== Math.trunc(number(finalized?.meta?.editRevision, 0))
        )
    );
    const nextUv = uvNeedsSync
        ? resolveSculptUv(finalized, sourceUv, { brush, bitmap: uvBitmap, hit })
        : sourceUv;

    if (nextUv) {
        finalized.uv = nextUv;
        finalized.meta = {
            ...(finalized.meta || {}),
            uvSynced: true,
            uvSource: "sculpt",
            uvRevision: Math.trunc(number(finalized.meta?.uvRevision, 0)) + 1,
            uvVertexCount: nextUv.vertices.length,
            uvTriangleCount: nextUv.triangles.length,
        };
    }

    const outputMesh = mutateInPlace ? assignMeshInPlace(mesh, finalized) : finalized;

    return { mesh: outputMesh, uv: nextUv, changed: true };
};
