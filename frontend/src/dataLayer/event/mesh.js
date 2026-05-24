import { compileGeometryPayload } from "@/view/models/page/material/geometry/model";

const asArray = payload => Array.isArray(payload) ? payload : [payload].filter(Boolean);

const normalizeMeshPayload = (payload, options = {}) => compileGeometryPayload(payload, options);

const compactMeshPayload = (payload = {}, settings = {}) => ({
    id: payload?.id,
    geometry: payload?.geometry || payload?.mesh?.settings || {},
    mesh: payload?.mesh || {},
    geometry_manifest: payload?.geometry_manifest || payload?.mesh?.geometry_manifest || payload?.mesh?.mesh_manifest || {},
    mesh_manifest: payload?.mesh_manifest || payload?.mesh?.mesh_manifest || payload?.mesh?.geometry_manifest || {},
    settings,
});


const updateMeshLikePayload = async (route, payload, options = {}) => {
    const settings = {
        ...(payload?.settings || {}),
        ...(options.settings || {}),
    };
    const sourcePayload = options.compact === true
        ? compactMeshPayload(payload, settings)
        : {
            ...(payload || {}),
            settings,
        };
    const geometryOptions = options.geometry || {};
    const response = await route.api.updateMesh(
        normalizeMeshPayload(sourcePayload, geometryOptions),
        {
            geometry: geometryOptions,
            geometryTransport: options.geometryTransport || {},
        },
    );

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
            compact: true,
            geometry: { allowPatch: true, mode: "patch" },
            settings: { sculpt_edit: true },
        });
    },

    "sculpt:commit": async (payload) => {
        return await updateMeshLikePayload(route, payload, {
            compact: true,
            geometry: { allowPatch: true, mode: "patch" },
            geometryTransport: {
                split: true,
                maxRequestBytes: 12000,
                maxChunkValues: 384,
            },
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
