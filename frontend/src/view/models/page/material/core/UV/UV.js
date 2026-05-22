import { uuid } from "@/utils/uuid";

export class UV {
    static UV_OFFSET = 6;
    static DIFFUSE_SLOT = "baseColor";
    static MODES = Object.freeze([
        "cubemap",
        "unwrap",
        "planar",
        "cylindrical",
        "spherical",
        "primitive",
    ]);

    static TOOLS = Object.freeze([
        "select",
        "move",
        "scale",
        "rotate",
        "seam",
    ]);

    static createBitmap(settings = {}) {
        const targetSlot = UV.DIFFUSE_SLOT;

        return {
            layer_id: "",
            url: "",
            name: "",
            width: 0,
            height: 0,
            channel: "rgba",
            color_mode: "color",
            strength: 1,
            offset: 0,
            invert: false,
            filename: "",
            cached: false,

            ...(settings || {}),

            // UV ist immer Diffuse/BaseColor.
            // Fremde Slots aus alten Daten werden hier bewusst überschrieben.
            bitmap_slot: targetSlot,
            target_slot: targetSlot,
            target_slots: [targetSlot],
        };
    }

    static createCubeFace(face, x, y, width = 0.25, height = 1 / 3) {
        return {
            face,
            enabled: true,

            x,
            y,
            width,
            height,

            translate_x: 0,
            translate_y: 0,
            scale_x: 1,
            scale_y: 1,
            rotate: 0,
            flip_x: false,
            flip_y: false,

            bitmap: UV.createBitmap(),
            bitmaps: {},
        };
    }

    static create() {
        return {
            mode: "unwrap",
            view_mode: "unwrap",
            active_face: "front",
            selected_faces: ["front"],

            tool: "select",
            snap_enabled: false,
            snap_size: 0.025,
            show_grid: true,
            show_islands: true,
            show_seams: true,
            show_vertices: true,
            show_edges: true,
            show_triangles: true,

            unwrap_mode: "primitive",
            unwrap_projection: "primitive",
            unwrap_padding: 0.015,
            unwrap_normalize: true,
            unwrap_rotate_islands: false,
            unwrap_pack: true,

            active_island_id: "",
            selected_island_ids: [],
            selected_vertex_ids: [],
            selected_edge_ids: [],
            selected_seam_ids: [],

            islands: [],
            vertices: [],
            edges: [],
            triangles: [],
            seams: [],

            target_slot: UV.DIFFUSE_SLOT,
            target_slots: [UV.DIFFUSE_SLOT],

            atlas: "cross",

            faces: {
                top: UV.createCubeFace("top", 0.25, 0),
                left: UV.createCubeFace("left", 0, 1 / 3),
                front: UV.createCubeFace("front", 0.25, 1 / 3),
                right: UV.createCubeFace("right", 0.5, 1 / 3),
                back: UV.createCubeFace("back", 0.75, 1 / 3),
                bottom: UV.createCubeFace("bottom", 0.25, 2 / 3),
            },
        };
    }

    static normalize(uv = {}) {
        const defaults = UV.create();

        return {
            ...defaults,
            ...(uv || {}),

            mode: UV.MODES.includes(uv.mode) ? uv.mode : defaults.mode,
            view_mode: uv.view_mode || uv.mode || defaults.view_mode,
            tool: UV.TOOLS.includes(uv.tool) ? uv.tool : defaults.tool,

            // UV Editor arbeitet ausschließlich auf Diffuse/baseColor.
            target_slot: UV.DIFFUSE_SLOT,
            target_slots: [UV.DIFFUSE_SLOT],

            faces: {
                ...defaults.faces,
                ...Object.fromEntries(Object.entries(uv.faces || {}).map(([faceName, face]) => {
                    const bitmap = UV.createBitmap(
                        face?.bitmaps?.[UV.DIFFUSE_SLOT] ||
                        face?.bitmap ||
                        {}
                    );

                    return [
                        faceName,
                        {
                            ...(defaults.faces[faceName] || {}),
                            ...(face || {}),

                            // Legacy/aktive Anzeige.
                            bitmap,

                            // Keine fremden Slots mehr übernehmen.
                            bitmaps: {
                                [UV.DIFFUSE_SLOT]: bitmap,
                            },
                        },
                    ];
                })),
            },

            islands: Array.isArray(uv.islands)
                ? uv.islands.map(island => {
                    const bitmap = UV.createBitmap(
                        island?.bitmaps?.[UV.DIFFUSE_SLOT] ||
                        island?.bitmap ||
                        {}
                    );

                    return {
                        ...island,

                        // Legacy/aktive Anzeige.
                        bitmap,

                        // Keine Multi-Slot-UV-Daten.
                        bitmaps: {
                            [UV.DIFFUSE_SLOT]: bitmap,
                        },
                    };
                })
                : [],

            vertices: Array.isArray(uv.vertices) ? uv.vertices : [],
            edges: Array.isArray(uv.edges) ? uv.edges : [],
            triangles: Array.isArray(uv.triangles) ? uv.triangles : [],
            seams: Array.isArray(uv.seams) ? uv.seams : [],

            selected_faces: Array.isArray(uv.selected_faces) && uv.selected_faces.length
                ? uv.selected_faces
                : defaults.selected_faces,

            selected_island_ids: Array.isArray(uv.selected_island_ids) ? uv.selected_island_ids : [],
            selected_vertex_ids: Array.isArray(uv.selected_vertex_ids) ? uv.selected_vertex_ids : [],
            selected_edge_ids: Array.isArray(uv.selected_edge_ids) ? uv.selected_edge_ids : [],
            selected_seam_ids: Array.isArray(uv.selected_seam_ids) ? uv.selected_seam_ids : [],
        };
    }

    static normalizeBitmapMap(bitmaps = {}, legacyBitmap = null) {
        const normalized = {};

        const baseBitmap =
            bitmaps?.[UV.DIFFUSE_SLOT] ||
            legacyBitmap ||
            null;

        if (baseBitmap && typeof baseBitmap === "object") {
            normalized[UV.DIFFUSE_SLOT] = UV.createBitmap(baseBitmap);
        }

        return normalized;
    }

    static reset(uv = {}) {
        return UV.normalize(uv);
    }

    static update(parameters, patch = {}) {
        if (!parameters) {
            return null;
        }

        parameters.uv = UV.reset({
            ...(parameters.uv || {}),
            ...(patch || {}),
        });

        return parameters.uv;
    }

    static preserveIslandBitmaps(layout, previousIslands = []) {
        const previousById = new Map(previousIslands.map(item => [item.id, item]));
        const previousByKey = new Map(previousIslands.map(item => [
            `${item.faceName || ""}:${item.partName || ""}:${item.name || ""}`,
            item,
        ]));

        layout.islands = layout.islands.map(island => {
            const key = `${island.faceName || ""}:${island.partName || ""}:${island.name || ""}`;
            const previous = previousById.get(island.id) || previousByKey.get(key);

            const bitmap = UV.createBitmap(
                previous?.bitmaps?.[UV.DIFFUSE_SLOT] ||
                previous?.bitmap ||
                island?.bitmaps?.[UV.DIFFUSE_SLOT] ||
                island?.bitmap ||
                {}
            );

            return {
                ...island,
                bitmap,
                bitmaps: {
                    [UV.DIFFUSE_SLOT]: bitmap,
                },
            };
        });

        return layout;
    }

    static clonePlain(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return value;
        }
    }

    static cloneMesh(mesh) {
        return {
            ...mesh,
            settings: UV.clonePlain(mesh.settings || {}),
            vertices: mesh.vertices instanceof Float32Array
                ? new Float32Array(mesh.vertices)
                : new Float32Array(mesh.vertices || []),
            indices: mesh.indices instanceof Uint32Array
                ? new Uint32Array(mesh.indices)
                : mesh.indices instanceof Uint16Array
                    ? new Uint16Array(mesh.indices)
                    : new Uint16Array(mesh.indices || []),
            parts: UV.clonePlain(mesh.parts || []),
            bounds: UV.clonePlain(mesh.bounds || {}),
            meta: UV.clonePlain(mesh.meta || {}),
        };
    }

    static unwrapMesh(mesh, uv = {}, context = {}) {
        const normalized = UV.normalize(uv);
        const sourceMesh = UV.cloneMesh(mesh);
        const hasManualLayout = normalized.vertices.length && normalized.triangles.length;

        const layout = hasManualLayout
            ? UV.normalizeLayout(normalized)
            : UV.createPrimitiveLayout(sourceMesh, normalized, context);

        UV.preserveIslandBitmaps(layout, normalized.islands);
        const nextMesh = UV.writeLayoutToMesh(sourceMesh, layout);

        return {
            mesh: {
                ...nextMesh,
                meta: {
                    ...(nextMesh.meta || {}),
                    uvApplied: true,
                    uvMode: normalized.mode,
                    uvLayoutVersion: layout.version,
                    uvIslandCount: layout.islands.length,
                    uvVertexCount: layout.vertices.length,
                    uvTriangleCount: layout.triangles.length,
                    uvSource: context.source || "uv",
                    rootKey: context.rootKey || nextMesh.meta?.rootKey || "",
                },
            },

            uv: {
                ...normalized,
                mode: "unwrap",
                view_mode: normalized.view_mode,
                islands: layout.islands,
                vertices: layout.vertices,
                edges: layout.edges,
                triangles: layout.triangles,
                seams: layout.seams,
                active_island_id: normalized.active_island_id || layout.islands[0]?.id || "",
            },
        };
    }

    static normalizeLayout(uv) {
        return {
            version: uv.version || Date.now(),
            islands: UV.clonePlain(uv.islands || []),
            vertices: UV.clonePlain(uv.vertices || []),
            edges: UV.clonePlain(uv.edges || []),
            triangles: UV.clonePlain(uv.triangles || []),
            seams: UV.clonePlain(uv.seams || []),
        };
    }

    static createPrimitiveLayout(mesh, uv = {}, context = {}) {
        const primitive = String(mesh.primitive || mesh.settings?.primitive || context.geometry?.primitive || "cube").toLowerCase();

        if (primitive === "plane") {
            return UV.unwrapPlane(mesh, uv);
        }

        if (primitive === "sphere") {
            return UV.unwrapSphere(mesh, uv);
        }

        if (primitive === "cylinder") {
            return UV.unwrapCylinder(mesh, uv);
        }

        return UV.unwrapBox(mesh, uv);
    }

    static unwrapBox(mesh, uv = {}) {
        const layout = UV.createEmptyLayout();
        const faces = uv.faces || UV.create().faces;

        (mesh.parts || []).forEach(part => {
            const faceName = part.faceName || part.materialSlot || part.name || "front";
            const faceRect = faces[faceName] || faces.front || UV.createCubeFace("front", 0, 0, 1, 1);
            const island = UV.createIsland({
                name: faceName,
                primitive: "box",
                part,
                faceName,
            });

            layout.islands.push(island);

            UV.triangulatePartAsIsland({
                mesh,
                part,
                layout,
                island,
                mapLocalUv: localUv => UV.mapUvToRect(localUv, faceRect),
            });
        });

        layout.seams = UV.createPrimitiveSeams(mesh, "box");
        UV.rebuildEdges(layout);

        return UV.finalizeLayout(layout, uv);
    }

    static unwrapPlane(mesh, uv = {}) {
        const layout = UV.createEmptyLayout();
        const island = UV.createIsland({
            name: "plane",
            primitive: "plane",
            faceName: "front",
        });

        layout.islands.push(island);

        const bounds = UV.computeBounds(mesh.vertices, mesh.stride);

        UV.triangulateWholeMeshAsIsland({
            mesh,
            layout,
            island,
            mapPosition: position => {
                const sx = Math.max(bounds.size[0], 0.00001);
                const sy = Math.max(bounds.size[1], 0.00001);

                return [
                    (position[0] - bounds.min[0]) / sx,
                    1 - ((position[1] - bounds.min[1]) / sy),
                ];
            },
        });

        layout.seams = UV.createPrimitiveSeams(mesh, "plane");
        UV.rebuildEdges(layout);

        return UV.finalizeLayout(layout, uv);
    }

    static unwrapCylinder(mesh, uv = {}) {
        const layout = UV.createEmptyLayout();
        const bounds = UV.computeBounds(mesh.vertices, mesh.stride);

        (mesh.parts || []).forEach(part => {
            const name = part.name || part.faceName || "cylinder";
            const isCap = ["top", "bottom"].includes(part.faceName);

            const island = UV.createIsland({
                name,
                primitive: "cylinder",
                part,
                faceName: part.faceName || name,
            });

            layout.islands.push(island);

            if (isCap) {
                UV.triangulatePartAsIsland({
                    mesh,
                    part,
                    layout,
                    island,
                    mapPosition: position => [
                        position[0] + 0.5,
                        position[2] + 0.5,
                    ],
                });
            } else {
                UV.triangulatePartAsIsland({
                    mesh,
                    part,
                    layout,
                    island,
                    mapPosition: position => {
                        const u = 0.5 + Math.atan2(position[2], position[0]) / (Math.PI * 2);
                        const v = 1 - ((position[1] - bounds.min[1]) / Math.max(bounds.size[1], 0.00001));

                        return [u, v];
                    },
                });
            }
        });

        layout.seams = UV.createPrimitiveSeams(mesh, "cylinder");
        UV.rebuildEdges(layout);

        return UV.finalizeLayout(layout, uv);
    }

    static unwrapSphere(mesh, uv = {}) {
        const layout = UV.createEmptyLayout();
        const island = UV.createIsland({
            name: "sphere",
            primitive: "sphere",
            faceName: "front",
        });

        layout.islands.push(island);

        UV.triangulateWholeMeshAsIsland({
            mesh,
            layout,
            island,
            mapPosition: position => {
                const n = UV.normalize3(position);
                const u = 0.5 + Math.atan2(n[2], n[0]) / (Math.PI * 2);
                const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, n[1]))) / Math.PI;

                return [u, v];
            },
        });

        layout.seams = UV.createPrimitiveSeams(mesh, "sphere");
        UV.rebuildEdges(layout);

        return UV.finalizeLayout(layout, uv);
    }

    static createPrimitiveSeams(mesh, primitive) {
        const seams = [];

        if (primitive === "box") {
            (mesh.parts || []).forEach(part => {
                seams.push({
                    id: uuid("seam"),
                    primitive,
                    type: "part-boundary",
                    faceName: part.faceName || part.name || "front",
                    partName: part.name || part.faceName || "part",
                    locked: false,
                    generated: true,
                });
            });

            return seams;
        }

        if (primitive === "cylinder") {
            seams.push(
                {
                    id: uuid("seam"),
                    primitive,
                    type: "vertical",
                    name: "side vertical seam",
                    axis: "y",
                    angle: 180,
                    locked: false,
                    generated: true,
                },
                {
                    id: uuid("seam"),
                    primitive,
                    type: "cap-loop",
                    name: "top cap loop",
                    faceName: "top",
                    locked: false,
                    generated: true,
                },
                {
                    id: uuid("seam"),
                    primitive,
                    type: "cap-loop",
                    name: "bottom cap loop",
                    faceName: "bottom",
                    locked: false,
                    generated: true,
                }
            );

            return seams;
        }

        if (primitive === "sphere") {
            seams.push(
                {
                    id: uuid("seam"),
                    primitive,
                    type: "longitude",
                    name: "longitude seam",
                    angle: 180,
                    locked: false,
                    generated: true,
                },
                {
                    id: uuid("seam"),
                    primitive,
                    type: "pole",
                    name: "top pole seam",
                    pole: "top",
                    locked: false,
                    generated: true,
                },
                {
                    id: uuid("seam"),
                    primitive,
                    type: "pole",
                    name: "bottom pole seam",
                    pole: "bottom",
                    locked: false,
                    generated: true,
                }
            );

            return seams;
        }

        seams.push({
            id: uuid("seam"),
            primitive,
            type: "boundary",
            name: "boundary seam",
            locked: false,
            generated: true,
        });

        return seams;
    }

    static getSlots(uv = {}) {
        const mode = String(uv.view_mode || uv.mode || "unwrap").toLowerCase();

        if (mode === "cubemap" || mode === "face") {
            return Object.keys(uv.faces || {}).map(faceName => ({
                id: faceName,
                key: faceName,
                label: faceName,
                type: "face",
                selected: Array.isArray(uv.selected_faces) && uv.selected_faces.includes(faceName),
                active: uv.active_face === faceName,
                bitmap: uv.faces?.[faceName]?.bitmaps?.[UV.DIFFUSE_SLOT] || uv.faces?.[faceName]?.bitmap || {},
            }));
        }

        return (uv.islands || []).map((island, index) => ({
            id: island.id,
            key: island.id,
            label: island.name || `Island ${index + 1}`,
            type: "island",
            selected: Array.isArray(uv.selected_island_ids) && uv.selected_island_ids.includes(island.id),
            active: uv.active_island_id === island.id,
            island,
            vertexCount: Array.isArray(island.vertex_ids) ? island.vertex_ids.length : 0,
            triangleCount: Array.isArray(island.triangle_ids) ? island.triangle_ids.length : 0,
            bitmap: island.bitmaps?.[UV.DIFFUSE_SLOT] || island.bitmap || {},
        }));
    }

    static selectSlot(uv = {}, slotId, { additive = false } = {}) {
        const next = UV.normalize(uv);
        const mode = String(next.view_mode || next.mode || "unwrap").toLowerCase();

        if (mode === "cubemap" || mode === "face") {
            const set = new Set(additive ? next.selected_faces || [] : []);

            if (set.has(slotId) && additive) {
                set.delete(slotId);
            } else {
                set.add(slotId);
            }

            next.active_face = slotId;
            next.selected_faces = Array.from(set);

            return next;
        }

        return UV.selectIsland(next, slotId, { additive });
    }

    static createEmptyLayout() {
        return {
            version: Date.now(),
            islands: [],
            vertices: [],
            edges: [],
            triangles: [],
            seams: [],
        };
    }

    static createIsland({
                            name = "island",
                            primitive = "mesh",
                            part = null,
                            faceName = "front",
                        } = {}) {
        const bitmap = UV.createBitmap();

        return {
            id: uuid("uv-island"),
            name,
            primitive,
            faceName,
            partName: part?.name || part?.faceName || "",
            selected: false,
            locked: false,
            translate_x: 0,
            translate_y: 0,
            scale_x: 1,
            scale_y: 1,
            rotate: 0,
            vertex_ids: [],
            edge_ids: [],
            triangle_ids: [],
            bitmap,
            bitmaps: {
                [UV.DIFFUSE_SLOT]: bitmap,
            },
        };
    }

    static triangulateWholeMeshAsIsland({ mesh, layout, island, mapPosition }) {
        const part = {
            start: 0,
            count: mesh.indices.length,
            faceName: island.faceName,
            name: island.name,
        };

        UV.triangulatePartAsIsland({
            mesh,
            part,
            layout,
            island,
            mapPosition,
        });
    }

    static triangulatePartAsIsland({
                                       mesh,
                                       part,
                                       layout,
                                       island,
                                       mapLocalUv = null,
                                       mapPosition = null,
                                   }) {
        const start = Number(part.start || 0);
        const count = Number(part.count || 0);
        const end = Math.min(start + count, mesh.indices.length);

        for (let i = start; i < end; i += 3) {
            const corners = [
                UV.createUvLoopVertex(mesh, mesh.indices[i], island, mapLocalUv, mapPosition),
                UV.createUvLoopVertex(mesh, mesh.indices[i + 1], island, mapLocalUv, mapPosition),
                UV.createUvLoopVertex(mesh, mesh.indices[i + 2], island, mapLocalUv, mapPosition),
            ];

            corners.forEach(vertex => {
                layout.vertices.push(vertex);
                island.vertex_ids.push(vertex.id);
            });

            const triangle = {
                id: uuid("uv-triangle"),
                island_id: island.id,
                vertex_ids: corners.map(vertex => vertex.id),
                source_indices: [
                    Number(mesh.indices[i]),
                    Number(mesh.indices[i + 1]),
                    Number(mesh.indices[i + 2]),
                ],
            };

            layout.triangles.push(triangle);
            island.triangle_ids.push(triangle.id);
        }
    }

    static createUvLoopVertex(mesh, sourceIndex, island, mapLocalUv, mapPosition) {
        const position = UV.getVertexPosition(mesh, sourceIndex);
        const normal = UV.getVertexNormal(mesh, sourceIndex);
        const tangent = UV.getVertexTangent(mesh, sourceIndex);
        const localUv = UV.getVertexUv(mesh, sourceIndex);

        const mapped = mapLocalUv
            ? mapLocalUv(localUv, position, normal)
            : mapPosition
                ? mapPosition(position, normal, localUv)
                : localUv;

        return {
            id: uuid("uv-vertex"),
            island_id: island.id,
            source_index: Number(sourceIndex),
            x: UV.clamp01(mapped[0]),
            y: UV.clamp01(mapped[1]),
            selected: false,

            position,
            normal,
            tangent,
            source_uv: localUv,
        };
    }

    static rebuildEdges(layout) {
        const edgeMap = new Map();

        layout.triangles.forEach(triangle => {
            const ids = triangle.vertex_ids;

            [
                [ids[0], ids[1]],
                [ids[1], ids[2]],
                [ids[2], ids[0]],
            ].forEach(([from, to]) => {
                const key = [from, to].sort().join(":");

                if (!edgeMap.has(key)) {
                    const edge = {
                        id: uuid("uv-edge"),
                        island_id: triangle.island_id,
                        from,
                        to,
                        triangle_ids: [],
                        selected: false,
                        seam: false,
                    };

                    edgeMap.set(key, edge);
                    layout.edges.push(edge);
                }

                edgeMap.get(key).triangle_ids.push(triangle.id);
            });
        });

        const islandMap = new Map(layout.islands.map(island => [island.id, island]));

        layout.edges.forEach(edge => {
            const island = islandMap.get(edge.island_id);

            if (island) {
                island.edge_ids.push(edge.id);
            }
        });
    }

    static finalizeLayout(layout, uv = {}) {
        if (uv.unwrap_normalize !== false) {
            UV.normalizeLayoutToUnit(layout, Number(uv.unwrap_padding ?? 0.015));
        }

        if (uv.unwrap_pack !== false) {
            UV.packIslands(layout, Number(uv.unwrap_padding ?? 0.015));
        }

        return layout;
    }

    static normalizeLayoutToUnit(layout, padding = 0.015) {
        const bounds = UV.getLayoutBounds(layout.vertices);

        if (!bounds) {
            return;
        }

        const width = Math.max(bounds.maxX - bounds.minX, 0.00001);
        const height = Math.max(bounds.maxY - bounds.minY, 0.00001);
        const size = Math.max(width, height);
        const usable = Math.max(0.00001, 1 - padding * 2);

        layout.vertices.forEach(vertex => {
            vertex.x = padding + ((vertex.x - bounds.minX) / size) * usable;
            vertex.y = padding + ((vertex.y - bounds.minY) / size) * usable;
        });
    }

    static packIslands(layout, padding = 0.015) {
        const islands = layout.islands.map(island => ({
            island,
            bounds: UV.getIslandBounds(layout, island.id),
        })).filter(item => item.bounds);

        if (!islands.length) {
            return;
        }

        const columns = Math.ceil(Math.sqrt(islands.length));
        const cell = 1 / columns;

        islands.forEach((item, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const target = {
                x: col * cell + padding,
                y: row * cell + padding,
                w: cell - padding * 2,
                h: cell - padding * 2,
            };

            UV.fitIslandToRect(layout, item.island.id, target);
        });
    }

    static fitIslandToRect(layout, islandId, rect) {
        const vertices = layout.vertices.filter(vertex => vertex.island_id === islandId);
        const bounds = UV.getLayoutBounds(vertices);

        if (!bounds) {
            return;
        }

        const width = Math.max(bounds.maxX - bounds.minX, 0.00001);
        const height = Math.max(bounds.maxY - bounds.minY, 0.00001);
        const scale = Math.min(rect.w / width, rect.h / height);

        vertices.forEach(vertex => {
            vertex.x = rect.x + (vertex.x - bounds.minX) * scale + (rect.w - width * scale) * 0.5;
            vertex.y = rect.y + (vertex.y - bounds.minY) * scale + (rect.h - height * scale) * 0.5;
        });
    }

    static writeLayoutToMesh(mesh, layout) {
        const vertices = [];
        const indices = [];
        const stride = Number(mesh.stride || 11);
        const vertexById = new Map(layout.vertices.map(vertex => [vertex.id, vertex]));
        const validTriangleIds = new Set();
        const droppedTriangles = [];

        layout.triangles.forEach(triangle => {
            const triangleVertices = (triangle.vertex_ids || [])
                .map(vertexId => vertexById.get(vertexId))
                .filter(Boolean);

            if (triangleVertices.length !== 3) {
                droppedTriangles.push({
                    id: triangle.id,
                    island_id: triangle.island_id,
                    vertex_ids: triangle.vertex_ids || [],
                });

                return;
            }

            validTriangleIds.add(triangle.id);

            triangleVertices.forEach(uvVertex => {
                const position = Array.isArray(uvVertex.position) ? uvVertex.position : [0, 0, 0];
                const normal = Array.isArray(uvVertex.normal) ? uvVertex.normal : [0, 0, 1];
                const tangent = Array.isArray(uvVertex.tangent) ? uvVertex.tangent : [1, 0, 0];

                vertices.push(
                    Number(position[0]) || 0,
                    Number(position[1]) || 0,
                    Number(position[2]) || 0,
                    Number(normal[0]) || 0,
                    Number(normal[1]) || 0,
                    Number(normal[2]) || 1,
                    UV.clamp01(uvVertex.x),
                    UV.clamp01(uvVertex.y),
                    Number(tangent[0]) || 1,
                    Number(tangent[1]) || 0,
                    Number(tangent[2]) || 0,
                );

                indices.push(indices.length);
            });
        });

        if (droppedTriangles.length) {
            console.warn("[UV] dropped invalid layout triangles", {
                count: droppedTriangles.length,
                droppedTriangles,
            });
        }

        const typedIndices = indices.length > 65535
            ? new Uint32Array(indices)
            : new Uint16Array(indices);

        const nextMesh = {
            ...mesh,
            stride,
            vertices: new Float32Array(vertices),
            indices: typedIndices,
            indexType: typedIndices instanceof Uint32Array ? "uint32" : "uint16",
            count: typedIndices.length,
            parts: UV.rebuildMeshPartsFromLayout(mesh, {
                ...layout,
                islands: (layout.islands || []).map(island => ({
                    ...island,
                    triangle_ids: (island.triangle_ids || []).filter(id => validTriangleIds.has(id)),
                })),
            }),
            bounds: UV.computeBounds(new Float32Array(vertices), stride),
        };

        return nextMesh;
    }

    static rebuildMeshPartsFromLayout(mesh, layout) {
        let cursor = 0;
        const triangleById = new Map((layout.triangles || []).map(triangle => [triangle.id, triangle]));

        return (layout.islands || [])
            .map(island => {
                const triangleCount = (island.triangle_ids || [])
                    .map(id => triangleById.get(id))
                    .filter(triangle => Array.isArray(triangle?.vertex_ids) && triangle.vertex_ids.length === 3)
                    .length;

                const count = triangleCount * 3;

                const part = {
                    name: island.name,
                    faceName: island.faceName || "front",
                    materialSlot: island.faceName || "front",
                    start: cursor,
                    count,
                    island_id: island.id,
                };

                cursor += count;

                return part;
            })
            .filter(part => part.count > 0);
    }

    static moveSelection(uv, dx, dy) {
        const next = UV.normalize(uv);
        const selected = new Set(next.selected_vertex_ids || []);

        next.vertices = next.vertices.map(vertex => selected.has(vertex.id)
            ? {
                ...vertex,
                x: vertex.x + dx,
                y: vertex.y + dy,
            }
            : vertex
        );

        return next;
    }

    static scaleSelection(uv, scaleX, scaleY, origin = null) {
        const next = UV.normalize(uv);
        const selected = new Set(next.selected_vertex_ids || []);
        const vertices = next.vertices.filter(vertex => selected.has(vertex.id));
        const center = origin || UV.getVerticesCenter(vertices);

        next.vertices = next.vertices.map(vertex => selected.has(vertex.id)
            ? {
                ...vertex,
                x: center.x + (vertex.x - center.x) * scaleX,
                y: center.y + (vertex.y - center.y) * scaleY,
            }
            : vertex
        );

        return next;
    }

    static rotateSelection(uv, angleDeg, origin = null) {
        const next = UV.normalize(uv);
        const selected = new Set(next.selected_vertex_ids || []);
        const vertices = next.vertices.filter(vertex => selected.has(vertex.id));
        const center = origin || UV.getVerticesCenter(vertices);
        const angle = angleDeg * Math.PI / 180;
        const c = Math.cos(angle);
        const s = Math.sin(angle);

        next.vertices = next.vertices.map(vertex => {
            if (!selected.has(vertex.id)) {
                return vertex;
            }

            const x = vertex.x - center.x;
            const y = vertex.y - center.y;

            return {
                ...vertex,
                x: center.x + x * c - y * s,
                y: center.y + x * s + y * c,
            };
        });

        return next;
    }

    static pickVertex(uv, point, threshold = 0.018) {
        const vertices = uv.vertices || [];
        let best = null;
        let bestDistance = Infinity;

        vertices.forEach(vertex => {
            const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);

            if (distance < threshold && distance < bestDistance) {
                best = vertex;
                bestDistance = distance;
            }
        });

        return best;
    }

    static pickIsland(uv, point) {
        const islands = uv.islands || [];

        return islands.find(island => {
            const bounds = UV.getIslandBounds(uv, island.id);

            return bounds &&
                point.x >= bounds.minX &&
                point.x <= bounds.maxX &&
                point.y >= bounds.minY &&
                point.y <= bounds.maxY;
        }) || null;
    }

    static selectVertex(uv, vertexId, { additive = false } = {}) {
        const next = UV.normalize(uv);
        const set = new Set(additive ? next.selected_vertex_ids : []);

        if (set.has(vertexId) && additive) {
            set.delete(vertexId);
        } else {
            set.add(vertexId);
        }

        next.selected_vertex_ids = Array.from(set);
        next.vertices = next.vertices.map(vertex => ({
            ...vertex,
            selected: set.has(vertex.id),
        }));

        return next;
    }

    static selectIsland(uv, islandId, { additive = false } = {}) {
        const next = UV.normalize(uv);
        const island = next.islands.find(item => item.id === islandId);

        if (!island) {
            return next;
        }

        const islandVertexIds = new Set(island.vertex_ids || []);
        const current = new Set(additive ? next.selected_vertex_ids : []);

        islandVertexIds.forEach(id => current.add(id));

        next.active_island_id = islandId;
        next.selected_island_ids = additive
            ? Array.from(new Set([...(next.selected_island_ids || []), islandId]))
            : [islandId];

        next.selected_vertex_ids = Array.from(current);
        next.vertices = next.vertices.map(vertex => ({
            ...vertex,
            selected: current.has(vertex.id),
        }));

        return next;
    }

    static clearSelection(uv) {
        const next = UV.normalize(uv);

        next.selected_vertex_ids = [];
        next.selected_edge_ids = [];
        next.selected_island_ids = [];
        next.vertices = next.vertices.map(vertex => ({
            ...vertex,
            selected: false,
        }));
        next.edges = next.edges.map(edge => ({
            ...edge,
            selected: false,
        }));
        next.islands = next.islands.map(island => ({
            ...island,
            selected: false,
        }));

        return next;
    }

    static getVertexPosition(mesh, index) {
        const offset = index * mesh.stride;

        return [
            mesh.vertices[offset],
            mesh.vertices[offset + 1],
            mesh.vertices[offset + 2],
        ];
    }

    static getVertexNormal(mesh, index) {
        const offset = index * mesh.stride + 3;

        return [
            mesh.vertices[offset],
            mesh.vertices[offset + 1],
            mesh.vertices[offset + 2],
        ];
    }

    static getVertexUv(mesh, index) {
        const offset = index * mesh.stride + UV.UV_OFFSET;

        return [
            mesh.vertices[offset],
            mesh.vertices[offset + 1],
        ];
    }

    static getVertexTangent(mesh, index) {
        const offset = index * mesh.stride + 8;

        return [
            mesh.vertices[offset],
            mesh.vertices[offset + 1],
            mesh.vertices[offset + 2],
        ];
    }

    static mapUvToRect(uv, face = {}) {
        let u = Number(uv[0] || 0);
        let v = Number(uv[1] || 0);

        if (face.flip_x === true) {
            u = 1 - u;
        }

        if (face.flip_y === true) {
            v = 1 - v;
        }

        const scaleX = Number(face.scale_x ?? 1) || 1;
        const scaleY = Number(face.scale_y ?? 1) || 1;
        const translateX = Number(face.translate_x ?? 0) || 0;
        const translateY = Number(face.translate_y ?? 0) || 0;
        const rotate = Number(face.rotate ?? 0) * Math.PI / 180;

        u = (u - 0.5) * scaleX + 0.5 + translateX;
        v = (v - 0.5) * scaleY + 0.5 + translateY;

        if (Math.abs(rotate) > 0.00001) {
            const x = u - 0.5;
            const y = v - 0.5;
            const c = Math.cos(rotate);
            const s = Math.sin(rotate);

            u = x * c - y * s + 0.5;
            v = x * s + y * c + 0.5;
        }

        return [
            Number(face.x || 0) + u * Number(face.width || 1),
            Number(face.y || 0) + v * Number(face.height || 1),
        ];
    }

    static getLayoutBounds(vertices = []) {
        if (!vertices.length) {
            return null;
        }

        return vertices.reduce((acc, vertex) => ({
            minX: Math.min(acc.minX, vertex.x),
            minY: Math.min(acc.minY, vertex.y),
            maxX: Math.max(acc.maxX, vertex.x),
            maxY: Math.max(acc.maxY, vertex.y),
        }), {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
        });
    }

    static getIslandBounds(uvOrLayout, islandId) {
        const vertices = (uvOrLayout.vertices || []).filter(vertex => vertex.island_id === islandId);

        return UV.getLayoutBounds(vertices);
    }

    static getVerticesCenter(vertices = []) {
        if (!vertices.length) {
            return { x: 0.5, y: 0.5 };
        }

        const sum = vertices.reduce((acc, vertex) => ({
            x: acc.x + vertex.x,
            y: acc.y + vertex.y,
        }), { x: 0, y: 0 });

        return {
            x: sum.x / vertices.length,
            y: sum.y / vertices.length,
        };
    }

    static computeBounds(vertices, stride = 11) {
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        for (let i = 0; i < vertices.length; i += stride) {
            min[0] = Math.min(min[0], vertices[i]);
            min[1] = Math.min(min[1], vertices[i + 1]);
            min[2] = Math.min(min[2], vertices[i + 2]);

            max[0] = Math.max(max[0], vertices[i]);
            max[1] = Math.max(max[1], vertices[i + 1]);
            max[2] = Math.max(max[2], vertices[i + 2]);
        }

        return {
            min,
            max,
            size: [
                max[0] - min[0],
                max[1] - min[1],
                max[2] - min[2],
            ],
            center: [
                (min[0] + max[0]) * 0.5,
                (min[1] + max[1]) * 0.5,
                (min[2] + max[2]) * 0.5,
            ],
        };
    }

    static normalize3(vector) {
        const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

        return [
            vector[0] / length,
            vector[1] / length,
            vector[2] / length,
        ];
    }

    static clamp01(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.min(Math.max(number, 0), 1);
    }
}
