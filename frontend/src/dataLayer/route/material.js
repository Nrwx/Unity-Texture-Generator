import api from "@/dataLayer/api";

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

const boolValue = value => (value ? "true" : "false");

const unwrap = response => response?.data || response || null;

export const normalizeMaterialValuesForApi = (values = {}) => {
    const plain = toPlain(values);

    const textureSize = plain.texture_size === "Original"
        ? "Original"
        : String(plain.texture_size || "Original");

    return {
        name: plain.name || "Cube Material",

        surface: toPlain(plain.surface),
        geometry: toPlain(plain.geometry),
        mesh: toPlain(plain.mesh),
        light: toPlain(plain.light),
        bitmap_maps: toPlain(plain.bitmap_maps),
        uv: toPlain(plain.uv),
        particle_system: toPlain(plain.particle_system),
        shader_graph: toPlain(plain.shader_graph),

        cube_size: Number(plain.cube_size || 256),
        texture_size: textureSize,
        rotate_preview: plain.rotate_preview !== false,
        wireframe_preview: plain.wireframe_preview === true,
        faces_preview: plain.faces_preview === true,
        vertices_preview: plain.vertices_preview === true,
        fluid_mesh_preview: plain.fluid_mesh_preview !== false,
        fluid_particle_preview: plain.fluid_particle_preview !== false,

        blend_mode: plain.blend_mode || "BLEND",
        alpha_clip: Math.min(Math.max(Number(plain.alpha_clip ?? 0.5), 0), 1),
        shadow_method: plain.shadow_method || "HASHED",
        use_nodes: plain.use_nodes !== false,
    };
};

export const appendMaterialForm = (formData, values = {}) => {
    const normalized = normalizeMaterialValuesForApi(values);

    const surfaceJson = stringify(normalized.surface);
    const geometryJson = stringify(normalized.geometry);
    const meshJson = stringify(normalized.mesh);
    const bitmapMapsJson = stringify(normalized.bitmap_maps);
    const uvJson = stringify(normalized.uv);
    const particleSystemJson = stringify(normalized.particle_system);
    const shaderGraphJson = stringify(normalized.shader_graph);
    const valuesJson = stringify(normalized);

    formData.append("name", normalized.name);

    formData.append("surface", surfaceJson);
    formData.append("geometry", geometryJson);
    formData.append("mesh", meshJson);
    formData.append("bitmap_maps", bitmapMapsJson);
    formData.append("uv", uvJson);
    formData.append("particle_system", particleSystemJson);
    formData.append("shader_graph", shaderGraphJson);

    formData.append("cube_size", String(normalized.cube_size));
    formData.append("texture_size", String(normalized.texture_size));
    formData.append("rotate_preview", boolValue(normalized.rotate_preview));
    formData.append("wireframe_preview", boolValue(normalized.wireframe_preview));
    formData.append("faces_preview", boolValue(normalized.faces_preview));
    formData.append("vertices_preview", boolValue(normalized.vertices_preview));
    formData.append("fluid_mesh_preview", boolValue(normalized.fluid_mesh_preview));
    formData.append("fluid_particle_preview", boolValue(normalized.fluid_particle_preview));

    formData.append("blend_mode", normalized.blend_mode);
    formData.append("alpha_clip", String(normalized.alpha_clip));
    formData.append("shadow_method", normalized.shadow_method);
    formData.append("use_nodes", boolValue(normalized.use_nodes));

    formData.append("values", valuesJson);
};

const assertPayload = payload => {
    const { layer, values } = payload || {};

    if (!layer?.id || !values) {
        return null;
    }

    return {
        layer,
        values: normalizeMaterialValuesForApi(values),
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
