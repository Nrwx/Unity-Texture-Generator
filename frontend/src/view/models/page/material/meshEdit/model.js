import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";

const toNumber = (value, fallback = 0) => Mesh.toNumber(value, fallback);
const edgeKey = (a, b) => Mesh.edgeKey(a, b);
const parseEdgeKey = key => Mesh.parseEdgeKey(key);
const unique = values => Mesh.unique(values);
const selectedSet = list => new Set(Array.isArray(list) ? list.map(String) : []);

export const MESH_EDIT_MODES = Object.freeze(["vertex", "edge", "face"]);
export const MESH_EDIT_VIEW_MODES = Object.freeze(["wireframe", "solid", "soft", "world"]);

export const createDefaultMeshEditState = () => ({
    enabled: false,
    mode: "vertex",
    tool: "move",
    viewMode: "wireframe",
    selection: {
        vertices: [],
        edges: [],
        faces: [],
        paths: [],
    },
    operation: "",
    operationTick: 0,
    showVertices: true,
    showEdges: true,
    showFaces: true,
    showAll: false,
    proportional: false,
    proportionalRadius: 0.35,
    vertexSize: 7.5,
    edgeWidth: 2,
    faceAlpha: 0.22,
    lastError: "",
    lastAction: "",
});

export const normalizeMeshEditMode = mode =>
    MESH_EDIT_MODES.includes(mode) ? mode : "vertex";

export const normalizeMeshEditViewMode = mode =>
    MESH_EDIT_VIEW_MODES.includes(mode) ? mode : "wireframe";

export const nextMeshEditTabState = state => {
    if (!state?.enabled) {
        return { enabled: true, mode: "vertex" };
    }

    const mode = normalizeMeshEditMode(state.mode);

    if (mode === "vertex") return { enabled: true, mode: "edge" };
    if (mode === "edge") return { enabled: true, mode: "face" };

    return { enabled: false, mode: "vertex" };
};

export const normalizeEditableMesh = mesh =>
    Mesh.normalizeEditableMesh(mesh);

export const buildMeshEditTopology = (mesh, geometry = {}) =>
    Mesh.buildTopology(mesh, geometry);

export const buildMeshEditOverlay = ({ mesh, geometry, state }) => {
    if (state?.enabled !== true) {
        return { enabled: false };
    }

    const topology = buildMeshEditTopology(mesh, geometry);

    const selectedVertices = selectedSet(state.selection?.vertices);
    const selectedEdges = selectedSet(state.selection?.edges);
    const selectedFaces = selectedSet(state.selection?.faces);

    const showAll = state.showAll === true;
    const mode = normalizeMeshEditMode(state.mode);

    return {
        enabled: true,
        mode,
        tool: state.tool || "move",
        viewMode: normalizeMeshEditViewMode(state.viewMode),

        showVertices: state.showVertices !== false && (showAll || mode === "vertex"),
        showEdges: state.showEdges !== false && (showAll || mode === "edge" || mode === "face"),
        showFaces: state.showFaces !== false && (showAll || mode === "face"),

        showAll,

        vertexSize: toNumber(state.vertexSize, 7.5),
        edgeWidth: toNumber(state.edgeWidth, 2),
        faceAlpha: toNumber(state.faceAlpha, 0.22),

        vertices: topology.vertices.map(v => ({
            ...v,
            selected: selectedVertices.has(String(v.index)),
        })),

        edges: topology.edges.map(e => ({
            ...e,
            selected: selectedEdges.has(e.key),
        })),

        faces: topology.faces.map(f => ({
            ...f,
            selected: selectedFaces.has(String(f.index)),
        })),
    };
};

export const clearMeshEditSelection = state => {
    if (!state?.selection) return;

    state.selection.vertices = [];
    state.selection.edges = [];
    state.selection.faces = [];
    state.selection.paths = [];
};

const addOrToggle = (items, value, additive) => {
    const key = String(value);
    const set = additive ? selectedSet(items) : new Set();

    if (additive && set.has(key)) set.delete(key);
    else set.add(key);

    return Array.from(set);
};

const selectVerticesFromEdge = (state, indices, additive) => {
    const set = additive ? selectedSet(state.selection.vertices) : new Set();
    indices.forEach(i => set.add(String(i)));
    state.selection.vertices = Array.from(set).map(Number);
};

const selectVerticesFromFace = (state, indices, additive) => {
    const set = additive ? selectedSet(state.selection.vertices) : new Set();
    indices.forEach(i => set.add(String(i)));
    state.selection.vertices = Array.from(set).map(Number);
};

export const selectMeshEditHit = ({ state, hit, additive = false } = {}) => {
    if (!state?.selection || !hit) return false;

    const mode = normalizeMeshEditMode(state.mode);

    if (!additive) clearMeshEditSelection(state);

    if (mode === "vertex" && Number.isInteger(hit.index)) {
        state.selection.vertices = addOrToggle(state.selection.vertices, hit.index, additive);
        state.lastAction = `Vertex ${hit.index}`;
        return true;
    }

    if (mode === "edge" && Array.isArray(hit.indices) && hit.indices.length >= 2) {
        const key = edgeKey(hit.indices[0], hit.indices[1]);
        state.selection.edges = addOrToggle(state.selection.edges, key, additive);
        selectVerticesFromEdge(state, hit.indices.slice(0, 2), true);
        state.lastAction = `Edge ${key}`;
        return true;
    }

    if (mode === "face" && Number.isInteger(hit.triangleIndex)) {
        state.selection.faces = addOrToggle(state.selection.faces, hit.triangleIndex, additive);

        if (Array.isArray(hit.indices)) {
            selectVerticesFromFace(state, hit.indices, true);
        }

        state.lastAction = `Face ${hit.triangleIndex}`;
        return true;
    }

    return false;
};

const applyMeshToLayer = (layer, mesh, vertices, indices, stride, source = "geometry-edit", meta = {}) =>
    Mesh.applyMeshToLayer(layer, mesh, {
        vertices,
        indices,
        stride,
        source,
        meta,
    });

const selectedVertexIndices = state =>
    (state.selection?.vertices || [])
        .map(v => Math.trunc(Number(v)))
        .filter(Number.isFinite);

const selectedEdgeKeys = state =>
    Array.isArray(state.selection?.edges) ? state.selection.edges : [];

const selectedFaceIndices = state =>
    (state.selection?.faces || [])
        .map(v => Math.trunc(Number(v)))
        .filter(Number.isFinite);

const validUniqueVertices = (indices, vertexCount, min = 2, max = 4) => {
    const values = unique(
        indices.map(i => Math.max(0, Math.trunc(Number(i) || 0)))
    ).filter(i => i >= 0 && i < vertexCount);

    return values.length >= min && values.length <= max ? values : [];
};

const collectSelectedVertices = ({ state, indices }) => {
    const out = new Set(selectedVertexIndices(state));

    selectedEdgeKeys(state)
        .forEach(k => parseEdgeKey(k).forEach(i => out.add(i)));

    selectedFaceIndices(state).forEach(face => {
        const offset = face * 3;
        if (offset + 2 < indices.length) {
            out.add(indices[offset]);
            out.add(indices[offset + 1]);
            out.add(indices[offset + 2]);
        }
    });

    return Array.from(out).filter(Number.isFinite);
};

const makeFaceFromVertices = ({ layer, mesh, vertices, indices, stride, values }) => {
    if (values.length === 3) {
        indices.push(values[0], values[1], values[2]);
    }

    if (values.length === 4) {
        indices.push(values[0], values[1], values[2], values[0], values[2], values[3]);
    }

    const next = applyMeshToLayer(layer, mesh, vertices, indices, stride, "geometry-edit:make-face", {
        uvReset: true,
    });

    Mesh.resetUv(next);
    return next;
};

const addEditEdge = (layer, mesh, a, b) => {
    const key = edgeKey(a, b);

    const editEdges = new Set([
        ...(mesh.meta?.editEdges || []).map(e =>
            Array.isArray(e) ? edgeKey(e[0], e[1]) : e
        ),
    ]);

    editEdges.add(key);

    layer.mesh = {
        ...mesh,
        meta: {
            ...(mesh.meta || {}),
            editEdges: Array.from(editEdges),
            editRevision: Math.trunc(toNumber(mesh.meta?.editRevision, 0)) + 1,
            renderCacheKey: `${mesh.id || "mesh"}:geometry-edit:edge:${Date.now()}:${key}`,
        },
    };

    return key;
};

export const getMeshEditSelectionVertexIndices = ({ state, mesh } = {}) => {
    if (!state?.selection || !mesh) return [];

    const normalized = normalizeEditableMesh(mesh);
    if (!normalized) return [];

    return collectSelectedVertices({ state, indices: normalized.indices })
        .filter(i => i >= 0 && i < normalized.vertexCount);
};

export const getMeshEditSelectionPivot = ({ state, mesh, geometry = {} } = {}) => {
    const indices = getMeshEditSelectionVertexIndices({ state, mesh });
    if (!indices.length) return null;

    const topo = buildMeshEditTopology(mesh, geometry);

    const points = indices
        .map(i => topo.vertices.find(v => v.index === i)?.point)
        .filter(Boolean);

    if (!points.length) return null;

    return points.reduce((acc, p) => ([
        acc[0] + p[0] / points.length,
        acc[1] + p[1] / points.length,
        acc[2] + p[2] / points.length,
    ]), [0, 0, 0]);
};

export const transformMeshEditSelection = ({ state, layer, delta = [0, 0, 0], scale = 1 } = {}) => {
    if (!state?.enabled || !layer?.mesh) {
        return { changed: false, message: "Geometry Edit Mode ist nicht aktiv." };
    }

    const mesh = layer.mesh;
    const normalized = normalizeEditableMesh(mesh);
    if (!normalized) {
        return { changed: false, message: "Kein editierbares Mesh gefunden." };
    }

    const vertices = normalized.vertices.slice();
    const indices = normalized.indices.slice();

    const selected = collectSelectedVertices({ state, indices })
        .filter(i => i >= 0 && i < normalized.vertexCount);

    if (!selected.length) {
        return { changed: false, message: "Keine gültige Auswahl." };
    }

    const center = selected.reduce((acc, i) => {
        const p = Mesh.read3(vertices, normalized.stride, i);
        acc[0] += p[0] / selected.length;
        acc[1] += p[1] / selected.length;
        acc[2] += p[2] / selected.length;
        return acc;
    }, [0, 0, 0]);

    const amount = Array.isArray(delta) ? delta.map(v => toNumber(v, 0)) : [0, 0, 0];
    const factor = Math.max(0.001, toNumber(scale, 1));

    selected.forEach(i => {
        const p = Mesh.read3(vertices, normalized.stride, i);

        const scaled = factor === 1
            ? p
            : [
                center[0] + (p[0] - center[0]) * factor,
                center[1] + (p[1] - center[1]) * factor,
                center[2] + (p[2] - center[2]) * factor,
            ];

        Mesh.write3(vertices, normalized.stride, i, [
            scaled[0] + amount[0],
            scaled[1] + amount[1],
            scaled[2] + amount[2],
        ]);
    });

    applyMeshToLayer(layer, mesh, vertices, indices, normalized.stride, "geometry-edit:transform", {
        uvReset: true,
    });

    Mesh.resetUv(layer.mesh);

    state.lastAction = factor === 1 ? "Auswahl verschoben" : "Auswahl skaliert";

    return { changed: true, message: state.lastAction };
};

export const applyMeshEditOperation = ({ state, layer, action = "", payload = {} } = {}) => {
    if (!state?.enabled || !layer?.mesh) {
        return { changed: false, message: "Geometry Edit Mode ist nicht aktiv." };
    }

    const mesh = layer.mesh;
    const normalized = normalizeEditableMesh(mesh);
    if (!normalized) {
        return { changed: false, message: "Kein editierbares Mesh gefunden." };
    }

    const vertices = normalized.vertices.slice();
    const indices = normalized.indices.slice();

    const mode = normalizeMeshEditMode(state.mode);
    const op = String(action || state.operation || "").trim();

    const selectedVertices = selectedVertexIndices(state);
    const selectedEdges = selectedEdgeKeys(state);
    const selectedFaces = selectedFaceIndices(state);

    if (op === "clear") {
        clearMeshEditSelection(state);
        state.lastAction = "Auswahl gelöscht";
        return { changed: false, message: state.lastAction };
    }

    if (op === "select-all") {
        const topo = buildMeshEditTopology(mesh, layer.geometry || mesh.settings || {});
        state.selection.vertices = mode === "vertex" ? topo.vertices.map(v => v.index) : [];
        state.selection.edges = mode === "edge" ? topo.edges.map(e => e.key) : [];
        state.selection.faces = mode === "face" ? topo.faces.map(f => f.index) : [];
        state.lastAction = "Alles ausgewählt";
        return { changed: false, message: state.lastAction };
    }

    if (op === "add-vertex") {
        const point = Array.isArray(payload.point) ? payload.point : [0, 0, 0];

        const index = Mesh.addVertex(vertices, normalized.stride, point);

        applyMeshToLayer(layer, mesh, vertices, indices, normalized.stride, "geometry-edit:add-vertex", {
            uvReset: true,
        });

        Mesh.resetUv(layer.mesh);

        state.selection.vertices = [index];
        state.mode = "vertex";
        state.lastAction = `Vertex ${index} hinzugefügt`;

        return { changed: true, message: state.lastAction };
    }

    if (op === "path") {
        const values = validUniqueVertices(selectedVertices, normalized.vertexCount, 2, 128);
        if (values.length < 2) {
            return { changed: false, message: "Mindestens 2 Vertices für Path." };
        }

        const editEdges = new Set([
            ...(mesh.meta?.editEdges || []).map(e =>
                Array.isArray(e) ? edgeKey(e[0], e[1]) : e
            ),
        ]);

        for (let i = 0; i < values.length - 1; i++) {
            editEdges.add(edgeKey(values[i], values[i + 1]));
        }

        layer.mesh = {
            ...mesh,
            meta: {
                ...(mesh.meta || {}),
                editEdges: Array.from(editEdges),
                editPaths: [...(mesh.meta?.editPaths || []), values],
                editRevision: Math.trunc(toNumber(mesh.meta?.editRevision, 0)) + 1,
                renderCacheKey: `${mesh.id || "mesh"}:geometry-edit:path:${Date.now()}`,
            },
        };

        state.selection.paths = [values.join(":")];
        state.lastAction = "Path erstellt";

        return { changed: true, message: state.lastAction };
    }

    if (op === "move" || op === "scale") {
        return transformMeshEditSelection({
            state,
            layer,
            delta: payload.delta || [0, 0, 0],
            scale: op === "scale" ? payload.scale : 1,
        });
    }

    if (op === "connect" || op === "make-face") {
        if (mode === "vertex" || op === "make-face") {
            const values = validUniqueVertices(selectedVertices, normalized.vertexCount, 2, 4);

            if (values.length === 2 && op !== "make-face") {
                const key = addEditEdge(layer, mesh, values[0], values[1]);
                state.selection.edges = [key];
                state.mode = "edge";
                state.lastAction = `Edge ${key} erstellt`;
                return { changed: true, message: state.lastAction };
            }

            if (values.length === 3 || values.length === 4) {
                makeFaceFromVertices({
                    layer,
                    mesh,
                    vertices,
                    indices,
                    stride: normalized.stride,
                    values,
                });

                state.selection.faces = [
                    Math.floor((indices.length - (values.length === 4 ? 6 : 3)) / 3),
                ];

                state.mode = "face";
                state.lastAction =
                    values.length === 4 ? "Quad erstellt" : "Triangle erstellt";

                return { changed: true, message: state.lastAction };
            }

            return { changed: false, message: "2 Vertices (Edge) oder 3–4 (Face)." };
        }

        if (mode === "edge") {
            const edgeVertices = unique(selectedEdges.flatMap(parseEdgeKey));
            const values = validUniqueVertices(edgeVertices, normalized.vertexCount, 3, 4);

            if (values.length < 3) {
                return { changed: false, message: "Ungültige Edge-Auswahl." };
            }

            makeFaceFromVertices({
                layer,
                mesh,
                vertices,
                indices,
                stride: normalized.stride,
                values,
            });

            state.selection.faces = [
                Math.floor((indices.length - (values.length === 4 ? 6 : 3)) / 3),
            ];

            state.mode = "face";
            state.lastAction = "Face aus Edges erstellt";

            return { changed: true, message: state.lastAction };
        }
    }

    if (op === "extrude") {
        const selected = collectSelectedVertices({ state, indices })
            .filter(i => i >= 0 && i < normalized.vertexCount);

        if (!selected.length) {
            return { changed: false, message: "Keine Auswahl." };
        }

        const normal = selectedFaces.length
            ? Mesh.averageFaceNormal(vertices, indices, normalized.stride, selectedFaces)
            : [0, 0, 1];

        const amount = toNumber(payload.amount, 0.08);
        const cloneMap = new Map();

        selected.forEach(i => {
            const p = Mesh.read3(vertices, normalized.stride, i);
            cloneMap.set(
                i,
                Mesh.pushClonedVertex(vertices, normalized.stride, i, [
                    p[0] + normal[0] * amount,
                    p[1] + normal[1] * amount,
                    p[2] + normal[2] * amount,
                ])
            );
        });

        applyMeshToLayer(layer, mesh, vertices, indices, normalized.stride, "geometry-edit:extrude", {
            uvReset: true,
        });

        Mesh.resetUv(layer.mesh);

        state.selection.vertices = Array.from(cloneMap.values());
        state.mode = "vertex";
        state.lastAction = "Extrude";

        return { changed: true, message: state.lastAction };
    }

    if (op === "delete") {
        if (mode === "face" && selectedFaces.length) {
            const remove = new Set(selectedFaces);
            const next = [];

            for (let i = 0; i < indices.length; i += 3) {
                if (!remove.has(i / 3)) {
                    next.push(indices[i], indices[i + 1], indices[i + 2]);
                }
            }

            applyMeshToLayer(layer, mesh, vertices, next, normalized.stride, "geometry-edit:delete-faces", {
                uvReset: true,
            });

            Mesh.resetUv(layer.mesh);
            clearMeshEditSelection(state);

            state.lastAction = "Faces gelöscht";

            return { changed: true, message: state.lastAction };
        }

        return { changed: false, message: "Delete unterstützt nur Faces." };
    }

    return {
        changed: false,
        message: `Unbekannte Operation: ${op || "leer"}`,
    };
};