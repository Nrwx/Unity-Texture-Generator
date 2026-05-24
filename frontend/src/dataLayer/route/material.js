import api from "@/dataLayer/api";
import { compileMaterialValues } from "@/view/models/page/material/geometry/model";

const toPlain = value => {
    if (value === null || value === undefined) {
        return {};
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch (__error) {
                return {};
            }
        }

        return {};
    }
};

const stringify = value => {
    const plain = toPlain(value);

    try {
        return JSON.stringify(plain);
    } catch (error) {
        console.error("[material api] JSON stringify failed", error, value);
        return "{}";
    }
};

const unwrap = response => response?.data || response || null;

const appendIfPresent = (formData, key, value, serialize = value => String(value)) => {
    if (value === undefined || value === null) {
        return;
    }

    formData.append(key, serialize(value));
};

export const appendMaterialForm = (formData, values = {}) => {
    const compiled = compileMaterialValues(values);
    const geometryPayload = compiled?.geometry_payload || null;
    const plain = toPlain({
        ...(compiled || {}),
        geometry_payload: null,
    });

    appendIfPresent(formData, "name", plain.name);

    appendIfPresent(formData, "surface", plain.surface, stringify);
    appendIfPresent(formData, "geometry", plain.geometry, stringify);
    appendIfPresent(formData, "mesh", plain.mesh, stringify);
    appendIfPresent(formData, "geometry_manifest", plain.geometry_manifest, stringify);
    appendIfPresent(formData, "geometry_payload", geometryPayload, stringify);
    appendIfPresent(formData, "light", plain.light, stringify);
    appendIfPresent(formData, "physics", plain.physics, stringify);
    appendIfPresent(formData, "bitmap_maps", plain.bitmap_maps, stringify);
    appendIfPresent(formData, "uv", plain.uv, stringify);
    appendIfPresent(formData, "particle_system", plain.particle_system, stringify);
    appendIfPresent(formData, "shader_graph", plain.shader_graph, stringify);

    appendIfPresent(formData, "cube_size", plain.cube_size);
    appendIfPresent(formData, "texture_size", plain.texture_size);
    appendIfPresent(formData, "rotate_preview", plain.rotate_preview);
    appendIfPresent(formData, "wireframe_preview", plain.wireframe_preview);
    appendIfPresent(formData, "faces_preview", plain.faces_preview);
    appendIfPresent(formData, "vertices_preview", plain.vertices_preview);
    appendIfPresent(formData, "fluid_mesh_preview", plain.fluid_mesh_preview);
    appendIfPresent(formData, "fluid_particle_preview", plain.fluid_particle_preview);

    appendIfPresent(formData, "blend_mode", plain.blend_mode);
    appendIfPresent(formData, "render_backend", plain.render_backend);
    appendIfPresent(formData, "alpha_clip", plain.alpha_clip);
    appendIfPresent(formData, "shadow_method", plain.shadow_method);
    appendIfPresent(formData, "backface_culling", plain.backface_culling);
    appendIfPresent(formData, "show_backface", plain.show_backface);
    appendIfPresent(formData, "screen_space_refraction", plain.screen_space_refraction);
    appendIfPresent(formData, "refraction_depth", plain.refraction_depth);
    appendIfPresent(formData, "subsurface_translucency", plain.subsurface_translucency);
    appendIfPresent(formData, "use_nodes", plain.use_nodes);

    const valuesContract = { ...plain };
    delete valuesContract.geometry_payload;
    formData.append("values", stringify(valuesContract));
};

const assertPayload = payload => {
    const { layer, values } = payload || {};

    if (!layer?.id || !values) {
        return null;
    }

    return {
        layer,
        values,
    };
};

export const materialPreview = async (payload = {}) => {
    const safe = assertPayload(payload);

    if (!safe) {
        console.warn("[materialPreview] invalid payload", payload);
        return null;
    }

    const formData = new FormData();

    formData.append("method", "material-preview");
    formData.append("source_layer_id", safe.layer.id);

    appendMaterialForm(formData, safe.values);

    const response = await api.post("/renderer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return unwrap(response);
};

export const createMaterialCube = async (payload = {}) => {
    const safe = assertPayload(payload);

    if (!safe) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "create-cube");
    formData.append("source_layer_id", payload.source_layer_id || safe.layer.id);

    appendMaterialForm(formData, safe.values);

    const response = await api.post("/material", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return unwrap(response);
};

export const updateMaterial = async (payload = {}) => {
    const { layer, values } = payload || {};

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "update");
    formData.append("id", layer.id);

    appendMaterialForm(formData, values);

    const response = await api.post("/material", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return unwrap(response);
};

export const exportBlenderMaterial = async (id) => {
    if (!id) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "export-blender");
    formData.append("id", id);

    const response = await api.post("/material", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return unwrap(response);
};
