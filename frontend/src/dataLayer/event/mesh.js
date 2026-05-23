import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";

const asArray = payload => Array.isArray(payload) ? payload : [payload].filter(Boolean);

const normalizeMeshPayload = payload => {
    if (!payload || typeof payload !== "object") {
        return payload;
    }

    if (!payload.mesh) {
        return payload;
    }

    const mesh = Mesh.toPlain(payload.mesh);

    return {
        ...payload,
        mesh,
        shader: payload.shader
            ? {
                ...payload.shader,
                mesh,
            }
            : payload.shader,
        material: payload.material
            ? {
                ...payload.material,
                mesh,
            }
            : payload.material,
    };
};


const updateMeshLikePayload = async (route, payload, options = {}) => {
    const response = await route.api.updateMesh(normalizeMeshPayload({
        ...(payload || {}),
        settings: {
            ...(payload?.settings || {}),
            ...(options.settings || {}),
        },
    }));

    if (response && options.fetchLayer !== false) {
        await route.emit("fetch-layer");
    }

    return response;
};

export const meshEvent = (route) => ({
    "mesh:fetch": async (payload = {}) => {
        return await route.api.fetchMesh(payload);
    },

    "mesh:create": async (payload) => {
        const response = await route.api.createMesh(normalizeMeshPayload(payload));

        if (response) {
            await route.emit("fetch-layer");
            await route.emit("backup:fetch-list");
        }

        return response;
    },

    "mesh:update": async (payload) => {
        return await updateMeshLikePayload(route, payload);
    },

    "geometry:update": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            settings: { geometry_edit: true },
        });
    },

    "geometry:commit": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            settings: { geometry_edit: true, geometry_committed: true },
        });
    },

    "mesh-edit:update": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            settings: { mesh_edit: true },
        });
    },

    "mesh-edit:commit": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            settings: { mesh_edit: true, mesh_edit_committed: true },
        });
    },

    "sculpt:update": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            settings: { sculpt_edit: true },
        });
    },

    "sculpt:commit": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            settings: { sculpt_edit: true, sculpt_committed: true },
        });
    },

    "mesh:delete": async (payload) => {
        let changed = false;

        for (const layer of asArray(payload)) {
            const response = await route.api.deleteMesh(layer);
            changed = Boolean(response) || changed;
        }

        if (changed) {
            await route.emit("layer:select", []);
            await route.emit("fetch-layer");
        }

        return changed;
    },
});
