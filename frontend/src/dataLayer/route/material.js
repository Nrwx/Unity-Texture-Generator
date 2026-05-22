import api from "@/dataLayer/api";

const appendMaterialForm = (formData, values = {}) => {
    formData.append("name", values.name || "Cube Material");

    formData.append("surface", JSON.stringify(values.surface || {}));
    formData.append("geometry", JSON.stringify(values.geometry || {}));
    formData.append("bitmap_maps", JSON.stringify(values.bitmap_maps || {}));
    formData.append("uv", JSON.stringify(values.uv || {}));
    formData.append("shader_graph", JSON.stringify(values.shader_graph || {}));

    formData.append("cube_size", values.cube_size ?? 256);
    formData.append("rotate_preview", values.rotate_preview ? "true" : "false");

    formData.append("blend_mode", values.blend_mode || "BLEND");
    formData.append("shadow_method", values.shadow_method || "HASHED");
    formData.append("use_nodes", values.use_nodes ? "true" : "false");
};

export const materialPreview = async (payload = {}) => {
    const { layer, values } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "material-preview");
    formData.append("source_layer_id", layer.id);

    appendMaterialForm(formData, values);

    const response = await api.post("/renderer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};

export const createMaterialCube = async (payload = {}) => {
    const { layer, values } = payload;

    if (!layer?.id || !values) {
        return null;
    }

    const formData = new FormData();

    formData.append("method", "create-cube");
    formData.append("source_layer_id", layer.id);

    appendMaterialForm(formData, values);

    const response = await api.post("/material", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

    return response?.data || response;
};

export const updateMaterial = async (payload = {}) => {
    const { layer, values } = payload;

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

    return response?.data || response;
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

    return response?.data || response;
};