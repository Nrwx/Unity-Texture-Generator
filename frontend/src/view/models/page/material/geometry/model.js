import {Volume} from "@/view/models/page/material/core/Volume/Volume";
import {Fluid} from "@/view/models/page/material/core/Fluid/Fluid";
import {FLUID_SOLVER_OPTIONS, FLUID_TYPE_OPTIONS, PRIMITIVE_OPTIONS, SUBDIVISION_TYPE_OPTIONS, UV_FIT_OPTIONS, VOLUME_FALLOFF_OPTIONS, VOLUME_MODE_OPTIONS} from "@/dataLayer/webgl";
import {clone} from "@/utils/tools";
import {isFiniteNumber} from "@/utils/math";

const toNumber = value => {
    const number = Number(value);
    return isFiniteNumber(number) ? number : 0;
};

export const geometryModelProps = {
    geometry: {
        type: Object,
        required: true
    },
};

export function geometryModel(props, emit) {
    const emitGeometry = () => {
        const geometry = clone(props.geometry, "json");

        emit("update:geometry", geometry);
        emit("change", geometry);
    };

    const setGeometryValue = (key, value) => {
        props.geometry[key] = value;
        emitGeometry();
    };

    const setGeometryNumber = (key, value) => {
        props.geometry[key] = toNumber(value);
        emitGeometry();
    };

    const setGeometryBoolean = (key, value) => {
        props.geometry[key] = value === true;
        emitGeometry();
    };

    const setVolumeValue = (key, value) => {
        props.geometry.volume = Volume.create({
            ...(props.geometry.volume || {}),
            [key]: value,
        });
        emitGeometry();
    };

    const setVolumeNumber = (key, value) => {
        setVolumeValue(key, toNumber(value));
    };

    const setVolumeBoolean = (key, value) => {
        setVolumeValue(key, value === true);
    };

    const setFluidValue = (key, value) => {
        props.geometry.fluid = Fluid.create({
            ...(props.geometry.fluid || {}),
            [key]: value,
        });
        emitGeometry();
    };

    const setFluidNumber = (key, value) => {
        setFluidValue(key, toNumber(value));
    };

    const setFluidBoolean = (key, value) => {
        setFluidValue(key, value === true);
    };

    return {
        PRIMITIVE_OPTIONS,
        UV_FIT_OPTIONS,
        SUBDIVISION_TYPE_OPTIONS,
        VOLUME_MODE_OPTIONS,
        VOLUME_FALLOFF_OPTIONS,
        FLUID_TYPE_OPTIONS,
        FLUID_SOLVER_OPTIONS,

        setGeometryValue,
        setGeometryNumber,
        setGeometryBoolean,
        setVolumeValue,
        setVolumeNumber,
        setVolumeBoolean,
        setFluidValue,
        setFluidNumber,
        setFluidBoolean,
    };
}

const GEOMETRY_CHUNK_SIZE = 4096;
const GEOMETRY_VERTEX_PRECISION = 6;
const HEAVY_GEOMETRY_KEYS = Object.freeze(["vertices", "indices"]);

const numericGeometryKeys = value => {
    if (!value || typeof value !== "object") {
        return [];
    }

    return Object.keys(value)
        .filter(key => /^\d+$/.test(key))
        .sort((a, b) => Number(a) - Number(b));
};

const isArrayLikeGeometry = value => (
    Array.isArray(value) ||
    ArrayBuffer.isView(value) ||
    Boolean(value && typeof value === "object" && Number.isInteger(Number(value.length))) ||
    numericGeometryKeys(value).length > 0
);

const toGeometryArray = value => {
    if (Array.isArray(value)) {
        return value.slice();
    }

    if (ArrayBuffer.isView(value)) {
        return Array.from(value);
    }

    if (value && typeof value === "object" && Number.isInteger(Number(value.length))) {
        return Array.from(value);
    }

    const numericKeys = numericGeometryKeys(value);

    if (numericKeys.length) {
        return numericKeys.map(key => value[key]);
    }

    return [];
};

export const hasRuntimeGeometry = (mesh = {}) => {
    const stride = Math.max(3, Math.trunc(Number(mesh?.stride || 11)));
    const vertices = toGeometryArray(mesh?.vertices);
    const indices = toGeometryArray(mesh?.indices);

    return vertices.length >= stride * 3 && indices.length >= 3;
};

const quantizeVertexValue = value => {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        return 0;
    }

    const scale = 10 ** GEOMETRY_VERTEX_PRECISION;
    return Math.round(numberValue * scale) / scale;
};

const quantizeIndexValue = value => Math.max(0, Math.trunc(Number(value) || 0));

const chunkArrayRange = (values = [], kind = "vertices", start = 0, count = null, chunkSize = GEOMETRY_CHUNK_SIZE) => {
    const chunks = [];
    const safeChunkSize = Math.max(256, Math.trunc(Number(chunkSize) || GEOMETRY_CHUNK_SIZE));
    const safeStart = Math.max(0, Math.trunc(Number(start) || 0));
    const end = count === null || count === undefined
        ? values.length
        : Math.min(values.length, safeStart + Math.max(0, Math.trunc(Number(count) || 0)));
    const quantize = kind === "indices" ? quantizeIndexValue : quantizeVertexValue;

    for (let chunkStart = safeStart; chunkStart < end; chunkStart += safeChunkSize) {
        const data = values
            .slice(chunkStart, Math.min(end, chunkStart + safeChunkSize))
            .map(quantize);

        chunks.push({
            key: `${kind}:${chunkStart}`,
            kind,
            start: chunkStart,
            count: data.length,
            data,
        });
    }

    return chunks;
};

const chunkArray = (values = [], kind = "vertices", chunkSize = GEOMETRY_CHUNK_SIZE) => (
    chunkArrayRange(values, kind, 0, null, chunkSize)
);


const normalizeDirtyValueRanges = (ranges = [], limit = 0, stride = 11) => {
    const max = Math.max(0, Math.trunc(Number(limit) || 0));

    if (!Array.isArray(ranges) || !ranges.length || max <= 0) {
        return [];
    }

    return ranges
        .map(range => {
            const start = Math.max(0, Math.trunc(Number(
                range?.start ??
                (Number(range?.vertexStart || 0) * stride)
            ) || 0));
            const count = Math.max(0, Math.trunc(Number(
                range?.count ??
                (Number(range?.vertexCount || 0) * stride)
            ) || 0));
            const end = Math.min(max, start + count);

            return end > start ? { start, count: end - start } : null;
        })
        .filter(Boolean)
        .sort((left, right) => left.start - right.start)
        .reduce((merged, range) => {
            const previous = merged[merged.length - 1];
            const previousEnd = previous ? previous.start + previous.count : -1;

            if (previous && range.start <= previousEnd) {
                previous.count = Math.max(previousEnd, range.start + range.count) - previous.start;
                return merged;
            }

            merged.push({ ...range });
            return merged;
        }, []);
};

const chunkDirtyVertexRanges = (vertices = [], ranges = [], chunkSize = GEOMETRY_CHUNK_SIZE) => (
    ranges.flatMap(range => chunkArrayRange(vertices, "vertices", range.start, range.count, chunkSize))
);

const arraySignature = values => {
    if (!values?.length) {
        return "0:";
    }

    const sampleCount = Math.min(12, values.length);
    const step = Math.max(1, Math.floor(values.length / sampleCount));
    const sample = [];

    for (let index = 0; index < values.length && sample.length < sampleCount; index += step) {
        sample.push(Number(values[index]) || 0);
    }

    sample.push(Number(values[values.length - 1]) || 0);
    return `${values.length}:${sample.join(",")}`;
};

export const buildGeometryManifest = (mesh = {}) => {
    const stride = Math.max(1, Math.trunc(Number(mesh?.stride || 11)));
    const vertices = toGeometryArray(mesh?.vertices);
    const indices = toGeometryArray(mesh?.indices);
    const vertexCount = Math.floor(vertices.length / stride);
    const maxIndex = indices.reduce((max, value) => Math.max(max, quantizeIndexValue(value)), 0);
    const editRevision = Math.trunc(Number(mesh?.meta?.editRevision || 0));
    const brushRevision = Math.trunc(Number(mesh?.meta?.brushRevision || 0));
    const uvRevision = Math.trunc(Number(mesh?.meta?.uvRevision || 0));

    return {
        schema: "geometry-heavy-manifest.v1",
        id: mesh?.id || "",
        primitive: mesh?.primitive || mesh?.settings?.primitive || "mesh",
        stride,
        indexType: mesh?.indexType === "uint32" || maxIndex > 65535 ? "uint32" : "uint16",
        vertex_count: vertexCount,
        vertex_value_count: vertices.length,
        index_count: indices.length,
        triangle_count: Math.floor(indices.length / 3),
        part_count: Array.isArray(mesh?.parts) ? mesh.parts.length : 0,
        bounds: clone(mesh?.bounds || {}, "json"),
        revision: Math.max(editRevision, brushRevision, uvRevision, 0),
        editRevision,
        brushRevision,
        uvRevision,
        quantization: {
            vertices: GEOMETRY_VERTEX_PRECISION,
            indices: 0,
        },
        signatures: {
            vertices: arraySignature(vertices),
            indices: arraySignature(indices),
        },
    };
};

export const buildGeometryPayload = (mesh = {}, options = {}) => {
    const vertices = toGeometryArray(mesh?.vertices);
    const indices = toGeometryArray(mesh?.indices);
    const manifest = buildGeometryManifest(mesh);
    const previousManifest = mesh?.geometry_manifest || mesh?.mesh_manifest || null;
    const chunkSize = Math.max(256, Math.trunc(Number(options.chunkSize || GEOMETRY_CHUNK_SIZE)));
    const dirtyRanges = Array.isArray(mesh?.meta?.geometryDirtyRanges)
        ? mesh.meta.geometryDirtyRanges
        : [];
    const allowPatch = options.mode === "patch" || options.allowPatch === true;
    const canPatch = allowPatch &&
        dirtyRanges.length > 0 &&
        previousManifest &&
        Math.trunc(Number(previousManifest.vertex_value_count || 0)) === vertices.length &&
        Math.trunc(Number(previousManifest.index_count || 0)) === indices.length;

    if (canPatch) {
        const chunks = dirtyRanges
            .map(range => {
                const start = Math.max(0, Math.trunc(Number(range.start ?? (Number(range.vertexStart || 0) * manifest.stride))));
                const count = Math.max(0, Math.trunc(Number(range.count ?? (Number(range.vertexCount || 0) * manifest.stride))));
                const data = vertices
                    .slice(start, start + count)
                    .map(quantizeVertexValue);

                return data.length
                    ? {
                        key: `vertices:${start}`,
                        kind: "vertices",
                        start,
                        count: data.length,
                        data,
                    }
                    : null;
            })
            .filter(Boolean);

        if (chunks.length) {
            return {
                schema: "geometry-heavy-payload.v1",
                mode: "patch",
                mesh_id: manifest.id,
                revision: manifest.revision,
                base_revision: Math.trunc(Number(previousManifest.revision ?? -1)),
                manifest,
                chunks,
            };
        }
    }

    if (allowPatch && previousManifest) {
        const previousVertexValueCount = Math.max(0, Math.trunc(Number(previousManifest.vertex_value_count || 0)));
        const previousIndexCount = Math.max(0, Math.trunc(Number(previousManifest.index_count || 0)));
        const growsTopology = vertices.length >= previousVertexValueCount &&
            indices.length >= previousIndexCount &&
            (vertices.length > previousVertexValueCount || indices.length > previousIndexCount);

        if (growsTopology) {
            const existingDirtyRanges = normalizeDirtyValueRanges(
                dirtyRanges,
                previousVertexValueCount,
                manifest.stride,
            );
            const chunks = [
                ...chunkDirtyVertexRanges(vertices, existingDirtyRanges, chunkSize),
                ...chunkArrayRange(vertices, "vertices", previousVertexValueCount, vertices.length - previousVertexValueCount, chunkSize),
                ...chunkArrayRange(indices, "indices", 0, indices.length, chunkSize),
            ];

            if (chunks.length) {
                return {
                    schema: "geometry-heavy-payload.v1",
                    mode: "patch",
                    mesh_id: manifest.id,
                    revision: manifest.revision,
                    base_revision: Math.trunc(Number(previousManifest.revision ?? -1)),
                    manifest,
                    chunks,
                };
            }
        }
    }

    return {
        schema: "geometry-heavy-payload.v1",
        mode: "replace",
        mesh_id: manifest.id,
        revision: manifest.revision,
        base_revision: Math.trunc(Number(options.baseRevision ?? previousManifest?.revision ?? -1)),
        manifest,
        chunks: [
            ...chunkArray(vertices, "vertices", chunkSize),
            ...chunkArray(indices, "indices", chunkSize),
        ],
    };
};

export const stripHeavyGeometry = (mesh = {}, manifest = buildGeometryManifest(mesh)) => {
    if (!mesh || typeof mesh !== "object") {
        return mesh;
    }

    const light = {
        ...mesh,
        vertices: [],
        indices: [],
        count: manifest.index_count,
        indexType: manifest.indexType,
        geometry_manifest: manifest,
        mesh_manifest: manifest,
        meta: {
            ...(mesh.meta || {}),
            geometryExternalized: true,
            geometryRevision: manifest.revision,
            vertexCount: manifest.vertex_count,
            indexCount: manifest.index_count,
            triangleCount: manifest.triangle_count,
        },
    };

    delete light.geometry_payload;
    return light;
};

const stripNestedMesh = value => {
    if (!value || typeof value !== "object") {
        return value;
    }

    if (!value.mesh) {
        return value;
    }

    const manifest = value.mesh.geometry_manifest || buildGeometryManifest(value.mesh);

    return {
        ...value,
        mesh: stripHeavyGeometry(value.mesh, manifest),
        mesh_manifest: value.mesh_manifest || manifest,
        geometry_manifest: value.geometry_manifest || manifest,
    };
};

export const compileGeometryMesh = (mesh = {}, options = {}) => {
    if (!mesh || typeof mesh !== "object") {
        return {
            mesh,
            geometry_manifest: null,
            geometry_payload: null,
        };
    }

    const vertexValues = toGeometryArray(mesh.vertices);
    const indexValues = toGeometryArray(mesh.indices);

    if (
        !isArrayLikeGeometry(mesh.vertices) ||
        !isArrayLikeGeometry(mesh.indices) ||
        ((vertexValues.length === 0 || indexValues.length === 0) && (mesh.geometry_manifest || mesh.mesh_manifest || mesh.meta?.geometryExternalized === true))
    ) {
        const manifest = mesh.geometry_manifest || mesh.mesh_manifest || null;
        return {
            mesh,
            geometry_manifest: manifest,
            geometry_payload: null,
        };
    }

    const geometry_payload = buildGeometryPayload(mesh, options);
    const geometry_manifest = geometry_payload.manifest;

    return {
        mesh: stripHeavyGeometry(mesh, geometry_manifest),
        geometry_manifest,
        geometry_payload,
    };
};

export const compileGeometryPayload = (payload = {}, options = {}) => {
    if (!payload || typeof payload !== "object" || !payload.mesh) {
        return payload;
    }

    const compiled = compileGeometryMesh(payload.mesh, options);

    return {
        ...payload,
        mesh: compiled.mesh,
        geometry_manifest: compiled.geometry_manifest || payload.geometry_manifest,
        geometry_payload: compiled.geometry_payload || payload.geometry_payload,
        material: stripNestedMesh(payload.material),
        shader: stripNestedMesh(payload.shader),
    };
};

export const compileMaterialValues = (values = {}, options = {}) => {
    if (!values || typeof values !== "object") {
        return values;
    }

    const compiled = values.mesh
        ? compileGeometryMesh(values.mesh, options)
        : { mesh: values.mesh, geometry_manifest: values.geometry_manifest || null, geometry_payload: values.geometry_payload || null };

    return {
        ...values,
        mesh: compiled.mesh,
        geometry_manifest: compiled.geometry_manifest || values.geometry_manifest,
        geometry_payload: compiled.geometry_payload || values.geometry_payload,
        material: stripNestedMesh(values.material),
        shader: stripNestedMesh(values.shader),
    };
};

export const restoreHeavyGeometry = (mesh = {}, geometryPayload = null) => {
    if (!mesh || typeof mesh !== "object" || !geometryPayload?.chunks) {
        return mesh;
    }

    const manifest = geometryPayload.manifest || mesh.geometry_manifest || mesh.mesh_manifest || {};
    const mode = geometryPayload.mode === "patch" ? "patch" : "replace";
    const expectedVertexValues = Math.max(0, Math.trunc(Number(manifest.vertex_value_count || 0)));
    const expectedIndexCount = Math.max(0, Math.trunc(Number(manifest.index_count || 0)));
    const vertices = mode === "patch" ? toGeometryArray(mesh.vertices) : [];
    const indices = mode === "patch" ? toGeometryArray(mesh.indices) : [];

    if (mode === "replace") {
        if (expectedVertexValues > 0) vertices.length = expectedVertexValues;
        if (expectedIndexCount > 0) indices.length = expectedIndexCount;
    }

    geometryPayload.chunks.forEach(chunk => {
        if (!chunk || !Array.isArray(chunk.data)) {
            return;
        }

        const target = chunk.kind === "indices" ? indices : vertices;
        const start = Math.max(0, Math.trunc(Number(chunk.start || 0)));

        chunk.data.forEach((value, offset) => {
            target[start + offset] = chunk.kind === "indices"
                ? quantizeIndexValue(value)
                : quantizeVertexValue(value);
        });
    });

    const compactVertices = Array.from({ length: vertices.length }, (_item, index) => {
        const value = vertices[index];
        return Number.isFinite(Number(value)) ? Number(value) : 0;
    });
    const compactIndices = Array.from({ length: indices.length }, (_item, index) => quantizeIndexValue(indices[index]));
    const hydrated = compactVertices.length >= Math.max(3, Number(manifest.stride || mesh.stride || 11)) * 3 && compactIndices.length >= 3;

    return {
        ...mesh,
        vertices: compactVertices,
        indices: compactIndices,
        stride: manifest.stride || mesh.stride || 11,
        count: compactIndices.length,
        indexType: manifest.indexType || mesh.indexType || "uint16",
        geometry_manifest: manifest || mesh.geometry_manifest,
        mesh_manifest: manifest || mesh.mesh_manifest,
        meta: {
            ...(mesh.meta || {}),
            geometryExternalized: true,
            geometryHydrated: hydrated,
            geometryHydrateFailed: !hydrated,
            geometryRevision: Math.trunc(Number(manifest.revision ?? mesh.meta?.geometryRevision ?? 0)),
            vertexCount: Math.trunc(Number(manifest.vertex_count || Math.floor(compactVertices.length / Math.max(1, Number(manifest.stride || mesh.stride || 11))))),
            indexCount: compactIndices.length,
            triangleCount: Math.floor(compactIndices.length / 3),
        },
    };
};

export const heavyGeometryKeys = HEAVY_GEOMETRY_KEYS;
