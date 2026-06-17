import { Mesh } from "@/view/models/page/material/core/Mesh/Mesh";
import { Topology } from "@/view/models/page/material/core/Topology/Topology";
const clampFinite = (value, min, max, fallback = 0) => {
    const number = toNumber(value, fallback);
    return Math.min(Math.max(number, min), max);
};


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


export const buildSculptTopologyOverlay = ({ mesh, geometry = {}, hit = null, brush = {}, state = {} } = {}) => {
    if (!mesh || !hit?.point) {
        return { enabled: false };
    }

    const normalized = Mesh.normalizeEditableMesh(mesh);

    if (!normalized) {
        return { enabled: false };
    }

    const influence = Topology.collectBrushInfluence({
        vertices: normalized.vertices,
        indices: normalized.indices,
        stride: normalized.stride,
        hit,
        brush,
    });
    const seedOffset = Math.max(0, Math.trunc(toNumber(hit?.triangleIndex, -1))) * 3;
    const sourceOffsets = Array.isArray(influence.triangleOffsets) && influence.triangleOffsets.length
        ? influence.triangleOffsets
        : (seedOffset + 2 < normalized.indices.length ? [seedOffset] : []);
    const edgeMap = new Map();
    const faces = [];

    sourceOffsets.forEach(offset => {
        const a = Math.trunc(Number(normalized.indices[offset]));
        const b = Math.trunc(Number(normalized.indices[offset + 1]));
        const c = Math.trunc(Number(normalized.indices[offset + 2]));

        if (![a, b, c].every(index => Number.isInteger(index) && index >= 0 && index < normalized.vertexCount)) {
            return;
        }

        const points = [a, b, c].map(index => Mesh.transformLocalPointToScene(
            geometry,
            Mesh.read3(normalized.vertices, normalized.stride, index),
        ));
        const addEdge = (left, right, pointLeft, pointRight) => {
            const key = edgeKey(left, right);

            if (!edgeMap.has(key)) {
                edgeMap.set(key, {
                    key,
                    indices: parseEdgeKey(key),
                    points: [pointLeft, pointRight],
                    selected: false,
                });
            }
        };

        addEdge(a, b, points[0], points[1]);
        addEdge(b, c, points[1], points[2]);
        addEdge(c, a, points[2], points[0]);
        faces.push({
            index: offset / 3,
            indices: [a, b, c],
            points,
            selected: false,
        });
    });

    return {
        enabled: faces.length > 0,
        mode: "face",
        tool: "sculpt-brush",
        viewMode: normalizeMeshEditViewMode(state.viewMode || "wireframe"),
        showVertices: false,
        showEdges: true,
        showFaces: true,
        showAll: false,
        vertexSize: 0,
        edgeWidth: Math.max(1.25, toNumber(state.edgeWidth, 2) * 0.75),
        faceAlpha: Math.max(0.12, toNumber(state.faceAlpha, 0.22) * 0.65),
        vertices: [],
        edges: Array.from(edgeMap.values()),
        faces,
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

const orderFaceVertices = ({ vertices, stride, values }) => {
    if (!Array.isArray(values) || values.length <= 2) {
        return values || [];
    }

    const points = values.map(index => ({
        index,
        point: Mesh.read3(vertices, stride, index),
    }));

    const center = points.reduce((acc, item) => ([
        acc[0] + item.point[0] / points.length,
        acc[1] + item.point[1] / points.length,
        acc[2] + item.point[2] / points.length,
    ]), [0, 0, 0]);

    const normal = points.length >= 3
        ? Mesh.triangleNormal(points[0].point, points[1].point, points[2].point)
        : [0, 0, 1];

    const abs = normal.map(Math.abs);
    const dropAxis = abs[0] > abs[1] && abs[0] > abs[2]
        ? 0
        : abs[1] > abs[2]
            ? 1
            : 2;

    const project = point => {
        if (dropAxis === 0) return [point[1], point[2]];
        if (dropAxis === 1) return [point[0], point[2]];
        return [point[0], point[1]];
    };

    const [cx, cy] = project(center);

    return points
        .map(item => {
            const [x, y] = project(item.point);
            return {
                ...item,
                angle: Math.atan2(y - cy, x - cx),
            };
        })
        .sort((a, b) => a.angle - b.angle)
        .map(item => item.index);
};

const pushTriangulatedFace = ({ vertices, indices, stride, values }) => {
    const ordered = orderFaceVertices({ vertices, stride, values });

    if (ordered.length === 3) {
        indices.push(ordered[0], ordered[1], ordered[2]);
        return 1;
    }

    if (ordered.length === 4) {
        indices.push(ordered[0], ordered[1], ordered[2], ordered[0], ordered[2], ordered[3]);
        return 2;
    }

    if (ordered.length > 4) {
        for (let i = 1; i + 1 < ordered.length; i += 1) {
            indices.push(ordered[0], ordered[i], ordered[i + 1]);
        }
        return ordered.length - 2;
    }

    return 0;
};

const orderedVerticesFromEdges = (edgeKeys = []) => {
    const pairs = edgeKeys.map(parseEdgeKey).filter(pair => pair.length >= 2 && pair[0] !== pair[1]);

    if (!pairs.length) {
        return [];
    }

    const adjacency = new Map();
    pairs.forEach(([a, b]) => {
        if (!adjacency.has(a)) adjacency.set(a, []);
        if (!adjacency.has(b)) adjacency.set(b, []);
        adjacency.get(a).push(b);
        adjacency.get(b).push(a);
    });

    const start = Array.from(adjacency.keys()).find(key => adjacency.get(key).length === 1) ?? pairs[0][0];
    const ordered = [start];
    let previous = null;
    let current = start;

    while (ordered.length < adjacency.size) {
        const next = (adjacency.get(current) || []).find(item => item !== previous && !ordered.includes(item));
        if (next === undefined) break;
        previous = current;
        current = next;
        ordered.push(current);
    }

    return ordered.length === adjacency.size ? ordered : unique(pairs.flat());
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
    const created = pushTriangulatedFace({ vertices, indices, stride, values });

    if (!created) {
        return null;
    }

    return applyMeshToLayer(layer, mesh, vertices, indices, stride, "geometry-edit:make-face", {
        uvPreserved: true,
        faceCreated: true,
    });
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
            renderCacheKey: `${mesh.id || "mesh"}:geometry-edit:edge:${Math.trunc(toNumber(mesh.meta?.editRevision, 0)) + 1}:${key}`,
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

    const amount = Array.isArray(delta)
        ? delta.map(v => clampFinite(v, -1000000, 1000000, 0))
        : [0, 0, 0];
    const factor = clampFinite(scale, 0.001, 100000, 1);

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
        uvPreserved: true,
    });

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
            uvPreserved: true,
        });

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
                renderCacheKey: `${mesh.id || "mesh"}:geometry-edit:path:${Math.trunc(toNumber(mesh.meta?.editRevision, 0)) + 1}`,
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
                const startFace = Math.floor(indices.length / 3);
                const created = makeFaceFromVertices({
                    layer,
                    mesh,
                    vertices,
                    indices,
                    stride: normalized.stride,
                    values,
                });

                if (!created) {
                    return { changed: false, message: "Face konnte nicht erstellt werden." };
                }

                state.selection.faces = [startFace];

                state.mode = "face";
                state.lastAction =
                    values.length === 4 ? "Quad erstellt" : "Triangle erstellt";

                return { changed: true, message: state.lastAction };
            }

            return { changed: false, message: "2 Vertices (Edge) oder 3–4 (Face)." };
        }

        if (mode === "edge") {
            const edgeVertices = orderedVerticesFromEdges(selectedEdges);
            const values = validUniqueVertices(edgeVertices, normalized.vertexCount, 3, 4);

            if (values.length < 3) {
                return { changed: false, message: "Ungültige Edge-Auswahl." };
            }

            const startFace = Math.floor(indices.length / 3);
            const created = makeFaceFromVertices({
                layer,
                mesh,
                vertices,
                indices,
                stride: normalized.stride,
                values,
            });

            if (!created) {
                return { changed: false, message: "Face konnte nicht erstellt werden." };
            }

            state.selection.faces = [startFace];

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

        const pushedSideEdges = new Set();
        const pushSideQuad = (a, b) => {
            if (!cloneMap.has(a) || !cloneMap.has(b)) {
                return;
            }

            const key = edgeKey(a, b);
            if (pushedSideEdges.has(key)) {
                return;
            }
            pushedSideEdges.add(key);

            const ca = cloneMap.get(a);
            const cb = cloneMap.get(b);
            indices.push(a, b, cb, a, cb, ca);
        };

        if (selectedFaces.length) {
            selectedFaces.forEach(face => {
                const offset = face * 3;
                if (offset + 2 >= normalized.indices.length) {
                    return;
                }

                const a = normalized.indices[offset];
                const b = normalized.indices[offset + 1];
                const c = normalized.indices[offset + 2];

                if (![a, b, c].every(index => cloneMap.has(index))) {
                    return;
                }

                indices.push(cloneMap.get(a), cloneMap.get(b), cloneMap.get(c));
                [[a, b], [b, c], [c, a]].forEach(([left, right]) => {
                    const neighborUsesEdge = (() => {
                        let count = 0;
                        for (let i = 0; i < normalized.indices.length; i += 3) {
                            const tri = [normalized.indices[i], normalized.indices[i + 1], normalized.indices[i + 2]];
                            if (tri.includes(left) && tri.includes(right) && selectedFaces.includes(i / 3)) {
                                count += 1;
                            }
                        }
                        return count > 1;
                    })();

                    if (!neighborUsesEdge) {
                        pushSideQuad(left, right);
                    }
                });
            });
        } else {
            selectedEdges.forEach(key => {
                const [a, b] = parseEdgeKey(key);
                pushSideQuad(a, b);
            });

            if (!selectedEdges.length && selected.length >= 3) {
                pushTriangulatedFace({
                    vertices,
                    indices,
                    stride: normalized.stride,
                    values: Array.from(cloneMap.values()),
                });
            }
        }

        applyMeshToLayer(layer, mesh, vertices, indices, normalized.stride, "geometry-edit:extrude", {
            uvPreserved: true,
            sideFaces: pushedSideEdges.size,
        });

        state.selection.vertices = Array.from(cloneMap.values());
        state.selection.edges = [];
        state.selection.faces = [];
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
                uvPreserved: true,
            });
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