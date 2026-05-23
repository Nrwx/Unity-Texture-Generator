import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";
import api from "@/dataLayer/api";

const stringify = value => JSON.stringify(value);

const appendIfPresent = (formData, key, value, serialize = value => value) => {
    if (value === undefined || value === null) {
        return;
    }

    formData.append(key, serialize(value));
};


const normalizeMeshPayload = payload => {
    if (!payload || typeof payload !== "object" || !payload.mesh) {
        return payload;
    }

    const mesh = Mesh.toPlain(payload.mesh);

    return {
        ...payload,
        mesh,
        material: payload.material
            ? {
                ...payload.material,
                mesh,
            }
            : payload.material,
        shader: payload.shader
            ? {
                ...payload.shader,
                mesh,
            }
            : payload.shader,
    };
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
    appendIfPresent(formData, "settings", layer.settings, stringify);
    appendIfPresent(formData, "preview", layer.preview, stringify);
    appendIfPresent(formData, "viewport_camera", layer.viewport_camera, stringify);
    appendIfPresent(formData, "material", layer.material, stringify);
    appendIfPresent(formData, "shader", layer.shader, stringify);
    appendIfPresent(formData, "particle_system", layer.particle_system, stringify);
};

const postMesh = async (method, payload = {}) => {
    try {
        const formData = new FormData();
        const normalizedPayload = normalizeMeshPayload(payload);
        formData.append("method", method);
        appendMeshPayload(formData, normalizedPayload);

        const response = await api.post("/mesh", formData, {
            headers: {"Content-Type": "multipart/form-data"},
        });

        return response || true;
    } catch (error) {
        console.error(`Error in mesh:${method}:`, error.response?.data || error.message);
        return false;
    }
};

export const fetchMesh = async (payload = {}) => postMesh("fetch", payload);

export const createMesh = async (payload = {}) => postMesh("create", payload);

export const updateMesh = async (payload = {}) => postMesh("update", payload);

export const deleteMesh = async (payload = {}) => postMesh("delete", payload);
