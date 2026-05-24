import api from "@/dataLayer/api";
import { compileGeometryPayload } from "@/view/models/page/material/geometry/model";

const stringify = value => JSON.stringify(value);

const appendIfPresent = (formData, key, value, serialize = value => value) => {
    if (value === undefined || value === null) {
        return;
    }

    formData.append(key, serialize(value));
};


const normalizeMeshPayload = (payload, options = {}) => compileGeometryPayload(payload, options);

const DEFAULT_GEOMETRY_REQUEST_BYTE_LIMIT = 12000;
const DEFAULT_GEOMETRY_CHUNK_VALUE_LIMIT = 384;

const estimateJsonBytes = value => {
    try {
        return stringify(value).length;
    } catch (_error) {
        return Number.MAX_SAFE_INTEGER;
    }
};

const splitChunkData = (chunk = {}, valueLimit = DEFAULT_GEOMETRY_CHUNK_VALUE_LIMIT) => {
    const data = Array.isArray(chunk.data) ? chunk.data : [];
    const safeLimit = Math.max(32, Math.trunc(Number(valueLimit || DEFAULT_GEOMETRY_CHUNK_VALUE_LIMIT)));

    if (data.length <= safeLimit) {
        return [{ ...chunk, data: data.slice(), count: data.length }];
    }

    const chunks = [];

    for (let offset = 0; offset < data.length; offset += safeLimit) {
        const part = data.slice(offset, offset + safeLimit);
        const start = Math.max(0, Math.trunc(Number(chunk.start || 0))) + offset;

        chunks.push({
            ...chunk,
            key: `${chunk.kind || "vertices"}:${start}`,
            start,
            count: part.length,
            data: part,
        });
    }

    return chunks;
};

const splitGeometryPayload = (geometryPayload = {}, options = {}) => {
    const sourceChunks = Array.isArray(geometryPayload.chunks) ? geometryPayload.chunks : [];

    if (!sourceChunks.length || geometryPayload.mode !== "patch") {
        return [geometryPayload];
    }

    const byteLimit = Math.max(4096, Math.trunc(Number(options.maxRequestBytes || DEFAULT_GEOMETRY_REQUEST_BYTE_LIMIT)));
    const valueLimit = Math.max(32, Math.trunc(Number(options.maxChunkValues || DEFAULT_GEOMETRY_CHUNK_VALUE_LIMIT)));
    const atomicChunks = sourceChunks.flatMap(chunk => splitChunkData(chunk, valueLimit));
    const batches = [];
    let current = [];

    const makePayload = chunks => ({
        ...geometryPayload,
        mode: "patch",
        chunks,
    });

    atomicChunks.forEach(chunk => {
        const candidate = [...current, chunk];
        const candidatePayload = makePayload(candidate);

        if (current.length && estimateJsonBytes(candidatePayload) > byteLimit) {
            batches.push(makePayload(current));
            current = [chunk];
            return;
        }

        current = candidate;
    });

    if (current.length) {
        batches.push(makePayload(current));
    }

    return batches.length ? batches : [geometryPayload];
};

const buildGeometryPayloadBatches = (payload = {}, options = {}) => {
    const geometryPayload = payload.geometry_payload;

    if (!options.split || !geometryPayload?.chunks?.length) {
        return [payload];
    }

    return splitGeometryPayload(geometryPayload, options).map((payloadChunk, index, list) => ({
        ...payload,
        geometry_payload: payloadChunk,
        settings: {
            ...(payload.settings || {}),
            geometry_chunked_flush: true,
            geometry_chunk_batch: index + 1,
            geometry_chunk_batches: list.length,
            geometry_fetch_after_batch: index === list.length - 1,
        },
    }));
};

const appendMeshPayload = (formData, layer = {}) => {
    if (typeof layer === "string") {
        appendIfPresent(formData, "id", layer);
        return;
    }

    appendIfPresent(formData, "id", layer.id);
    appendIfPresent(formData, "name", layer.name);
    appendIfPresent(formData, "width", layer.width);
    appendIfPresent(formData, "height", layer.height);
    appendIfPresent(formData, "hidden", layer.hidden);
    appendIfPresent(formData, "opacity", layer.opacity);
    appendIfPresent(formData, "order", layer.order);
    appendIfPresent(formData, "matrix", layer.matrix, stringify);
    appendIfPresent(formData, "keyframes", layer.keyframes, stringify);
    appendIfPresent(formData, "geometry", layer.geometry, stringify);
    appendIfPresent(formData, "mesh", layer.mesh, stringify);
    appendIfPresent(formData, "geometry_manifest", layer.geometry_manifest, stringify);
    appendIfPresent(formData, "geometry_payload", layer.geometry_payload, stringify);
    appendIfPresent(formData, "settings", layer.settings, stringify);
    appendIfPresent(formData, "preview", layer.preview, stringify);
    appendIfPresent(formData, "viewport_camera", layer.viewport_camera, stringify);
    appendIfPresent(formData, "material", layer.material, stringify);
    appendIfPresent(formData, "shader", layer.shader, stringify);
    appendIfPresent(formData, "particle_system", layer.particle_system, stringify);
};

const postMeshBatch = async (method, normalizedPayload = {}, requestOptions = {}) => {
    const formData = new FormData();

    formData.append("method", method);
    appendMeshPayload(formData, normalizedPayload);

    return await api.post("/mesh", formData, {
        ...(requestOptions || {}),
        headers: {
            ...((requestOptions || {}).headers || {}),
            "Content-Type": "multipart/form-data",
        },
    });
};

const postMesh = async (method, payload = {}, options = {}) => {
    try {
        const normalizedPayload = normalizeMeshPayload(payload, options.geometry || {});
        const batches = buildGeometryPayloadBatches(normalizedPayload, options.geometryTransport || {});
        let response = null;

        for (const batch of batches) {
            response = await postMeshBatch(method, batch, options.request || {});
        }

        return response || true;
    } catch (error) {
        console.error(`Error in mesh:${method}:`, error.response?.data || error.message);
        return false;
    }
};

export const fetchMesh = async (payload = {}, options = {}) => postMesh("fetch", payload, options);

export const createMesh = async (payload = {}, options = {}) => postMesh("create", payload, options);

export const updateMesh = async (payload = {}, options = {}) => postMesh("update", payload, options);

export const deleteMesh = async (payload = {}, options = {}) => postMesh("delete", payload, options);
