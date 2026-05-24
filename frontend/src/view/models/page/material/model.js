import {computed, onBeforeUnmount, onMounted, reactive, ref, watch,} from "vue";
import {clamp, clone} from "@/utils/tools";
import {uuid} from "@/utils/uuid";
import {colorArrayToHex, hexToRgbaArray} from "@/utils/color";
import {Node} from "@/view/models/page/material/core/Node/Node";
import {Mesh} from "@/view/models/page/material/core/Mesh/Mesh";
import {UV} from "@/view/models/page/material/core/UV/UV";
import {ParticleSystem} from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";
import {Volume} from "@/view/models/page/material/core/Volume/Volume";
import {Fluid} from "@/view/models/page/material/core/Fluid/Fluid";
import {
    createBitmapMaps, createSurface, createPhysics, createGeometry,
    createLight, createSettings, createShaderNode, createParticles,
    createMesh, createOutputNode, createShaderGraph, createUv, createPrincipledNode,
    PRINCIPLED_SURFACE_GROUPS, SURFACE_FIELD_MAP, SURFACE_FIELDS, PREVIEW_DEBOUNCE_MS,
    TEXTURE_CHANNEL_OPTIONS, TEXTURE_COLOR_MODE_OPTIONS, TEXTURE_SIZE_OPTIONS,
    getTextureSettingDefaults
} from "@/dataLayer/webgl";

import {normalizeTextureSize} from "@/view/models/page/material/settings/model";
import {timelineStates} from "@/dataLayer/state";
import {timelineData} from "@/models/timeline/config/model";


const normalizeNodeSettings = node => Node.normalizeSettings(node);
const getShaderNodeFieldItems = node => Node.getFieldItems(node);
const getShaderNodeFieldOptions = (node, fieldKey) => Node.getFieldOptions(node, fieldKey);
const getNodeCategoryChip = node => Node.getGroup(node);
const getShaderNodeIcon = node => Node.getIcon(node);

const normalizeTextureSettings = (settings = {}) => {
    const rawStrength = Number.isFinite(Number(settings.strength)) ? Number(settings.strength) : 1;
    const strength = settings.invert === true && rawStrength > 0 ? -rawStrength : rawStrength;

    return {
        channel: TEXTURE_CHANNEL_OPTIONS.includes(settings.channel) ? settings.channel : getTextureSettingDefaults(settings.slot || settings.target_slot).channel,
        color_mode: TEXTURE_COLOR_MODE_OPTIONS.includes(settings.color_mode) ? settings.color_mode : getTextureSettingDefaults(settings.slot || settings.target_slot).color_mode,
        strength,
        offset: Number.isFinite(Number(settings.offset)) ? Number(settings.offset) : 0,
        invert: false,
    };
};

const mergeTextureSettings = (...sources) => {
    return normalizeTextureSettings(
        sources.reduce((acc, source) => ({
            ...acc,
            ...(source || {}),
        }), {})
    );
};

const mergeTextureSettingsForSlot = (slotKey, ...sources) => mergeTextureSettings(
    getTextureSettingDefaults(slotKey),
    { slot: slotKey },
    ...sources,
);

const hasTextureSlot = slot => {
    if (!slot) {
        return false;
    }

    if (slot.url || slot.layer_id) {
        return true;
    }

    return Array.isArray(slot.texture_groups) && slot.texture_groups.some(group => group?.url || group?.layer_id);

};

export function materialEditorModel(props, emit) {
    const previewTimer = ref(null);
    const previewRequestId = ref(0);
    const previewStableTime = ref(Date.now());

    const materialSourceLayerId = ref("");
    const draggingSourceLayerId = ref("");
    const uvTextureLayerId = ref("");

    const nodeCanvasRef = ref(null);
    const activeConnection = ref(null);
    const pointerPosition = ref({ x: 0, y: 0 });
    const draggingNode = ref(null);
    const activeShaderNodeId = ref("principled-bsdf");
    const uvCanvasRef = ref(null);
    const uvViewportRef = ref(null);
    const uvViewportId = `uv-viewport-${uuid()}`;
    const uvCanvasId = `uv-canvas-${uuid()}`;
    const uvBoxSelectState = ref(false);
    const uvMoveAxis = ref("");
    const uvHoverState = ref("empty");
    const activeSnapEdgeId = ref("");
    const SNAP_EDGE_DISTANCE = 34;
    const pauseAutoSync = ref(false);
    const nodePositionMemory = reactive({});
    const collapsedNodeIds = reactive({});
    const nodeLayoutVersion = ref(0);
    const socketOffsetMemory = {};
    const uvImageCache = new Map();
    const uvViewport = reactive({
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
    });

    const uvDragState = reactive({
        active: false,
        mode: "",
        last: { x: 0, y: 0 },
    });

    const nodeCanvas = reactive({
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
    });

    const values = reactive({
        name: "Cube Material",
        surface: createSurface(),
        geometry: createGeometry(),
        mesh: createMesh(createGeometry()),
        particle_system: createParticles(),
        physics: createPhysics(),
        light: createLight(),
        bitmap_maps: createBitmapMaps(),
        uv: createUv(),
        shader_graph: createShaderGraph(),

        cube_size: 256,
        rotate_preview: true,
        wireframe_preview: false,
        faces_preview: false,
        vertices_preview: false,
        fluid_mesh_preview: true,
        fluid_particle_preview: true,
        render_backend: "WEBGL2",
        texture_size: "Original",
        texture_preload: TEXTURE_SIZE_OPTIONS,
        blend_mode: "BLEND",
        alpha_clip: 0.5,
        shadow_method: "HASHED",
        backface_culling: false,
        show_backface: true,
        screen_space_refraction: false,
        refraction_depth: 0,
        subsurface_translucency: false,
        use_nodes: true,
    });

    const uvCanvasStyle = computed(() => ({
        transform: `translate(${uvViewport.panX}px, ${uvViewport.panY}px) scale(${uvViewport.zoom})`,
        transformOrigin: "0 0",
    }));

    const isEditingMaterialLayer = computed(() => {
        return Number(props.layer?.type) === 5;
    });

    const materialModeLabel = computed(() => {
        if (isEditingMaterialLayer.value) {
            return "Material Update";
        }

        if (props.layer?.id) {
            return "Single Layer";
        }

        return "Layer Auswahl";
    });

    const textureLayers = computed(() => {
        return (props.layers || []).filter(isUsableTextureLayer);
    });

    const sourceLayerThumbnail = computed(() => {
        return resolveLayerThumbnailUrl(selectedSourceLayer.value);
    });

    const sourceLayerTextureUrl = computed(() => {
        return resolveLayerTextureUrl(selectedSourceLayer.value);
    });

    const isUsableTextureLayer = layer => {
        if (!layer || layer.hidden === 1) {
            return false;
        }

        return [0, 2].includes(Number(layer.type));
    };

    const uvSelectedVertexCount = computed(() => (
        Array.isArray(values.uv.selected_vertex_ids)
            ? values.uv.selected_vertex_ids.length
            : 0
    ));

    const selectedUvVertices = computed(() => {
        const selected = new Set(values.uv.selected_vertex_ids || []);

        return (values.uv.vertices || []).filter(vertex => (
            selected.has(vertex.id)
        ));
    });

    const getUvVertexX = vertex => Number(
        vertex?.x ??
        vertex?.u ??
        vertex?.uv?.x ??
        vertex?.uv?.[0] ??
        0
    );

    const getUvVertexY = vertex => Number(
        vertex?.y ??
        vertex?.v ??
        vertex?.uv?.y ??
        vertex?.uv?.[1] ??
        0
    );

    const setUvVertexPosition = (vertex, x, y) => {
        if (!vertex) {
            return vertex;
        }

        const next = {
            ...vertex,
        };

        if ("x" in next || !("u" in next)) {
            next.x = x;
        }

        if ("y" in next || !("v" in next)) {
            next.y = y;
        }

        if ("u" in next) {
            next.u = x;
        }

        if ("v" in next) {
            next.v = y;
        }

        if (next.uv && typeof next.uv === "object") {
            if (Array.isArray(next.uv)) {
                next.uv = [x, y];
            } else {
                next.uv = {
                    ...next.uv,
                    x,
                    y,
                };
            }
        }

        return next;
    };

    const setUvBoxSelectState = state => {
        uvBoxSelectState.value = state === true;

        emitEvent("select-state", uvBoxSelectState.value);
    };

    const toggleUvBoxSelect = () => {
        setUvBoxSelectState(!uvBoxSelectState.value);
    };

    const clearUvSelection = () => {
        values.uv.selected_vertex_ids = [];
        values.uv.selected_edge_ids = [];
        values.uv.selected_island_ids = [];
    };

    const UV_CANVAS_SIZE = 720;
    const UV_CANVAS_PADDING = 42;

    const getUvGridSize = () => UV_CANVAS_SIZE - UV_CANVAS_PADDING * 2;

    const normalizeSelectionBox = box => {
        if (!box) {
            return null;
        }

        const x = Number(box.x || 0);
        const y = Number(box.y || 0);
        const width = Number(box.width || 0);
        const height = Number(box.height || 0);

        return {
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
        };
    };

    const getSelectionBoxInUvStageSpace = box => {
        const normalized = normalizeSelectionBox(box);
        const stage = uvViewportRef.value;

        if (!normalized || !stage) {
            return null;
        }

        const selectionRoot = stage.querySelector(".selection-root");

        if (!selectionRoot) {
            return normalized;
        }

        const stageRect = stage.getBoundingClientRect();
        const selectionRect = selectionRoot.getBoundingClientRect();

        const x = normalized.x + selectionRect.left - stageRect.left;
        const y = normalized.y + selectionRect.top - stageRect.top;

        return {
            x,
            y,
            width: normalized.width,
            height: normalized.height,
            left: x,
            top: y,
            right: x + normalized.width,
            bottom: y + normalized.height,
        };
    };

    const getUvVertexCanvasPoint = vertex => {
        const gridSize = getUvGridSize();

        return {
            x: UV_CANVAS_PADDING + getUvVertexX(vertex) * gridSize,
            y: UV_CANVAS_PADDING + getUvVertexY(vertex) * gridSize,
        };
    };

    const getUvVertexStagePoint = vertex => {
        const stage = uvViewportRef.value;
        const canvas = uvCanvasRef.value;

        if (!stage || !canvas) {
            return null;
        }

        const stageRect = stage.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const canvasPoint = getUvVertexCanvasPoint(vertex);

        /**
         * Wichtig:
         * canvasRect ist die echte sichtbare Canvas-Fläche nach CSS width,
         * max-width, translate und scale.
         *
         * canvasPoint ist im internen 720er-Zeichenraum.
         */
        return {
            x: canvasRect.left - stageRect.left + (canvasPoint.x / UV_CANVAS_SIZE) * canvasRect.width,
            y: canvasRect.top - stageRect.top + (canvasPoint.y / UV_CANVAS_SIZE) * canvasRect.height,
        };
    };

    const isUvPointInsideBox = (point, box, tolerance = 0) => {
        if (!point || !box) {
            return false;
        }

        return (
            point.x >= box.left - tolerance &&
            point.x <= box.right + tolerance &&
            point.y >= box.top - tolerance &&
            point.y <= box.bottom + tolerance
        );
    };

    const getUvVerticesInsideSelectionBox = box => {
        const selectionBox = getSelectionBoxInUvStageSpace(box);

        if (!selectionBox) {
            return [];
        }

        const canvas = uvCanvasRef.value;
        const canvasRect = canvas?.getBoundingClientRect?.();

        const visualScale = canvasRect
            ? Math.max(canvasRect.width, canvasRect.height) / UV_CANVAS_SIZE
            : 1;

        const tolerance = Math.max(3, 5 * visualScale);

        return (values.uv.vertices || []).filter(vertex => {
            const point = getUvVertexStagePoint(vertex);

            return isUvPointInsideBox(point, selectionBox, tolerance);
        });
    };

    const selectUvVerticesByBox = async box => {
        if (values.uv.view_mode !== "unwrap") {
            return;
        }

        if (!box) {
            clearUvSelection();
            await drawUvCanvas();
            return;
        }

        if (!values.uv.vertices.length || !values.uv.triangles.length) {
            rebuildMaterialMesh({ preserveLayout: false });
        }

        const selectedIds = getUvVerticesInsideSelectionBox(box)
            .map(vertex => vertex.id)
            .filter(Boolean);

        const islandIds = resolveIslandIdsFromVertexIds(selectedIds);

        values.uv.selected_vertex_ids = selectedIds;
        values.uv.selected_island_ids = islandIds;

        if (islandIds.length) {
            values.uv.active_island_id = islandIds[0];
        }

        await drawUvCanvas();
        setUvBoxSelectState(false);
    };

    const resolveIslandIdsFromVertexIds = vertexIds => {
        const selected = new Set(vertexIds || []);

        return (values.uv.islands || [])
            .filter(island => {
                const islandVertexIds = getIslandVertexIds(island);

                return islandVertexIds.some(id => selected.has(id));
            })
            .map(island => island.id)
            .filter(Boolean);
    };

    const getIslandVertexIds = island => {
        if (!island) {
            return [];
        }

        if (Array.isArray(island.vertex_ids)) {
            return island.vertex_ids;
        }

        if (Array.isArray(island.vertices)) {
            return island.vertices.map(vertex => (
                typeof vertex === "object" ? vertex.id : vertex
            ));
        }

        if (Array.isArray(island.triangle_ids)) {
            const triangleIds = new Set(island.triangle_ids);

            return (values.uv.triangles || [])
                .filter(triangle => triangleIds.has(triangle.id))
                .flatMap(triangle => triangle.vertex_ids || triangle.vertices || [])
                .map(vertex => (typeof vertex === "object" ? vertex.id : vertex))
                .filter(Boolean);
        }

        return [];
    };

    const alignSelectedUvVertices = async axis => {
        const vertices = selectedUvVertices.value;

        if (vertices.length < 2) {
            return;
        }

        const target = axis === "y"
            ? vertices.reduce((sum, vertex) => sum + getUvVertexY(vertex), 0) / vertices.length
            : vertices.reduce((sum, vertex) => sum + getUvVertexX(vertex), 0) / vertices.length;

        const selected = new Set(values.uv.selected_vertex_ids || []);

        values.uv.vertices = values.uv.vertices.map(vertex => {
            if (!selected.has(vertex.id)) {
                return vertex;
            }

            const x = axis === "x" ? target : getUvVertexX(vertex);
            const y = axis === "y" ? target : getUvVertexY(vertex);

            return setUvVertexPosition(vertex, x, y);
        });

        applyUvLayoutToMesh({ source: `uv-align-${axis}` });
        await drawUvCanvas();
        await syncUvAndPreview();
    };

    const getMergeTargetPoint = mode => {
        const vertices = selectedUvVertices.value;

        if (!vertices.length) {
            return null;
        }

        if (mode === "first") {
            const first = vertices[0];

            return {
                x: getUvVertexX(first),
                y: getUvVertexY(first),
            };
        }

        if (mode === "last") {
            const last = vertices[vertices.length - 1];

            return {
                x: getUvVertexX(last),
                y: getUvVertexY(last),
            };
        }

        return {
            x: vertices.reduce((sum, vertex) => sum + getUvVertexX(vertex), 0) / vertices.length,
            y: vertices.reduce((sum, vertex) => sum + getUvVertexY(vertex), 0) / vertices.length,
        };
    };

    const mergeSelectedUvVertices = async (mode = "center") => {
        const selected = new Set(values.uv.selected_vertex_ids || []);

        if (selected.size < 2) {
            return;
        }

        const target = getMergeTargetPoint(mode);

        if (!target) {
            return;
        }

        values.uv.vertices = values.uv.vertices.map(vertex => (
            selected.has(vertex.id)
                ? setUvVertexPosition(vertex, target.x, target.y)
                : vertex
        ));

        applyUvLayoutToMesh({ source: `uv-merge-${mode}` });
        await drawUvCanvas();
        await syncUvAndPreview();
    };

    const getIslandUvVertices = island => {
        const vertexIds = new Set(getIslandVertexIds(island));

        return (values.uv.vertices || []).filter(vertex => vertexIds.has(vertex.id));
    };

    const getIslandUvBounds = vertices => {
        if (!Array.isArray(vertices) || !vertices.length) {
            return null;
        }

        return vertices.reduce((bounds, vertex) => ({
            minX: Math.min(bounds.minX, getUvVertexX(vertex)),
            minY: Math.min(bounds.minY, getUvVertexY(vertex)),
            maxX: Math.max(bounds.maxX, getUvVertexX(vertex)),
            maxY: Math.max(bounds.maxY, getUvVertexY(vertex)),
        }), {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
        });
    };

    const unwrapActiveUvIsland = async () => {
        const island = activeUvIsland.value;

        if (!island || values.uv.view_mode !== "unwrap") {
            return;
        }

        const islandVertices = getIslandUvVertices(island);

        if (!islandVertices.length) {
            return;
        }

        const bounds = getIslandUvBounds(islandVertices);

        if (!bounds) {
            return;
        }

        const padding = Number(values.uv.unwrap_padding ?? 0.015);
        const usable = Math.max(0.000001, 1 - padding * 2);

        const width = Math.max(bounds.maxX - bounds.minX, 0.000001);
        const height = Math.max(bounds.maxY - bounds.minY, 0.000001);
        const selectedVertexIds = new Set(islandVertices.map(vertex => vertex.id));

        values.uv.vertices = (values.uv.vertices || []).map(vertex => {
            if (!selectedVertexIds.has(vertex.id)) {
                return vertex;
            }

            const x = padding + ((getUvVertexX(vertex) - bounds.minX) / width) * usable;
            const y = padding + ((getUvVertexY(vertex) - bounds.minY) / height) * usable;

            return setUvVertexPosition(
                {
                    ...vertex,
                    selected: true,
                    island_id: island.id,
                },
                x,
                y
            );
        });

        values.uv.islands = (values.uv.islands || []).map(item => (
            item.id === island.id
                ? {
                    ...item,
                    selected: true,
                    translate_x: 0,
                    translate_y: 0,
                    scale_x: 1,
                    scale_y: 1,
                    rotate: 0,
                }
                : item
        ));

        values.uv.active_island_id = island.id;
        values.uv.selected_island_ids = [island.id];
        values.uv.selected_vertex_ids = islandVertices.map(vertex => vertex.id);

        applyUvLayoutToMesh({ source: "uv-normalize-active-island" });

        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const fallbackSourceLayer = computed(() => {
        if (props.layer?.id && isUsableTextureLayer(props.layer)) {
            return props.layer;
        }

        return textureLayers.value[0] || null;
    });

    const imageSizeLabel = computed(() => {
        const width = Number(selectedSourceLayer.value?.width || 0);
        const height = Number(selectedSourceLayer.value?.height || 0);

        if (!width || !height) {
            return "Keine Textur";
        }

        return `${width} × ${height}`;
    });

    const selectedSourceLayer = computed(() => {
        if (materialSourceLayerId.value) {
            const found = textureLayers.value.find(
                item => item.id === materialSourceLayerId.value
            );

            if (found) {
                return found;
            }
        }

        return fallbackSourceLayer.value;
    });

    const sourceLayerName = computed(() => {
        return selectedSourceLayer.value?.name || selectedSourceLayer.value?.id || "Keine Textur";
    });

    const materialConnected = computed(() => {
        return values.shader_graph.edges.some(edge => (
            edge.from.node === "principled-bsdf" &&
            edge.from.socket === "bsdf" &&
            edge.to.node === "material-output" &&
            edge.to.socket === "surface"
        ));
    });

    const animatorState = computed(() => {
        return props.animatorState !== true;
    });

    const materialTimelineTime = computed(() => Number(timelineData.value?.time ?? 0));

    const setMaterialTimelineTime = value => {
        const next = Number(value);

        if (!Number.isFinite(next)) {
            return;
        }

        timelineData.value.time = Math.max(0, next);
    };

    const materialKeyframeRecordActive = computed(() => (
        timelineStates.record.value === true &&
        isEditingMaterialLayer.value &&
        !!props.layer?.id
    ));

    const materialKeyframeToolsVisible = computed(() => (
        isEditingMaterialLayer.value &&
        !!props.layer?.id
    ));

    const mixMaterialFieldValue = (from, to, t) => {
        if (typeof from === "number" && typeof to === "number") {
            return from + (to - from) * t;
        }

        if (Array.isArray(from) && Array.isArray(to)) {
            return from.map((value, index) => (
                typeof value === "number" && typeof to[index] === "number"
                    ? value + (to[index] - value) * t
                    : (t >= 1 ? to[index] : value)
            ));
        }

        return t >= 1 ? to : from;
    };

    const getMaterialKeyframeValue = (node, fieldKey, frame) => (
        frame?.material?.nodes?.[node?.id]?.settings?.[fieldKey]
    );

    const getMaterialFieldValue = (node, fieldKey) => {
        const fallback = normalizeNodeSettings(node)[fieldKey];
        const frames = (props.layer?.keyframes || [])
            .map(frame => ({
                frame,
                time: Number(frame?.time ?? 0),
                value: getMaterialKeyframeValue(node, fieldKey, frame),
            }))
            .filter(item => Number.isFinite(item.time) && item.value !== undefined)
            .sort((a, b) => a.time - b.time);

        if (!frames.length) {
            return fallback;
        }

        const time = materialTimelineTime.value;
        const previous = [...frames].reverse().find(item => item.time <= time) || frames[0];
        const next = frames.find(item => item.time >= time) || frames[frames.length - 1];

        if (!previous || !next || previous.time === next.time) {
            return clone(previous?.value ?? next?.value ?? fallback, "json");
        }

        const factor = clamp((time - previous.time) / (next.time - previous.time), 0, 1);

        return mixMaterialFieldValue(previous.value, next.value, factor);
    };

    const addMaterialInputKeyframe = (node, fieldKey) => {
        if (!materialKeyframeRecordActive.value || !node?.id || !fieldKey || !props.layer?.id) {
            return;
        }

        const time = Number(timelineData.value?.time ?? 0);
        const layer = props.layer;
        const value = getMaterialFieldValue(node, fieldKey);

        if (!Array.isArray(layer.keyframes)) {
            layer.keyframes = [];
        }

        let keyframe = layer.keyframes.find(frame => Number(frame.time) === time);

        if (!keyframe) {
            keyframe = {
                id: uuid("keyframe"),
                time,
                opacity: layer.opacity,
                matrix: clone(layer.matrix || {}, "json"),
                width: layer.width,
                height: layer.height,
                ease: "linear",
                bezier: null,
            };
            layer.keyframes.push(keyframe);
        }

        keyframe.material = {
            ...(keyframe.material || {}),
            nodes: {
                ...(keyframe.material?.nodes || {}),
                [node.id]: {
                    ...(keyframe.material?.nodes?.[node.id] || {}),
                    settings: {
                        ...(keyframe.material?.nodes?.[node.id]?.settings || {}),
                        [fieldKey]: clone(value, "json"),
                    },
                },
            },
        };

        layer.keyframes.sort((a, b) => Number(a.time) - Number(b.time));
        emitEvent("update-layer", clone(layer, "json"));
    };

    const previewLayer = computed(() => {
        const normalized = buildMaterialDraft();
        const backendLayer = getBackendPreviewLayer(normalized);

        if (backendLayer) {
            const previewLight = {
                ...normalized.light,
                editing: ui.value.activeTab === "light",
            };

            return {
                ...backendLayer,
                id: `preview-${props.layer?.id || selectedSourceLayer.value?.id || "material"}`,
                source: selectedSourceLayer.value?.id || props.layer?.id || backendLayer.source || "",
                source_layer_id: selectedSourceLayer.value?.id || props.layer?.id || backendLayer.source_layer_id || "",
                mesh: normalized.mesh,
                particle_system: getPlainParticleSystem(),
                light: previewLight,
                shader: {
                    ...(backendLayer.shader || {}),
                    mesh: normalized.mesh,
                    particle_system: getPlainParticleSystem(),
                    light: previewLight,
                },
                preview: {
                    ...(backendLayer.preview || {}),
                    rotate: normalized.rotate_preview,
                    wireframe: normalized.wireframe_preview,
                    faces: normalized.faces_preview,
                    vertices: normalized.vertices_preview,
                    fluid_mesh: normalized.fluid_mesh_preview,
                    fluid_particles: normalized.fluid_particle_preview,
                    idle_rotation: {
                        ...(backendLayer.preview?.idle_rotation || {}),
                        enabled: normalized.rotate_preview,
                        speed: backendLayer.preview?.idle_rotation?.speed || 0.006,
                        tilt: backendLayer.preview?.idle_rotation?.tilt || 0.42,
                    },
                },
                settings: {
                    ...(backendLayer.settings || {}),
                    blend_mode: normalized.blend_mode,
                    alpha_clip: normalized.alpha_clip,
                    shadow_method: normalized.shadow_method,
                    backface_culling: normalized.backface_culling,
                    show_backface: normalized.show_backface,
                    screen_space_refraction: normalized.screen_space_refraction,
                    refraction_depth: normalized.refraction_depth,
                    subsurface_translucency: normalized.subsurface_translucency,
                    render_backend: normalized.render_backend,
                    cube_size: normalized.cube_size,
                    rotate_preview: normalized.rotate_preview,
                    wireframe_preview: normalized.wireframe_preview,
                    faces_preview: normalized.faces_preview,
                    vertices_preview: normalized.vertices_preview,
                    fluid_mesh_preview: normalized.fluid_mesh_preview,
                    fluid_particle_preview: normalized.fluid_particle_preview,
                    light: previewLight,
                    light_editing: ui.value.activeTab === "light",
                },
                render_backend: normalized.render_backend,
                time: backendLayer.time || previewStableTime.value,
            };
        }

        const previewLight = {
            ...normalized.light,
            editing: ui.value.activeTab === "light",
        };

        return {
            id: `preview-${props.layer?.id || selectedSourceLayer.value?.id || "material"}`,
            source: selectedSourceLayer.value?.id || props.layer?.id || "",
            source_layer_id: selectedSourceLayer.value?.id || props.layer?.id || "",

            name: normalized.name,
            type: 5,

            renderer: "canvas-cube",
            render_backend: normalized.render_backend,
            engine: "material",

            width: 512,
            height: 512,

            url: sourceLayerTextureUrl.value,
            thumbnail: sourceLayerThumbnail.value,

            surface: normalized.surface,
            geometry: normalized.geometry,
            mesh: normalized.mesh,
            particle_system: getPlainParticleSystem(),
            physics: normalized.physics,
            light: previewLight,
            bitmap_maps: normalized.bitmap_maps,
            uv: normalized.uv,
            shader_graph: normalized.shader_graph,

            material: {
                surface: normalized.surface,
                geometry: normalized.geometry,
                mesh: normalized.mesh,
                particle_system: getPlainParticleSystem(),
                physics: normalized.physics,
                light: previewLight,
                bitmap_maps: normalized.bitmap_maps,
                shader_graph: normalized.shader_graph,
                texture_size: normalized.texture_size,
                texture_preload: normalized.texture_preload,
                render_backend: normalized.render_backend,
            },

            shader: {
                shader: "canvas-principled-node-graph",
                version: 4,
                material_connected: materialConnected.value,
                inputs: normalized.surface,
                surface: normalized.surface,
                geometry: normalized.geometry,
                mesh: normalized.mesh,
                particle_system: getPlainParticleSystem(),
                physics: normalized.physics,
                light: previewLight,
                bitmap_maps: normalized.bitmap_maps,
                uv: normalized.uv,
                graph: normalized.shader_graph,
                texture_size: normalized.texture_size,
                texture_preload: normalized.texture_preload,
                render_backend: normalized.render_backend,
            },

            texture: {
                url: getPreviewTextureUrl(normalized),
                thumbnail: getPreviewTextureUrl(normalized),
                texture_size: normalized.texture_size,
                texture_lod_key: normalized.texture_size === "Original"
                    ? "original"
                    : String(normalized.texture_size),
            },

            preview: {
                rotate: normalized.rotate_preview,
                wireframe: normalized.wireframe_preview,
                faces: normalized.faces_preview,
                vertices: normalized.vertices_preview,
                fluid_mesh: normalized.fluid_mesh_preview,
                fluid_particles: normalized.fluid_particle_preview,
                idle_rotation: {
                    enabled: normalized.rotate_preview,
                    speed: 0.006,
                    tilt: 0.42,
                },
            },

            settings: {
                blend_mode: normalized.blend_mode,
                alpha_clip: normalized.alpha_clip,
                shadow_method: normalized.shadow_method,
                backface_culling: normalized.backface_culling,
                show_backface: normalized.show_backface,
                screen_space_refraction: normalized.screen_space_refraction,
                refraction_depth: normalized.refraction_depth,
                subsurface_translucency: normalized.subsurface_translucency,
                use_nodes: normalized.use_nodes,
                render_backend: normalized.render_backend,
                cube_size: normalized.cube_size,
                fluid_mesh_preview: normalized.fluid_mesh_preview,
                fluid_particle_preview: normalized.fluid_particle_preview,
                light: {
                    ...previewLight,
                },
                light_editing: ui.value.activeTab === "light",
                texture_size: normalized.texture_size,
                texture_preload: normalized.texture_preload,
            },

            texture_size: normalized.texture_size,
            texture_preload: normalized.texture_preload,
            time: previewStableTime.value,
        };
    });

    const getBackendPreviewLayer = normalized => {
        const layer = props.materialPreview;

        if (!layer || !normalized) {
            return null;
        }

        const previewTextureSize = normalizeTextureSize(
            layer?.settings?.texture_size ??
            layer?.texture_size ??
            layer?.texture?.texture_size ??
            "Original"
        );

        if (previewTextureSize !== normalized.texture_size) {
            return null;
        }

        if (
            layer.material_preview_request_id &&
            layer.material_preview_request_id !== previewRequestId.value
        ) {
            return null;
        }

        return layer;
    };

    const getPreviewTextureUrl = normalized => {
        const backendLayer = getBackendPreviewLayer(normalized);
        return (backendLayer?.texture?.url || backendLayer?.url || sourceLayerTextureUrl.value);
    };

    const loading3DState = computed(() => {return props.loadingPreview;});

    const ui = ref({
        activeTab: "surface",
        activeNodeCategory: "",
        nodeContextMenu: {
            open: false,
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            category: "Math",
        },
        material: {
            tabs:[
                { key: "surface", title: "Surface", icon: "mdi-tune-variant" },
                { key: "geometry", title: "Geometry", icon: "mdi-cube-outline" },
                { key: "particleSystem", title: "Particle System", icon: "mdi-particle" },
                { key: "physics", title: "Physics", icon: "mdi-atom" },
                { key: "light", title: "Light", icon: "mdi-lightbulb-spot" },
                { key: "uv", title: "UV", icon: "mdi-vector-square" },
                { key: "shader", title: "Shader", icon: "mdi-graph-outline" },
                { key: "export", title: "Export", icon: "mdi-export-variant" },
                { key: "settings", title: "Settings", icon: "mdi-cog" },
            ],
            header: {
                title: 'Material Editor',
                icon: 'mdi-cube-scan',
                subtitle: `${materialModeLabel.value} · ${sourceLayerName.value}`,
                chip: {
                    state: materialConnected,
                    message: {
                        true: 'Material Connected',
                        false: 'Material Disconnected'
                    }
                }
            },
            preview: {
                header: {
                    eyebrow: 'Surface',
                    title: imageSizeLabel,
                    type: 'button',
                    label: 'Aktualisieren',
                    disabled: loading3DState
                },
                layer3D: {
                    state: materialConnected,
                    webglActive: animatorState,
                    layer: {
                        ref: previewLayer,
                        idle: values.rotate_preview
                    },
                    loading: {
                        state: loading3DState,
                        message: ['Material wird vorbereitet…', '3D-Vorschau wird geladen…']
                    },
                    disconnect: {
                        icon: 'mdi-vector-link',
                        title: 'Material Output getrennt',
                        subtitle: 'Verbinde Shader → Output, um das Material wieder anzuzeigen.'
                    }
                }
            }
        },
        uv: {
            main: {
                id: uuid('uv'),
            }
        }
    });

    const config = computed(() => ({
        title: "Material Editor",
        subtitle: selectedSourceLayer.value?.id || props.layer?.id || "",
        width: "100%",
        maxWidth: 1240,
        height: "auto",
        maxHeight: 820,
        fullscreen: false,
        variant: "rounded",
        emit: "material-editor:state",
        hideClose: true,
    }));

    const materialSettings = computed({
        get: () => ({
            render_backend: values.render_backend,
            texture_size: values.texture_size,
            texture_preload: values.texture_preload,

            cube_size: values.cube_size,
            rotate_preview: values.rotate_preview,
            wireframe_preview: values.wireframe_preview,
            faces_preview: values.faces_preview,
            vertices_preview: values.vertices_preview,
            fluid_mesh_preview: values.fluid_mesh_preview,
            fluid_particle_preview: values.fluid_particle_preview,

            blend_mode: values.blend_mode,
            alpha_clip: values.alpha_clip,

            shadow_method: values.shadow_method,
            backface_culling: values.backface_culling,
            show_backface: values.show_backface,

            screen_space_refraction: values.screen_space_refraction,
            refraction_depth: values.refraction_depth,
            subsurface_translucency: values.subsurface_translucency,

            use_nodes: values.use_nodes,
        }),

        set: nextSettings => {
            const normalized = {
                ...createSettings(),
                ...(nextSettings || {}),
            };

            values.render_backend = normalized.render_backend;
            values.texture_size = normalizeTextureSize(normalized.texture_size);
            values.texture_preload = TEXTURE_SIZE_OPTIONS;

            values.cube_size = normalized.cube_size;
            values.rotate_preview = normalized.rotate_preview;
            values.wireframe_preview = normalized.wireframe_preview;
            values.faces_preview = normalized.faces_preview;
            values.vertices_preview = normalized.vertices_preview;
            values.fluid_mesh_preview = normalized.fluid_mesh_preview;
            values.fluid_particle_preview = normalized.fluid_particle_preview;


            values.blend_mode = normalized.blend_mode;
            values.alpha_clip = normalized.alpha_clip;

            values.shadow_method = normalized.shadow_method;
            values.backface_culling = normalized.backface_culling;
            values.show_backface = normalized.show_backface;

            values.screen_space_refraction = normalized.screen_space_refraction;
            values.refraction_depth = normalized.refraction_depth;
            values.subsurface_translucency = normalized.subsurface_translucency;

            values.use_nodes = normalized.use_nodes;
        },
    });

    const assignTextureSlotFromSurface = ({ slotKey, layerId }) => {
        const layer = textureLayers.value.find(item => item.id === layerId);

        if (!layer) {
            return;
        }

        assignLayerToMap(slotKey, layer);
    };

    const clearTextureSlotFromSurface = ({ slotKey }) => {
        clearMapSlot(slotKey);
    };

    const isFullWorkspaceTab = computed(() => {
        return ["shader", "uv"].includes(ui.value.activeTab);
    });

    const nodeWorldStyle = computed(() => ({
        transform: `translate(${nodeCanvas.panX}px, ${nodeCanvas.panY}px) scale(${nodeCanvas.zoom})`,
        transformOrigin: "0 0",
    }));

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const getNodePosition = (node, fallback = { x: 0, y: 0 }) => {
        if (!node?.id) {
            return cloneData(fallback);
        }

        if (nodePositionMemory[node.id]) {
            return cloneData(nodePositionMemory[node.id]);
        }

        if (node.position) {
            return cloneData(node.position);
        }

        return cloneData(fallback);
    };

    const rememberNodePosition = node => {
        if (!node?.id) {
            return;
        }

        nodePositionMemory[node.id] = cloneData(
            node.position || { x: 0, y: 0 }
        );
    };

    const rememberAllNodePositions = () => {
        values.shader_graph.nodes.forEach(node => {
            rememberNodePosition(node);
        });
    };

    const applyRememberedNodePositions = () => {
        values.shader_graph.nodes.forEach(node => {
            if (nodePositionMemory[node.id]) {
                node.position = cloneData(nodePositionMemory[node.id]);
            }
        });
    };

    const resolveLayerTextureUrl = layer => {
        if (!layer) {
            return "";
        }

        return (
            layer?.masked ||
            layer.texture?.url ||
            layer.url ||
            layer.svg ||
            ""
        );
    };

    const resolveLayerThumbnailUrl = layer => {
        if (!layer) {
            return "";
        }
        return (
            layer?.thumbnail || layer?.url ||
            resolveLayerTextureUrl(layer)
        );
    };

    const nodeTypeGroups = computed(() => {
        const groups = Node.TYPES.reduce((acc, item) => {
            const group = item.group;

            if (!acc[group]) {
                acc[group] = [];
            }

            acc[group].push(item);
            return acc;
        }, {});

        return Node.TYPE_ORDER
            .filter(group => Array.isArray(groups[group]) && groups[group].length)
            .map(group => ({
                key: group,
                label: group,
                items: groups[group],
            }));
    });

    const activeUvFace = computed(() => {
        return values.uv.faces[values.uv.active_face];
    });

    const activeUvIsland = computed(() => (
        values.uv.islands.find(island => island.id === values.uv.active_island_id) ||
        values.uv.islands[0] ||
        null
    ));

    const hasUvMapNode = computed(() => values.shader_graph.nodes.some(node => (
        node?.settings?.node_key === "uv.map"
    )));

    const hasUvCubemapNode = computed(() => values.shader_graph.nodes.some(node => (
        node?.settings?.node_key === "uv.cubemap"
    )));

    const showUvModeSwitch = computed(() => hasUvMapNode.value && hasUvCubemapNode.value);

    const uvEditorModeOptions = computed(() => {
        const options = [];

        if (hasUvMapNode.value || !hasUvCubemapNode.value) {
            options.push({ key: "unwrap", label: "Unwrap" });
        }

        if (hasUvCubemapNode.value) {
            options.push({ key: "cubemap", label: "CubeMap" });
        }

        return options;
    });

    const selectedUvFaces = computed(() => {
        const list = Array.isArray(values.uv.selected_faces)
            ? values.uv.selected_faces
            : [];

        return list.length ? list : [values.uv.active_face];
    });

    const uvViewModeLabel = computed(() => {
        if (values.uv.view_mode === "unwrap") {
            return "Unwrap Grid";
        }

        return values.uv.view_mode === "cubemap"
            ? "CubeMap Grid"
            : "Single Face";
    });

    const activeUvFaceBitmap = computed(() => {
        if (values.uv.view_mode === "unwrap") {
            return activeUvIsland.value?.bitmap || values.bitmap_maps.baseColor || {};
        }

        return activeUvFace.value?.bitmap || {};
    });

    const activeUvFaceBitmapUrl = computed(() => {
        return activeUvFaceBitmap.value?.url || "";
    });

    const activeUvFaceBitmapName = computed(() => {
        return activeUvFaceBitmap.value?.name || "No Bitmap";
    });

    const uvGridMetrics = computed(() => {
        const face = activeUvFace.value;

        return {
            x: Math.round(face.x * 1000) / 1000,
            y: Math.round(face.y * 1000) / 1000,
            width: Math.round(face.width * 1000) / 1000,
            height: Math.round(face.height * 1000) / 1000,
            translateX: Math.round(face.translate_x * 1000) / 1000,
            translateY: Math.round(face.translate_y * 1000) / 1000,
            scaleX: Math.round(face.scale_x * 1000) / 1000,
            scaleY: Math.round(face.scale_y * 1000) / 1000,
            rotate: Math.round(face.rotate * 100) / 100,
        };
    });

    const unwrapReferenceMetrics = computed(() => {
        const island = activeUvIsland.value || {};

        return {
            translateX: Math.round(Number(island.bitmap_translate_x || 0) * 1000) / 1000,
            translateY: Math.round(Number(island.bitmap_translate_y || 0) * 1000) / 1000,
            scaleX: Math.round(Number(island.bitmap_scale_x ?? 1) * 1000) / 1000,
            scaleY: Math.round(Number(island.bitmap_scale_y ?? 1) * 1000) / 1000,
            rotate: Math.round(Number(island.bitmap_rotate || 0) * 100) / 100,
        };
    });

    const uvFaceLayout = computed(() => [
        { face: "top", col: 2, row: 1 },
        { face: "left", col: 1, row: 2 },
        { face: "front", col: 2, row: 2 },
        { face: "right", col: 3, row: 2 },
        { face: "back", col: 4, row: 2 },
        { face: "bottom", col: 2, row: 3 },
    ]);

    const uvIslandLayout = computed(() => values.uv.islands.map((island, index) => ({
        id: island.id,
        label: island.name || island.faceName || `Island ${index + 1}`,
        detail: island.bitmap?.name || island.faceName || island.primitive || "unwrap",
        selected: (values.uv.selected_island_ids || []).includes(island.id),
        active: values.uv.active_island_id === island.id,
        mapped: Boolean(island.bitmap?.url || island.bitmaps?.baseColor?.url),
    })));

    const getGraphNode = id => {
        return values.shader_graph.nodes.find(node => node.id === id);
    };

    const getNodeSocketLabel = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);
        const sockets = direction === "input"
            ? node?.inputs || {}
            : node?.outputs || {};
        const definition = sockets[socket];

        return definition?.label || socket;
    };

    const getSocketDefinition = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);
        const sockets = direction === "input"
            ? node?.inputs || {}
            : node?.outputs || {};

        return sockets[socket] || null;
    };

    const nodeValueContext = () => ({
        surfaceFieldMap: SURFACE_FIELD_MAP,
        surfaceDefaults: createSurface(),
    });

    const coerceSocketValue = (value, socketType = "float", slotKey = "") => (
        Node.coerceSocketValue(value, socketType, slotKey, nodeValueContext())
    );

    const resolveNodeDisplayValue = node => Node.resolveDisplayValue(node);
    const getNodeResolvedValueText = node => Node.getResolvedValueText(node);

    const applyResolvedValueToSurfaceSlot = (slotKey, value, sourceNode = null) => {
        if (!SURFACE_FIELD_MAP[slotKey] || value === null || value === undefined) {
            return;
        }

        const field = SURFACE_FIELD_MAP[slotKey];
        const socketType = field.type === "color" ? "color" : "float";
        const coerced = coerceSocketValue(value, socketType, slotKey);

        if (coerced === null) {
            return;
        }

        values.surface[slotKey] = coerced;

        values.bitmap_maps[slotKey] = {
            ...values.bitmap_maps[slotKey],
            enabled: true,
            source_type: "shader",
            node_id: sourceNode?.id || values.bitmap_maps[slotKey]?.node_id || "",
            name: sourceNode?.label || values.bitmap_maps[slotKey]?.name || "Shader Value",
            url: values.bitmap_maps[slotKey]?.url || "",
            layer_id: values.bitmap_maps[slotKey]?.layer_id || "",
            ...mergeTextureSettingsForSlot(slotKey, values.bitmap_maps[slotKey], sourceNode?.settings || {}),
        };
    };

    const resolveNodeOutputValue = (nodeId, socket = "", seen = new Set()) => (
        Node.resolveOutputValue(values.shader_graph, nodeId, socket, seen)
    );

    const applyResolvedValueToNodeInput = (from, to) => {
        const targetNode = getGraphNode(to.node);
        const value = resolveNodeOutputValue(from.node, from.socket);

        if (!targetNode || value === null || value === undefined) {
            return;
        }

        if (to.node === "principled-bsdf") {
            const textureSource = resolveShaderGraphSource(from.node);

            if (
                textureSource?.url ||
                textureSource?.layer_id ||
                textureSource?.source_type === "single" ||
                textureSource?.source_type === "multitexture" ||
                (Array.isArray(textureSource?.texture_groups) && textureSource.texture_groups.length)
            ) {
                return;
            }

            applyResolvedValueToSurfaceSlot(to.socket, value, getGraphNode(from.node));
            return;
        }

        const targetInputs = targetNode.inputs || {};

        if (!targetInputs[to.socket]) {
            return;
        }

        const socketType = getSocketDefinition(to.node, to.socket, "input")?.type || "float";
        const settings = ensureNodeSettings(targetNode);
        settings[to.socket] = coerceSocketValue(value, socketType, to.socket);
    };

    const propagateNodeOutputValues = (nodeId, seen = new Set()) => {
        if (!nodeId || seen.has(nodeId)) {
            return;
        }

        seen.add(nodeId);

        values.shader_graph.edges
            .filter(edge => edge.from.node === nodeId)
            .forEach(edge => {
                applyResolvedValueToNodeInput(edge.from, edge.to);
                propagateNodeOutputValues(edge.to.node, new Set(seen));
            });
    };

    const syncConnectedSurfaceValuesFromGraph = () => {
        values.shader_graph.edges
            .filter(edge => edge.to.node === "principled-bsdf")
            .forEach(edge => applyResolvedValueToNodeInput(edge.from, edge.to));
    };

    const ensureNodeSettings = node => {
        if (!node) {
            return {};
        }

        node.settings = normalizeNodeSettings(node);

        return node.settings;
    };

    const updateNodeSetting = (node, key, value) => {
        if (!node) {
            return;
        }

        ensureNodeSettings(node);

        node.settings[key] = value;
        node.user_edited = true;

        if (["offset", "strength", "channel", "color_mode", "invert", "blend"].includes(key)) {
            syncNodeValuesToSurface(node);
            syncSurfaceOffsetsFromNodes();
        }

        propagateNodeOutputValues(node.id);
        syncNodeValuesToSurface(node);
        syncConnectedSurfaceValuesFromGraph();
        requestPreviewDebounced();
    };

    const updateNodeTextureGroupSetting = (node, index, key, value) => {
        if (!node || node.settings?.node_key !== "texture.multitexture") {
            return;
        }

        const settings = ensureNodeSettings(node);
        const groups = Array.isArray(settings.texture_groups)
            ? settings.texture_groups
            : [];

        if (!groups[index]) {
            return;
        }

        groups[index] = {
            ...groups[index],
            ...mergeTextureSettingsForSlot(getSurfaceSlotForNode(node.id), settings, groups[index], {
                [key]: value,
            }),
        };

        settings.texture_groups = groups;
        node.user_edited = true;

        syncNodeValuesToSurface(node);
        syncTextureGroupSettingsToUvFaces(getSurfaceSlotForNode(node.id), groups[index], { [key]: value });
        syncSurfaceOffsetsFromNodes();
        requestPreviewDebounced();
    };

    const getNodeTargetSlotFromSettings = node => {
        const settings = node?.settings || {};
        const candidates = [
            settings.slot,
            settings.target_slot,
            ...(Array.isArray(settings.target_slots) ? settings.target_slots : []),
        ];

        return candidates.find(slotKey => Boolean(values.bitmap_maps[slotKey])) || "";
    };

    const getDirectSurfaceSlotForNode = nodeId => {
        const edge = values.shader_graph.edges.find(item => (
            item.from.node === nodeId &&
            item.to.node === "principled-bsdf" &&
            values.bitmap_maps[item.to.socket]
        ));

        return edge?.to?.socket || "";
    };

    const getDownstreamSurfaceSlotForNode = (nodeId, seen = new Set()) => {
        if (!nodeId || seen.has(nodeId)) {
            return "";
        }

        seen.add(nodeId);

        const directSlot = getDirectSurfaceSlotForNode(nodeId);

        if (directSlot) {
            return directSlot;
        }

        const outgoingEdges = values.shader_graph.edges.filter(edge => edge.from.node === nodeId);

        for (const edge of outgoingEdges) {
            const slotKey = getDownstreamSurfaceSlotForNode(edge.to.node, new Set(seen));

            if (slotKey) {
                return slotKey;
            }
        }

        return "";
    };

    const getSurfaceSlotForNode = nodeId => {
        const node = getGraphNode(nodeId);

        return getDirectSurfaceSlotForNode(nodeId)
            || getDownstreamSurfaceSlotForNode(nodeId)
            || getNodeTargetSlotFromSettings(node);
    };

    const syncTextureSettingsToUvFaces = (slotKey, settings = {}) => {
        if (!slotKey || !values.bitmap_maps[slotKey]) {
            return;
        }

        const nextSettings = mergeTextureSettingsForSlot(slotKey, values.bitmap_maps[slotKey], settings);

        Object.values(values.uv.faces || {}).forEach(face => {
            if (!face?.bitmap?.url && !face?.bitmap?.layer_id) {
                return;
            }

            face.bitmap = {
                ...face.bitmap,
                ...mergeTextureSettingsForSlot(slotKey, face.bitmap, nextSettings),
            };
        });
    };

    const syncTextureGroupSettingsToUvFaces = (slotKey, group = {}, settings = {}) => {
        if (!slotKey || !values.bitmap_maps[slotKey]) {
            return;
        }

        const affectedFaces = Array.isArray(group.faces) ? group.faces : [];
        const nextSettings = mergeTextureSettingsForSlot(slotKey, values.bitmap_maps[slotKey], group, settings);

        Object.entries(values.uv.faces || {}).forEach(([faceName, face]) => {
            const bitmap = face?.bitmap || {};
            const sameTexture =
                (group.url && bitmap.url === group.url) ||
                (group.layer_id && bitmap.layer_id === group.layer_id);
            const belongsToGroup = affectedFaces.includes(faceName) || sameTexture;

            if (!belongsToGroup || (!bitmap.url && !bitmap.layer_id)) {
                return;
            }

            face.bitmap = {
                ...bitmap,
                ...mergeTextureSettingsForSlot(slotKey, bitmap, nextSettings),
            };
        });
    };

    const syncNodeValuesToSurface = node => {
        if (!node) {
            return;
        }

        const slotKey = getSurfaceSlotForNode(node.id);

        if (!slotKey) {
            return;
        }

        const settings = normalizeNodeSettings(node);

        values.bitmap_maps[slotKey] = {
            ...values.bitmap_maps[slotKey],
            enabled: true,
            source_type: node.generated && node.system === "uv-cubemap"
                ? values.bitmap_maps[slotKey].source_type
                : "shader",

            node_id: node.id,
            name: node.label || node.id,

            url: settings.url || values.bitmap_maps[slotKey].url || "",
            layer_id: settings.layer_id || values.bitmap_maps[slotKey].layer_id || "",

            faces: settings.faces || values.bitmap_maps[slotKey].faces || {},
            mapped_faces: settings.mapped_faces || values.bitmap_maps[slotKey].mapped_faces || [],
            texture_groups: settings.texture_groups || values.bitmap_maps[slotKey].texture_groups || [],
            ...mergeTextureSettingsForSlot(slotKey, values.bitmap_maps[slotKey], settings),
            strength: settings.strength ?? values.bitmap_maps[slotKey].strength ?? 1,
            offset: settings.offset ?? values.bitmap_maps[slotKey].offset ?? 0,
            invert: settings.invert === true,
            blend: settings.blend || values.bitmap_maps[slotKey].blend || "replace",
        };

        syncTextureSettingsToUvFaces(slotKey, settings);
    };

    const ensureCoreNodes = () => {
        if (!getGraphNode("principled-bsdf")) {
            values.shader_graph.nodes.push(createPrincipledNode());
        }

        if (!getGraphNode("material-output")) {
            values.shader_graph.nodes.push(createOutputNode());
        }
    };

    const activeShaderNode = computed(() => {
        return getGraphNode(activeShaderNodeId.value);
    });

    const getNodeEdgesIn = nodeId => {
        return values.shader_graph.edges.filter(edge => edge.to.node === nodeId);
    };

    const getNodeEdgesOut = nodeId => {
        return values.shader_graph.edges.filter(edge => edge.from.node === nodeId);
    };

    const sanitizeSurfaceBitmapMaps = bitmapMaps => {
        const maps = clone(bitmapMaps, 'json');

        SURFACE_FIELDS.forEach(field => {
            const slot = maps?.[field.key];

            if (!slot) {
                return;
            }

            slot.offset = 0;

            if (Array.isArray(slot.texture_groups)) {
                slot.texture_groups = slot.texture_groups.map(group => ({
                    ...group,
                    offset: 0,
                }));
            }
        });

        return maps;
    };

    const applyUvLayoutToMesh = (context = {}) => {
        const baseMesh = Mesh.fromPlain(Mesh.toPlain(values.mesh), values.geometry);
        const result = UV.unwrapMesh(baseMesh, values.uv, {
            source: context.source || "material-editor",
            rootKey: "material",
            geometry: values.geometry,
        });

        values.mesh = result.mesh;
        values.uv = UV.normalize({
            ...result.uv,
            mode: "unwrap",
            view_mode: values.uv.view_mode || "unwrap",
        });
    };

    const rebuildMaterialMesh = ({ preserveLayout = true } = {}) => {
        const mesh = createMesh(values.geometry);
        values.mesh = {
            ...mesh,
            volume: Volume.toPlain(values.geometry.volume || {}),
            fluid: Fluid.toPlain(values.geometry.fluid || {}),
            physics: clone(values.physics || {}, 'json'),
            meta: {
                ...(mesh.meta || {}),
                volume_enabled: values.geometry.volume?.enabled === true,
                fluid_enabled: values.geometry.volume?.enabled === true && values.geometry.fluid?.enabled === true,
            },
        };

        if (values.uv.view_mode === "unwrap" || values.uv.mode === "unwrap") {
            if (!preserveLayout) {
                values.uv.vertices = [];
                values.uv.edges = [];
                values.uv.triangles = [];
                values.uv.islands = [];
            }

            applyUvLayoutToMesh({
                source: preserveLayout ? "geometry-update" : "geometry-rebuild",
            });
        }
    };

    const getPlainMesh = () => ({
        ...Mesh.toPlain(values.mesh || createMesh(values.geometry)),
        volume: Volume.toPlain(values.geometry.volume || values.mesh?.volume || {}),
        fluid: Fluid.toPlain(values.geometry.fluid || values.mesh?.fluid || {}),
        physics: clone(values.physics || values.mesh?.physics || {}, 'json'),
    });

    const getPreviewPlainMesh = () => {
        const mesh = getPlainMesh();
        const vertexCount = Math.floor((mesh.vertices?.length || 0) / (mesh.stride || Mesh.STRIDE));

        return {
            ...mesh,
            vertices: [],
            indices: [],
            parts: [],
            count: 0,
            meta: {
                ...(mesh.meta || {}),
                preview_compact: true,
                preview_vertex_count: vertexCount,
                preview_index_count: mesh.indices?.length || 0,
            },
        };
    };

    const getPreviewUv = () => ({
        ...clone(values.uv, 'json'),
        vertices: [],
        edges: [],
        triangles: [],
        seams: [],
        islands: (values.uv.islands || []).map(island => ({
            ...clone(island, 'json'),
            vertex_ids: [],
            edge_ids: [],
            triangle_ids: [],
        })),
    });

    const getPlainParticleSystem = ({ compact = false } = {}) => ParticleSystem.toPlain(
        values.particle_system || createParticles(),
        {
            compact,
            context: {
                mesh: values.mesh,
                volume: values.mesh?.volume || values.geometry?.volume,
                fluid: values.mesh?.fluid || values.geometry?.fluid,
                physics: values.physics || values.mesh?.physics,
            },
        }
    );

    const buildMaterialDraft = ({ preview = false } = {}) => ({
        name: values.name || "Cube Material",

        surface: clone(values.surface, 'json'),
        geometry: clone(values.geometry, 'json'),
        mesh: preview ? getPreviewPlainMesh() : getPlainMesh(),
        particle_system: getPlainParticleSystem({ compact: preview }),
        physics: clone(values.physics, 'json'),
        light: clone(values.light, 'json'),
        bitmap_maps: sanitizeSurfaceBitmapMaps(values.bitmap_maps),
        uv: preview ? getPreviewUv() : clone(values.uv, 'json'),
        shader_graph: {
            ...clone(values.shader_graph, 'json'),
            material_connected: materialConnected.value,
        },

        cube_size: clamp(Number(values.cube_size || 256), 64, 4096),
        rotate_preview: values.rotate_preview,
        wireframe_preview: values.wireframe_preview,
        faces_preview: values.faces_preview,
        vertices_preview: values.vertices_preview,
        fluid_mesh_preview: values.fluid_mesh_preview !== false,
        fluid_particle_preview: values.fluid_particle_preview !== false,
        render_backend: ["CANVAS2D", "WEBGL2"].includes(String(values.render_backend || "").toUpperCase())
            ? String(values.render_backend).toUpperCase()
            : "WEBGL2",

        texture_size: normalizeTextureSize(values.texture_size),
        texture_preload: TEXTURE_SIZE_OPTIONS,

        blend_mode: values.blend_mode || "BLEND",
        alpha_clip: clamp(Number(values.alpha_clip ?? 0.5), 0, 1),
        shadow_method: values.shadow_method || "HASHED",
        backface_culling: values.backface_culling === true,
        show_backface: values.show_backface !== false,
        screen_space_refraction: values.screen_space_refraction === true,
        refraction_depth: clamp(Number(values.refraction_depth ?? 0), 0, 100),
        subsurface_translucency: values.subsurface_translucency === true,
        use_nodes: values.use_nodes !== false,
    });

    const getSurfaceColor = key => {
        return colorArrayToHex(values.surface[key], 'rgba');
    };

    const setSurfaceColor = (key, hex) => {
        const current = values.surface[key];

        if (Array.isArray(current)) {
            hexToRgbaArray(hex, current[3] ?? 1, "rgba", current);
        } else {
            values.surface[key] = hexToRgbaArray(hex, 1, "rgba");
        }

        requestPreviewDebounced();
    };

    const getSurfaceSlotSourceNode = key => {
        const slot = values.bitmap_maps[key];

        const edge = values.shader_graph.edges.find(item => (
            item.to.node === "principled-bsdf" &&
            item.to.socket === key
        ));

        if (edge) {
            const node = getGraphNode(edge.from.node);

            if (node) {
                return node;
            }
        }

        if (slot?.node_id) {
            const node = getGraphNode(slot.node_id);

            if (node) {
                return node;
            }
        }

        return null;
    };

    const getGeneratedUvNodePositions = () => {
        return values.shader_graph.nodes.reduce((acc, node) => {
            if (node.generated === true && node.system === "uv-cubemap") {
                acc[node.id] = cloneData(node.position || { x: 0, y: 0 });
            }

            return acc;
        }, {});
    };

    const getPreservedNodePosition = (positions, nodeId, fallback) => {
        return positions[nodeId]
            ? cloneData(positions[nodeId])
            : fallback;
    };

    const getSurfaceSlotOffset = key => {
        const node = getSurfaceSlotSourceNode(key);

        if (node?.settings && Number.isFinite(Number(node.settings.offset))) {
            return Number(node.settings.offset);
        }

        return Number(values.bitmap_maps[key]?.offset || 0);
    };

    const setSurfaceSlotOffset = (key, value) => {
        const offset = Number(value);

        values.bitmap_maps[key] = {
            ...values.bitmap_maps[key],
            offset: Number.isFinite(offset) ? offset : 0,
        };

        const node = getSurfaceSlotSourceNode(key);

        if (node) {
            node.settings = normalizeNodeSettings(node);
            node.settings.offset = values.bitmap_maps[key].offset;
        }

        requestPreviewDebounced();
    };

    const setSurfaceSlotChannel = (key, channel) => {
        const nextChannel = ["rgb", "rgba"].includes(channel) ? channel : "rgba";

        setSurfaceTextureSetting(key, "channel", nextChannel);
    };

    const setSurfaceTextureSetting = (key, settingKey, value) => {
        const current = values.bitmap_maps[key] || {};
        const nextSettings = mergeTextureSettingsForSlot(key, current, {
            [settingKey]: value,
        });

        values.bitmap_maps[key] = {
            ...current,
            ...nextSettings,
            texture_groups: (current.texture_groups || []).map(group => ({
                ...group,
                ...mergeTextureSettingsForSlot(key, nextSettings, group, {
                    [settingKey]: value,
                }),
            })),
        };

        Object.values(values.uv.faces || {}).forEach(face => {
            if (face?.bitmap?.url) {
                face.bitmap = {
                    ...face.bitmap,
                    ...mergeTextureSettingsForSlot(key, nextSettings, face.bitmap, {
                        [settingKey]: value,
                    }),
                };
            }
        });

        const node = getSurfaceSlotSourceNode(key);

        if (node) {
            node.settings = {
                ...normalizeNodeSettings(node),
                ...nextSettings,
            };

            if (Array.isArray(node.settings.texture_groups)) {
                node.settings.texture_groups = node.settings.texture_groups.map(group => ({
                    ...group,
                    ...mergeTextureSettingsForSlot(key, nextSettings, group, {
                        [settingKey]: value,
                    }),
                }));
            }
        }

    };

    const syncSurfaceOffsetsFromNodes = () => {
        SURFACE_FIELDS.forEach(field => {
            const node = getSurfaceSlotSourceNode(field.key);

            if (!node?.settings) {
                return;
            }

            values.bitmap_maps[field.key] = {
                ...values.bitmap_maps[field.key],
                offset: Number(node.settings.offset || 0),
                strength: Number(node.settings.strength ?? values.bitmap_maps[field.key].strength ?? 1),
                ...mergeTextureSettingsForSlot(field.key, values.bitmap_maps[field.key], node.settings),
                invert: false,
                blend: node.settings.blend || values.bitmap_maps[field.key].blend || "replace",
            };
        });
    };

    const getMapSlot = key => {
        return values.bitmap_maps[key];
    };

    const getSurfaceSlotNode = key => {
        const slot = values.bitmap_maps[key];

        if (!slot?.node_id) {
            return null;
        }

        return getGraphNode(slot.node_id);
    };

    const getSurfaceSlotLabel = key => {
        const slot = values.bitmap_maps[key];

        if (!slot?.enabled) {
            return "Bitmap";
        }

        if (slot.source_type === "multitexture") {
            const textureCount = Array.isArray(slot.texture_groups)
                ? slot.texture_groups.length
                : 0;

            const faceCount = Array.isArray(slot.mapped_faces)
                ? slot.mapped_faces.length
                : 0;

            return `MultiTexture · ${textureCount} textures / ${faceCount} faces`;
        }

        if (slot.source_type === "single") {
            return slot.name || "SingleTexture";
        }

        if (slot.source_type === "shader") {
            const node = getSurfaceSlotNode(key);
            return node?.label || slot.name || "Shader Input";
        }

        return slot.name || "SingleTexture";
    };

    const getSurfaceSlotDetail = key => {
        const slot = values.bitmap_maps[key];

        if (!slot?.enabled) {
            return "Kein Slot verbunden";
        }

        if (slot.source_type === "multitexture") {
            return (slot.texture_groups || [])
                .map(group => `${group.name}: ${group.faces.join(", ")}`)
                .join(" · ");
        }

        if (slot.source_type === "single") {
            const faceInfo = Array.isArray(slot.mapped_faces) && slot.mapped_faces.length
                ? ` · ${slot.mapped_faces.join(", ")}`
                : "";

            return `${slot.url || slot.layer_id || "Single Bitmap"}${faceInfo}`;
        }

        return slot.node_id || "Shader Node";
    };

    const getSurfaceSlotIcon = key => {
        const slot = values.bitmap_maps[key];

        if (!slot?.enabled) {
            return "mdi-image-plus";
        }

        if (slot.source_type === "multitexture") {
            return "mdi-check-decagram";
        }

        if (slot.source_type === "shader") {
            return "mdi-vector-link";
        }

        return "mdi-check-circle";
    };

    const getFirstUvShaderNode = () => (
        values.shader_graph.nodes.find(node => (
            node?.settings?.node_key === "uv.map"
        )) ||
        getGraphNode("uv-cubemap-layout") ||
        values.shader_graph.nodes.find(node => (
            node?.settings?.node_key === "uv.cubemap"
        )) ||
        null
    );

    const hasUvShaderNode = () => Boolean(getFirstUvShaderNode());

    const connectMaterialSlotBitmapNodesToUvNode = uvNode => {
        if (!uvNode) {
            return;
        }

        values.shader_graph.nodes.forEach(node => {
            const settings = node.settings || {};
            const isMaterialBitmap =
                node.settings?.node_key === "texture.bitmap" &&
                settings.slot &&
                values.bitmap_maps[settings.slot] &&
                node.inputs?.uv;

            if (!isMaterialBitmap) {
                return;
            }

            const exists = values.shader_graph.edges.some(edge => (
                edge.from.node === uvNode.id &&
                edge.from.socket === "uv" &&
                edge.to.node === node.id &&
                edge.to.socket === "uv"
            ));

            if (exists) {
                return;
            }

            connectEdgeUnique(
                {
                    node: uvNode.id,
                    socket: "uv",
                },
                {
                    node: node.id,
                    socket: "uv",
                },
                {
                    generated: true,
                    system: "uv-material-slot",
                    replaceInput: false,
                },
            );
        });
    };

    const isSurfaceSlotConnected = key => {
        return values.bitmap_maps[key]?.enabled === true;
    };

    const getCanvasPoint = event => {
        const rect = nodeCanvasRef.value?.getBoundingClientRect();

        if (!rect) {
            return { x: 0, y: 0 };
        }

        return {
            x: (event.clientX - rect.left - nodeCanvas.panX + nodeCanvasRef.value.scrollLeft) / nodeCanvas.zoom,
            y: (event.clientY - rect.top - nodeCanvas.panY + nodeCanvasRef.value.scrollTop) / nodeCanvas.zoom,
        };
    };

    const startCanvasPan = event => {
        if (event.target.closest(".mem-shader-graph-node")) {
            return;
        }

        if (event.target.closest("[data-socket]")) {
            return;
        }

        nodeCanvas.isPanning = true;
        nodeCanvas.panStart = {
            x: event.clientX,
            y: event.clientY,
        };

        nodeCanvas.origin = {
            x: nodeCanvas.panX,
            y: nodeCanvas.panY,
        };

        window.addEventListener("pointermove", moveCanvasPan);
        window.addEventListener("pointerup", stopCanvasPan);
    };

    const moveCanvasPan = event => {
        if (!nodeCanvas.isPanning) {
            return;
        }

        nodeCanvas.panX = nodeCanvas.origin.x + event.clientX - nodeCanvas.panStart.x;
        nodeCanvas.panY = nodeCanvas.origin.y + event.clientY - nodeCanvas.panStart.y;
    };

    const stopCanvasPan = () => {
        nodeCanvas.isPanning = false;

        window.removeEventListener("pointermove", moveCanvasPan);
        window.removeEventListener("pointerup", stopCanvasPan);
    };

    const handleCanvasWheel = event => {
        if (ui.value.nodeContextMenu.open) {
            return;
        }

        const rect = nodeCanvasRef.value?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        const oldZoom = nodeCanvas.zoom;
        const delta = event.deltaY > 0 ? -0.08 : 0.08;
        const nextZoom = clamp(oldZoom + delta, 0.35, 2.4);

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const worldX = (mouseX - nodeCanvas.panX) / oldZoom;
        const worldY = (mouseY - nodeCanvas.panY) / oldZoom;

        nodeCanvas.zoom = nextZoom;
        nodeCanvas.panX = mouseX - worldX * nextZoom;
        nodeCanvas.panY = mouseY - worldY * nextZoom;
    };

    const closeNodeContextMenu = () => {
        ui.value.nodeContextMenu.open = false;
    };

    const openNodeContextMenu = event => {
        if (
            event.target.closest(".mem-shader-graph-node") ||
            event.target.closest("[data-socket]") ||
            event.target.closest(".mem-node-context-menu")
        ) {
            return;
        }

        const point = getCanvasPoint(event);

        ui.value.activeNodeCategory = "";
        ui.value.nodeContextMenu.open = true;
        ui.value.nodeContextMenu.x = point.x;
        ui.value.nodeContextMenu.y = point.y;
        ui.value.nodeContextMenu.worldX = point.x;
        ui.value.nodeContextMenu.worldY = point.y;
        ui.value.nodeContextMenu.category = ui.value.nodeContextMenu.category || "Math";
    };

    const addShaderNodeFromContext = nodeType => {
        addShaderNode(nodeType, {
            x: ui.value.nodeContextMenu.worldX,
            y: ui.value.nodeContextMenu.worldY,
        });
        closeNodeContextMenu();
    };

    const getNodeSocketPosition = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);

        if (!node) {
            return { x: 0, y: 0 };
        }

        const cacheKey = `${nodeId}:${direction}:${socket}`;

        if (socketOffsetMemory[cacheKey]) {
            const offset = socketOffsetMemory[cacheKey];

            return {
                x: (node.position?.x || 0) + offset.x,
                y: (node.position?.y || 0) + offset.y,
            };
        }

        const escapedNodeId = typeof window !== "undefined" && window.CSS?.escape
            ? window.CSS.escape(nodeId)
            : String(nodeId).replace(/["\\]/g, "\\$&");
        const escapedSocket = typeof window !== "undefined" && window.CSS?.escape
            ? window.CSS.escape(socket)
            : String(socket).replace(/["\\]/g, "\\$&");
        const dot = nodeCanvasRef.value?.querySelector(
            `[data-node-id="${escapedNodeId}"][data-socket-name="${escapedSocket}"][data-socket-direction="${direction}"] i`
        );
        const canvasRect = nodeCanvasRef.value?.getBoundingClientRect();

        if (dot && canvasRect) {
            const dotRect = dot.getBoundingClientRect();

            return {
                x: (() => {
                    const value = (
                        dotRect.left + dotRect.width / 2
                        - canvasRect.left
                        - nodeCanvas.panX
                        + nodeCanvasRef.value.scrollLeft
                    ) / nodeCanvas.zoom;
                    socketOffsetMemory[cacheKey] = {
                        ...(socketOffsetMemory[cacheKey] || {}),
                        x: value - (node.position?.x || 0),
                    };
                    return value;
                })(),
                y: (() => {
                    const value = (
                        dotRect.top + dotRect.height / 2
                        - canvasRect.top
                        - nodeCanvas.panY
                        + nodeCanvasRef.value.scrollTop
                    ) / nodeCanvas.zoom;
                    socketOffsetMemory[cacheKey] = {
                        ...(socketOffsetMemory[cacheKey] || {}),
                        y: value - (node.position?.y || 0),
                    };
                    return value;
                })(),
            };
        }

        const nodeX = node.position?.x || 0;
        const nodeY = node.position?.y || 0;

        const sockets = direction === "input"
            ? Object.keys(node.inputs || {})
            : Object.keys(node.outputs || {});

        const index = Math.max(0, sockets.indexOf(socket));

        const nodeWidth =
            node.id === "material-output" || node.settings?.node_key === "output.material"
                ? 230
                : node.id === "principled-bsdf" || node.settings?.node_key === "shader.principled"
                    ? 270
                    : 220;

        return {
            x: direction === "input" ? nodeX : nodeX + nodeWidth,
            y: nodeY + 58 + index * 24,
        };
    };

    const graphEdges = computed(() => {
        nodeLayoutVersion.value;

        return values.shader_graph.edges.map(edge => {
            const from = getNodeSocketPosition(edge.from.node, edge.from.socket, "output");
            const to = getNodeSocketPosition(edge.to.node, edge.to.socket, "input");
            const dx = Math.max(60, Math.abs(to.x - from.x) * 0.45);

            return {
                ...edge,
                path: `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`,
            };
        });
    });

    const getNodeWidth = node => {
        if (!node) {
            return 220;
        }

        if (node.settings?.node_key === "output.material") {
            return 230;
        }

        if (node.settings?.node_key === "shader.principled") {
            return 270;
        }

        if (node.settings?.node_key === "texture.multitexture") {
            return 280;
        }

        return 220;
    };

    const createLayerBitmapPayload = layer => {
        if (!layer?.id) {
            return null;
        }

        const url = resolveLayerTextureUrl(layer);

        if (!url) {
            return null;
        }

        return {
            enabled: true,
            source_type: "single",

            layer_id: layer.id,
            url,
            name: layer.name || layer.id,

            node_id: "bitmap-baseColor",
            uv_node_id: "",

            faces: {},
            mapped_faces: [],
            texture_groups: [],

            filename: layer.texture?.filename || "",
            cached: layer.texture?.cached === true,

            ...mergeTextureSettingsForSlot("baseColor", values.bitmap_maps.baseColor),
            strength: values.bitmap_maps.baseColor?.strength ?? 1,
            offset: values.bitmap_maps.baseColor?.offset ?? 0,
            invert: values.bitmap_maps.baseColor?.invert === true,
            blend: values.bitmap_maps.baseColor?.blend || "replace",
        };
    };

    const ensureBaseColorSourceTexture = () => {
        const baseSlot = values.bitmap_maps.baseColor;

        // Wenn der User bewusst schon eine BaseColor Bitmap / Shader / UV-Map gesetzt hat,
        // nicht überschreiben.
        if (hasTextureSlot(baseSlot)) {
            return;
        }

        const layer = selectedSourceLayer.value || props.layer;

        const bitmap = createLayerBitmapPayload(layer);

        if (!bitmap) {
            return;
        }

        values.bitmap_maps.baseColor = {
            ...baseSlot,
            ...bitmap,
        };

        ensureBitmapNodeForSlot("baseColor");
    };

    const getNodeCenter = node => {
        const width = getNodeWidth(node);
        const inputCount = Object.keys(node.inputs || {}).length;
        const outputCount = Object.keys(node.outputs || {}).length;
        const socketRows = Math.max(inputCount, outputCount, 2);
        const height = 68 + socketRows * 24;

        return {
            x: (node.position?.x || 0) + width / 2,
            y: (node.position?.y || 0) + height / 2,
        };
    };

    const distancePointToSegment = (point, start, end) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        if (dx === 0 && dy === 0) {
            return Math.hypot(point.x - start.x, point.y - start.y);
        }

        const t = clamp(
            ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
            0,
            1,
        );

        const projection = {
            x: start.x + t * dx,
            y: start.y + t * dy,
        };

        return Math.hypot(point.x - projection.x, point.y - projection.y);
    };

    const getClosestEdgeForNode = node => {
        if (!node) {
            return null;
        }

        if (isNodeAlreadyInlineConnected(node)) {
            return null;
        }

        const center = getNodeCenter(node);

        let closest = null;
        let closestDistance = Infinity;

        values.shader_graph.edges.forEach(edge => {
            if (edge.core) {
                return;
            }

            if (
                edge.from.node === node.id ||
                edge.to.node === node.id
            ) {
                return;
            }

            if (!getCompatibleInsertSockets(node, edge)) {
                return;
            }

            const from = getNodeSocketPosition(edge.from.node, edge.from.socket, "output");
            const to = getNodeSocketPosition(edge.to.node, edge.to.socket, "input");
            const distance = distancePointToSegment(center, from, to);

            if (distance < closestDistance) {
                closest = edge;
                closestDistance = distance;
            }
        });

        if (!closest || closestDistance > SNAP_EDGE_DISTANCE) {
            return null;
        }

        return closest;
    };

    const isNodeAlreadyInlineConnected = node => {
        if (!node?.id) {
            return false;
        }

        return getNodeEdgesIn(node.id).length > 0 && getNodeEdgesOut(node.id).length > 0;
    };

    const getCompatibleInsertSockets = (node, edge) => {
        if (!node || !edge || node.id === "principled-bsdf" || node.id === "material-output") {
            return null;
        }

        const inputSocket = Object.keys(node.inputs || {}).find(socket => (
            canConnectSockets(edge.from, {
                node: node.id,
                socket,
            })
        ));
        const outputSocket = Object.keys(node.outputs || {}).find(socket => (
            canConnectSockets({
                node: node.id,
                socket,
            }, edge.to)
        ));

        if (!inputSocket || !outputSocket) {
            return null;
        }

        return {
            inputSocket,
            outputSocket,
        };
    };

    const insertNodeIntoEdge = (nodeId, edgeId) => {
        const node = getGraphNode(nodeId);
        const edge = values.shader_graph.edges.find(item => item.id === edgeId);

        if (!node || !edge) {
            return;
        }

        if (
            edge.from.node === node.id ||
            edge.to.node === node.id
        ) {
            return;
        }

        if (isNodeAlreadyInlineConnected(node)) {
            return;
        }

        const compatibleSockets = getCompatibleInsertSockets(node, edge);

        if (!compatibleSockets) {
            return;
        }

        const { inputSocket, outputSocket } = compatibleSockets;

        values.shader_graph.edges = values.shader_graph.edges.filter(item => item.id !== edge.id);

        values.shader_graph.edges.push({
            id: uuid('shader-node'),
            from: edge.from,
            to: {
                node: node.id,
                socket: inputSocket,
            },
        });

        values.shader_graph.edges.push({
            id: uuid('shader-node'),
            from: {
                node: node.id,
                socket: outputSocket,
            },
            to: edge.to,
        });

        syncNodeValuesToSurface(node);
        applyResolvedValueToNodeInput(edge.from, {
            node: node.id,
            socket: inputSocket,
        });
        propagateNodeOutputValues(node.id);
        syncConnectedSurfaceValuesFromGraph();

        activeSnapEdgeId.value = "";
        requestPreviewDebounced();
    };

    const getNodeValueSummary = node => {
        if (!node) {
            return "No node";
        }

        const settings = normalizeNodeSettings(node);
        const nodeKey = settings.node_key || "";

        if (nodeKey === "texture.bitmap") {
            return [
                settings.name || settings.layer_id || settings.url || settings.bitmap || "Bitmap",
                settings.channel ? `ch:${settings.channel}` : "",
                Number.isFinite(Number(settings.strength)) ? `str:${Number(settings.strength).toFixed(2)}` : "",
                Number.isFinite(Number(settings.offset)) ? `off:${Number(settings.offset).toFixed(2)}` : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "texture.multitexture") {
            const groups = Array.isArray(settings.texture_groups)
                ? settings.texture_groups
                : [];

            return [
                `${groups.length} textures`,
                settings.channel ? `ch:${settings.channel}` : "",
                Number.isFinite(Number(settings.strength)) ? `str:${Number(settings.strength).toFixed(2)}` : "",
                Number.isFinite(Number(settings.offset)) ? `off:${Number(settings.offset).toFixed(2)}` : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "uv.map") {
            return [
                settings.uv_map ? `map:${settings.uv_map}` : "Unwrap",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "vector.mapping") {
            const location = Array.isArray(settings.location) ? settings.location : [0, 0, 0];
            const rotation = Array.isArray(settings.rotation) ? settings.rotation : [0, 0, 0];
            const scale = Array.isArray(settings.scale) ? settings.scale : [1, 1, 1];

            return [
                `loc:${location.slice(0, 3).map(value => Number(value || 0).toFixed(2)).join(",")}`,
                `rot:${rotation.slice(0, 3).map(value => Number(value || 0).toFixed(2)).join(",")}`,
                `scale:${scale.slice(0, 3).map(value => Number(value ?? 1).toFixed(2)).join(",")}`,
            ].join(" · ");
        }

        if (nodeKey === "math.value") {
            return `value:${Number(settings.value ?? 0).toFixed(3)}`;
        }

        if (nodeKey === "math.operation") {
            return [
                settings.mode || settings.operation || "Add",
                `a:${Number(settings.a ?? settings.value ?? 0).toFixed(2)}`,
                `b:${Number(settings.b ?? settings.factor ?? 0).toFixed(2)}`,
                settings.clamp === true ? "clamp" : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "math.mix") {
            return [
                settings.type || "Float",
                `factor:${Number(settings.factor ?? 1).toFixed(2)}`,
                settings.clamp === true ? "clamp" : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "vector.mix") {
            return [
                settings.type || "Vector",
                `factor:${Number(settings.factor ?? 1).toFixed(2)}`,
                settings.clamp === true ? "clamp" : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "color.mix") {
            return [
                settings.type || "Color",
                `factor:${Number(settings.factor ?? 1).toFixed(2)}`,
                settings.clamp === true ? "clamp" : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "math.clamp") {
            return [
                settings.type || "Min Max",
                `min:${Number(settings.min ?? 0).toFixed(2)}`,
                `max:${Number(settings.max ?? 1).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "math.floatCurve") {
            return [
                `factor:${Number(settings.factor ?? 1).toFixed(2)}`,
                `value:${Number(settings.value ?? 0).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "texture.gradient") {
            return [
                settings.type || "Linear",
                Number.isFinite(Number(settings.factor)) ? `factor:${Number(settings.factor).toFixed(2)}` : "",
            ].filter(Boolean).join(" · ");
        }

        if (nodeKey === "texture.noise") {
            return [
                settings.dimensions || "3D",
                settings.type || "fBM",
                `scale:${Number(settings.scale ?? 0.5).toFixed(2)}`,
                `detail:${Number(settings.detail ?? 2).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "texture.wave") {
            return [
                settings.type || "Bands",
                settings.direction || "X",
                settings.wave || "Sine",
                `scale:${Number(settings.scale ?? 0.5).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "color.blackbody") {
            return `temperature:${Number(settings.temperature ?? 6500).toFixed(0)}K`;
        }

        if (nodeKey === "color.brightnessContrast") {
            return [
                `brightness:${Number(settings.brightness ?? 0).toFixed(2)}`,
                `contrast:${Number(settings.contrast ?? 0).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "color.colorRamp") {
            return [
                settings.color_mode || "RGB",
                settings.color_interpolation || "Linear",
                `pos:${Number(settings.position ?? 0.5).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "color.gamma") {
            return `gamma:${Number(settings.gamma ?? 1).toFixed(2)}`;
        }

        if (nodeKey === "color.hsv") {
            return [
                `h:${Number(settings.hue ?? 0.5).toFixed(2)}`,
                `s:${Number(settings.saturation ?? 1).toFixed(2)}`,
                `v:${Number(settings.value ?? 1).toFixed(2)}`,
                `factor:${Number(settings.factor ?? 1).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "color.invert") {
            return `factor:${Number(settings.factor ?? 1).toFixed(2)}`;
        }

        if (nodeKey === "color.combine") {
            return [
                settings.mode || "RGB",
                `r:${Number(settings.red ?? 0).toFixed(2)}`,
                `g:${Number(settings.green ?? 0).toFixed(2)}`,
                `b:${Number(settings.blue ?? 0).toFixed(2)}`,
                `a:${Number(settings.alpha ?? 1).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "color.separate") {
            return settings.mode || "RGB";
        }

        if (nodeKey === "color.rgbToBw") {
            return "RGB to BW";
        }

        if (nodeKey === "vector.combineXYZ") {
            return [
                `x:${Number(settings.x ?? 0).toFixed(2)}`,
                `y:${Number(settings.y ?? 0).toFixed(2)}`,
                `z:${Number(settings.z ?? 0).toFixed(2)}`,
            ].join(" · ");
        }

        if (nodeKey === "vector.separateXYZ") {
            return "Separate XYZ";
        }

        const definition = Node.getDefinition(node);

        if (definition?.fields?.length) {
            return definition.fields
                .slice(0, 3)
                .map(field => {
                    const value = settings[field];

                    const formatted = Array.isArray(value)
                        ? value.slice(0, 3).map(item => Number(item || 0).toFixed(2)).join(",")
                        : Number.isFinite(Number(value))
                            ? Number(value).toFixed(2)
                            : value;

                    return `${field}:${formatted ?? "-"}`;
                })
                .join(" · ");
        }

        return settings.node_name || node.label || node.type || "Node";
    };

    const getNodeConnectionSummary = node => {
        if (!node) {
            return "";
        }

        return `${getNodeEdgesIn(node.id).length} in · ${getNodeEdgesOut(node.id).length} out`;
    };

    const getNodeBadge = node => {
        if (!node) {
            return "";
        }

        if (node.generated && node.system === "uv-cubemap") {
            return "UV";
        }

        const slot = getSurfaceSlotForNode(node.id);

        if (slot) {
            return slot;
        }

        return normalizeNodeSettings(node).group || node.type || "";
    };

    const getNodeDisplayTitle = node => {
        if (!node) {
            return "";
        }

        const settings = normalizeNodeSettings(node);
        return node.label || settings.node_name || node.type || "Node";
    };

    const isMiniShaderNode = node => {
        if (!node) {
            return false;
        }

        return collapsedNodeIds[node.id] === true;
    };

    const toggleShaderNodeCollapsed = node => {
        if (!node?.id) {
            return;
        }

        collapsedNodeIds[node.id] = collapsedNodeIds[node.id] !== true;
        Object.keys(socketOffsetMemory).forEach(key => {
            if (key.startsWith(`${node.id}:`)) {
                delete socketOffsetMemory[key];
            }
        });
        requestAnimationFrame(() => {
            nodeLayoutVersion.value += 1;
        });
    };

    const getNodeInlineFieldItems = node => {
        if (!node || isMiniShaderNode(node)) {
            return [];
        }

        const inputs = node.inputs || {};
        const outputs = node.outputs || {};

        return getShaderNodeFieldItems(node).filter(field => (
            !inputs[field.key] && !outputs[field.key]
        ));
    };

    const activeConnectionPath = computed(() => {
        if (!activeConnection.value) {
            return "";
        }

        const direction = activeConnection.value.direction;

        const start = getNodeSocketPosition(
            activeConnection.value.node,
            activeConnection.value.socket,
            direction
        );

        const from = direction === "output"
            ? start
            : pointerPosition.value;

        const to = direction === "output"
            ? pointerPosition.value
            : start;

        const dx = Math.max(60, Math.abs(to.x - from.x) * 0.45);

        return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
    });

    const startMoveNode = (event, node) => {
        if (event.target.closest("[data-socket]")) {
            return;
        }

        if (node.locked === true) {
            return;
        }

        pauseAutoSync.value = true;

        activeShaderNodeId.value = node.id;

        const start = getCanvasPoint(event);
        const origin = {
            x: node.position?.x || 0,
            y: node.position?.y || 0,
        };

        draggingNode.value = {
            id: node.id,
            start,
            origin,
        };

        rememberNodePosition(node);

        window.addEventListener("pointermove", moveNode);
        window.addEventListener("pointerup", stopMoveNode);
    };

    const moveNode = event => {
        if (!draggingNode.value) {
            return;
        }

        const node = getGraphNode(draggingNode.value.id);

        if (!node) {
            return;
        }

        const point = getCanvasPoint(event);

        const nextPosition = {
            x: draggingNode.value.origin.x + point.x - draggingNode.value.start.x,
            y: draggingNode.value.origin.y + point.y - draggingNode.value.start.y,
        };

        node.position = nextPosition;
        nodePositionMemory[node.id] = cloneData(nextPosition);
        nodeLayoutVersion.value += 1;

        const snapEdge = getClosestEdgeForNode(node);
        activeSnapEdgeId.value = snapEdge?.id || "";
    };

    const stopMoveNode = () => {
        const draggedNodeId = draggingNode.value?.id || "";
        const snapEdgeId = activeSnapEdgeId.value;

        if (draggedNodeId) {
            const node = getGraphNode(draggedNodeId);
            rememberNodePosition(node);
        }

        draggingNode.value = null;

        window.removeEventListener("pointermove", moveNode);
        window.removeEventListener("pointerup", stopMoveNode);

        if (draggedNodeId && snapEdgeId) {
            insertNodeIntoEdge(draggedNodeId, snapEdgeId);
        }

        activeSnapEdgeId.value = "";

        queueMicrotask(() => {
            pauseAutoSync.value = false;
            applyRememberedNodePositions();
            requestPreviewDebounced();
        });
    };

    const startConnection = (event, node, socket, direction) => {
        event.stopPropagation();
        event.preventDefault();

        activeConnection.value = {
            node: node.id,
            socket,
            direction,
        };

        pointerPosition.value = getCanvasPoint(event);

        window.addEventListener("pointermove", moveConnection);
        window.addEventListener("pointerup", cancelConnection);
    };

    const moveConnection = event => {
        pointerPosition.value = getCanvasPoint(event);
    };

    const cancelConnection = () => {
        activeConnection.value = null;

        window.removeEventListener("pointermove", moveConnection);
        window.removeEventListener("pointerup", cancelConnection);
    };

    const completeConnection = (event, node, socket, direction) => {
        event.stopPropagation();
        event.preventDefault();

        if (!activeConnection.value) {
            return;
        }

        const start = activeConnection.value;

        if (start.node === node.id) {
            cancelConnection();
            return;
        }

        let from = null;
        let to = null;

        if (start.direction === "output" && direction === "input") {
            from = {
                node: start.node,
                socket: start.socket,
            };

            to = {
                node: node.id,
                socket,
            };
        }

        if (start.direction === "input" && direction === "output") {
            from = {
                node: node.id,
                socket,
            };

            to = {
                node: start.node,
                socket: start.socket,
            };
        }

        if (!from || !to || !canConnectSockets(from, to)) {
            cancelConnection();
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
            edge.to.node === to.node &&
            edge.to.socket === to.socket
        ));

        values.shader_graph.edges.push({
            id: uuid('shader-node'),
            core: (
                from.node === "principled-bsdf" &&
                from.socket === "bsdf" &&
                to.node === "material-output" &&
                to.socket === "surface"
            ),
            from,
            to,
        });

        applyResolvedValueToNodeInput(from, to);
        propagateNodeOutputValues(to.node);

        if (
            to.node === "principled-bsdf" &&
            values.bitmap_maps[to.socket]
        ) {
            syncSurfaceSlotFromShaderGraph(to.socket);
            syncNodeValuesToSurface(getGraphNode(from.node));
        }

        cancelConnection();
        reconcileShaderGraph();
        syncConnectedSurfaceValuesFromGraph();
        requestPreviewDebounced();
    };

    const isCoreEdge = edge => {
        return (
            edge.from.node === "principled-bsdf" &&
            edge.from.socket === "bsdf" &&
            edge.to.node === "material-output" &&
            edge.to.socket === "surface"
        );
    };

    const disconnectEdge = edgeId => {
        const edge = values.shader_graph.edges.find(item => item.id === edgeId);

        values.shader_graph.edges = values.shader_graph.edges.filter(item => item.id !== edgeId);

        if (
            edge?.to?.node === "principled-bsdf" &&
            values.bitmap_maps[edge.to.socket]
        ) {
            syncSurfaceSlotFromShaderGraph(edge.to.socket);
        }

        reconcileShaderGraph();
        requestPreviewDebounced();
    };

    const ensureBitmapNodeForSlot = slotKey => {
        ensureCoreNodes();

        const nodeId = `bitmap-${slotKey}`;
        const slot = values.bitmap_maps[slotKey];

        let node = getGraphNode(nodeId);

        if (!node) {
            const bitmapDefinition = Node.get("texture.bitmap");
            node = {
                id: nodeId,
                type: bitmapDefinition.type,
                label: `${slotKey} Bitmap/Image`,
                locked: false,
                position: {
                    x: 70,
                    y: 80 + SURFACE_FIELDS.findIndex(field => field.key === slotKey) * 44,
                },
                ...Node.getSockets(bitmapDefinition.key),
                settings: {
                    ...(Node.getDefaults(bitmapDefinition.key) || {}),
                    node_key: bitmapDefinition.key,
                    node_name: bitmapDefinition.label,
                    group: bitmapDefinition.group,
                    slot: slotKey,
                    layer_id: slot.layer_id,
                    url: slot.url,
                    name: slot.name,
                    ...mergeTextureSettingsForSlot(slotKey, slot),
                    bitmap: slot.name || slot.url || slot.layer_id || "",
                    strength: slot.strength,
                    offset: slot.offset,
                    invert: slot.invert,
                    blend: slot.blend,
                },
            };

            values.shader_graph.nodes.push(node);
        } else {
            node.settings = {
                ...(Node.getDefaults("texture.bitmap") || {}),
                ...node.settings,
                node_key: "texture.bitmap",
                node_name: "Bitmap/Image",
                group: "Texture",
                slot: slotKey,
                layer_id: slot.layer_id,
                url: slot.url,
                name: slot.name,
                ...mergeTextureSettingsForSlot(slotKey, slot),
                bitmap: slot.name || slot.url || slot.layer_id || "",
                strength: slot.strength,
                offset: slot.offset,
                invert: slot.invert,
                blend: slot.blend,
            };
        }

        const uvNode = ensureDefaultUvMapNode();

        if (uvNode) {
            connectUvNodeToBitmapNode(nodeId, uvNode);
        } else if (hasUvShaderNode()) {
            connectUvNodeToBitmapNode(nodeId);
        }

        const outputSocket = slotKey === "alpha" ? "alpha" : "color";

        const exists = values.shader_graph.edges.some(edge => (
            edge.from.node === nodeId &&
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));
        const inputOccupied = values.shader_graph.edges.some(edge => (
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        if (!exists && !inputOccupied) {
            values.shader_graph.edges.push({
                id: uuid('shader-node'),
                from: {
                    node: nodeId,
                    socket: outputSocket,
                },
                to: {
                    node: "principled-bsdf",
                    socket: slotKey,
                },
            });
        }
    };

    const removeAutoBitmapNode = slotKey => {
        const nodeId = `bitmap-${slotKey}`;

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            edge.from.node !== nodeId &&
            edge.to.node !== nodeId
        ));

        values.shader_graph.nodes = values.shader_graph.nodes.filter(node => (
            node.id !== nodeId
        ));
    };

    const clearMapSlot = key => {
        values.bitmap_maps[key] = {
            enabled: false,
            source_type: "none",

            layer_id: "",
            url: "",
            name: "",

            node_id: "",
            uv_node_id: "",

            faces: {},
            mapped_faces: [],
            texture_groups: [],

            filename: "",
            cached: false,
            ...mergeTextureSettingsForSlot(key),
            strength: 1,
            offset: 0,
            invert: false,
            blend: "replace",
        };

        removeAutoBitmapNode(key);

        if (Array.isArray(values.uv.target_slots)) {
            values.uv.target_slots = values.uv.target_slots.filter(slotKey => slotKey !== key);
        }

        if (values.uv.target_slot === key) {
            values.uv.target_slot = values.uv.target_slots?.[0] || "baseColor";
        }

        if (!getUvTargetSlots().some(slotKey => values.bitmap_maps[slotKey]?.uv_node_id === "uv-cubemap-layout")) {
            removeGeneratedUvShaderNodes();
        }

        requestPreviewDebounced();
    };

    const assignLayerToMap = (key, layer) => {
        if (!isUsableTextureLayer(layer)) {
            return;
        }

        const url = resolveLayerTextureUrl(layer);

        values.bitmap_maps[key] = {
            ...values.bitmap_maps[key],
            enabled: true,
            source_type: "single",

            layer_id: layer.id,
            url,
            name: layer.name || layer.id,
            filename: layer.texture?.filename || "",
            cached: layer.texture?.cached === true,

            node_id: `bitmap-${key}`,
            uv_node_id: "",

            faces: {},
            mapped_faces: [],
            texture_groups: [],
            ...mergeTextureSettingsForSlot(key, values.bitmap_maps[key]),
        };

        ensureBitmapNodeForSlot(key);
        requestPreviewDebounced();
    };

    const handleLayerDragStart = (event, layer) => {
        draggingSourceLayerId.value = layer.id;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-layer-id", layer.id);
        event.dataTransfer.setData("text/plain", layer.id);
    };

    const handleMapDrop = (event, key) => {
        event.preventDefault();

        const id =
            event.dataTransfer.getData("application/x-layer-id") ||
            event.dataTransfer.getData("text/plain") ||
            draggingSourceLayerId.value;

        const layer = textureLayers.value.find(item => item.id === id);

        if (layer) {
            assignLayerToMap(key, layer);
        }

        draggingSourceLayerId.value = "";
    };

    const isMaterialOutputEdge = edge => (
        edge?.from?.node === "principled-bsdf" &&
        edge?.from?.socket === "bsdf" &&
        edge?.to?.node === "material-output" &&
        edge?.to?.socket === "surface"
    );

    const getSocketType = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);

        if (!node) {
            return "";
        }

        const sockets = direction === "input"
            ? node.inputs || {}
            : node.outputs || {};

        const definition = sockets[socket];

        if (definition && typeof definition === "object") {
            return definition.type || "";
        }

        if (node.settings?.node_key === "shader.principled" && socket === "bsdf" && direction === "output") {
            return "shader";
        }

        if (node.settings?.node_key === "output.material" && socket === "surface" && direction === "input") {
            return "shader";
        }

        return "";
    };

    const canConnectSockets = (from, to) => {
        const fromType = getSocketType(from.node, from.socket, "output");
        const toType = getSocketType(to.node, to.socket, "input");

        if (!fromType || !toType) {
            return false;
        }

        if (to.node === "material-output" && to.socket === "surface") {
            return fromType === "shader" && toType === "shader";
        }

        if (to.node === "material-output" && to.socket === "volume") {
            return fromType === "shader" && toType === "shader";
        }

        if (to.node === "material-output" && to.socket === "displacement") {
            return ["vector", "float", "value"].includes(fromType);
        }

        if (to.node === "principled-bsdf") {
            if (to.socket === "surface") {
                return fromType === "shader";
            }

            return areSocketTypesCompatible(fromType, toType);
        }

        return areSocketTypesCompatible(fromType, toType);
    };

    const areSocketTypesCompatible = (fromType, toType) => {
        const colorLikeTypes = ["color", "image"];
        const numericTypes = ["float", "value"];

        if (fromType === toType) {
            return true;
        }

        if (colorLikeTypes.includes(fromType) && colorLikeTypes.includes(toType)) {
            return true;
        }

        if (colorLikeTypes.includes(fromType) && numericTypes.includes(toType)) {
            return true;
        }

        if (numericTypes.includes(fromType) && numericTypes.includes(toType)) {
            return true;
        }

        if (numericTypes.includes(fromType) && colorLikeTypes.includes(toType)) {
            return true;
        }

        if (numericTypes.includes(fromType) && toType === "vector") {
            return true;
        }

        if (fromType === "vector" && numericTypes.includes(toType)) {
            return true;
        }

        return fromType === "vector" && toType === "vector";
    };

    const getNodeSocketVisualType = (nodeId, socket, direction) => {
        const type = getSocketType(nodeId, socket, direction);

        if (type === "image") {
            return "color";
        }

        if (type === "value") {
            return "float";
        }

        return type || "generic";
    };

    const reconcileShaderGraph = () => {
        rememberAllNodePositions();

        if (!getGraphNode("principled-bsdf")) {
            values.shader_graph.nodes.push(createPrincipledNode());
        }

        if (!getGraphNode("material-output")) {
            values.shader_graph.nodes.push(createOutputNode());
        }

        values.shader_graph.nodes = values.shader_graph.nodes.map(node => {
            if (node.id === "principled-bsdf" || node.settings?.node_key === "shader.principled") {
                const base = createPrincipledNode();

                return {
                    ...base,
                    ...node,
                    id: "principled-bsdf",
                    type: "Shader",
                    locked: false,
                    position: getNodePosition(node, base.position),
                    inputs: base.inputs,
                    outputs: base.outputs,
                    settings: {
                        ...base.settings,
                        ...(node.settings || {}),
                        node_key: "shader.principled",
                        node_name: "Principled BSDF",
                        group: "Shader",
                    },
                };
            }

            if (node.id === "material-output" || node.settings?.node_key === "output.material") {
                const base = createOutputNode();

                return {
                    ...base,
                    ...node,
                    id: "material-output",
                    type: "Output",
                    locked: false,
                    position: getNodePosition(node, base.position),
                    inputs: base.inputs,
                    outputs: {},
                    settings: {
                        ...base.settings,
                        ...(node.settings || {}),
                        node_key: "output.material",
                        node_name: "Output",
                        group: "Output",
                    },
                };
            }

            if (node.id === "uv-cubemap-layout" && node.system === "uv-cubemap") {
                node.settings = {
                    ...(node.settings || {}),
                    node_key: "uv.cubemap",
                    node_name: "UV-CubeMap",
                    group: "UV",
                    mode: "cubemap",
                    uv_map: "CubeMap",
                };
            }

            const settings = normalizeNodeSettings(node);
            const definition = Node.get(settings.node_key);

            if (!definition) {
                return node;
            }

            const nodeIO = Node.getSockets(definition.key);

            return {
                ...node,
                type: definition.type,
                label: node.label || definition.label,
                locked: false,
                position: getNodePosition(node, node.position || { x: 280, y: 140 }),
                ...nodeIO,
                settings,
            };
        });

        const seen = new Set();

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => {
            const key = `${edge.from.node}:${edge.from.socket}->${edge.to.node}:${edge.to.socket}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });

        const nodeIds = new Set(values.shader_graph.nodes.map(node => node.id));

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            nodeIds.has(edge.from.node) &&
            nodeIds.has(edge.to.node)
        ));

        values.shader_graph.edges = values.shader_graph.edges.map(edge => ({
            ...edge,
            core: isMaterialOutputEdge(edge),
        }));

        if (!pauseAutoSync.value) {
            SURFACE_FIELDS.forEach(field => {
                syncSurfaceSlotFromShaderGraph(field.key);
            });

            syncSurfaceOffsetsFromNodes();
            syncConnectedSurfaceValuesFromGraph();
        }

        applyRememberedNodePositions();
    };

    const hasShaderNodeDefinition = node => Boolean(Node.getDefinition(node));

    const addShaderNode = (nodeType, position = null) => {
        const descriptor = Node.get(nodeType);

        if (!descriptor) {
            return;
        }

        if (descriptor.key === "shader.principled") {
            if (!getGraphNode("principled-bsdf")) {
                values.shader_graph.nodes.push(createPrincipledNode());
            }

            activeShaderNodeId.value = "principled-bsdf";
            reconcileShaderGraph();
            requestPreviewDebounced();
            return;
        }

        if (descriptor.key === "output.material") {
            let node = getGraphNode("material-output");

            if (!node) {
                node = createOutputNode();
                node.locked = false;
                values.shader_graph.nodes.push(node);
            } else {
                node.locked = false;
                node.position = getNodePosition(
                    node,
                    node.position || createOutputNode().position
                );

                node.type = "Output";
                node.label = "Material Output";
                node.settings = {
                    ...(Node.getDefaults("output.material") || {}),
                    ...(node.settings || {}),
                    node_key: "output.material",
                    node_name: "Output",
                    group: "Output",
                };
            }

            activeShaderNodeId.value = "material-output";
            reconcileShaderGraph();
            requestPreviewDebounced();
            return;
        }

        ensureCoreNodes();

        const hadUvShaderNode = hasUvShaderNode();
        const node = createShaderNode(descriptor.key, position || {
            x: 280,
            y: 120 + values.shader_graph.nodes.length * 30,
        });

        if (!node) {
            return;
        }

        values.shader_graph.nodes.push(node);

        if (
            (node.settings.node_key === "uv.map" || node.settings.node_key === "uv.cubemap") &&
            !hadUvShaderNode
        ) {
            connectMaterialSlotBitmapNodesToUvNode(node);
        }

        if (
            (
                node.settings.node_key === "texture.bitmap" ||
                node.settings.node_key === "texture.multitexture"
            ) &&
            hasUvShaderNode()
        ) {
            connectUvNodeToBitmapNode(node.id);
        }

        activeShaderNodeId.value = node.id;
        requestPreviewDebounced();
    };

    const removeShaderNode = id => {
        const node = getGraphNode(id);

        if (!node) {
            return;
        }

        if (
            node.id === "material-output" ||
            node.settings?.node_key === "output.material" ||
            node.locked
        ) {
            values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
                edge.from.node !== id &&
                edge.to.node !== id
            ));

            reconcileShaderGraph();
            requestPreviewDebounced();
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            edge.from.node !== id &&
            edge.to.node !== id
        ));

        values.shader_graph.nodes = values.shader_graph.nodes.filter(item => item.id !== id);

        activeShaderNodeId.value = "principled-bsdf";
        reconcileShaderGraph();
        requestPreviewDebounced();
    };

    const connectUvNodeToBitmapNode = (bitmapNodeId, preferredUvNode = null) => {
        const uvNode = preferredUvNode || getFirstUvShaderNode();
        const bitmapNode = getGraphNode(bitmapNodeId);

        if (!uvNode || !bitmapNode || !bitmapNode.inputs?.uv) {
            return;
        }

        connectEdgeUnique(
            {
                node: uvNode.id,
                socket: "uv",
            },
            {
                node: bitmapNode.id,
                socket: "uv",
            },
            {
                generated: true,
                system: "uv-cubemap",
                replaceInput: false,
            },
        );
    };

    const connectEdgeUnique = (from, to, extra = {}) => {
        const exists = values.shader_graph.edges.some(edge => (
            edge.from.node === from.node &&
            edge.from.socket === from.socket &&
            edge.to.node === to.node &&
            edge.to.socket === to.socket
        ));

        if (exists) {
            return;
        }

        if (extra.replaceInput === false && isSocketOccupied(to)) {
            return;
        }

        if (extra.replaceInput !== false) {
            values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
                edge.to.node === to.node &&
                edge.to.socket === to.socket
            ));
        }

        values.shader_graph.edges.push({
            id: uuid('shader-node'),
            from,
            to,
            ...Object.fromEntries(
                Object.entries(extra).filter(([key]) => key !== "replaceInput")
            ),
        });
    };

    const normalizeTextureUrl = url => {
        return String(url || "").trim();
    };

    const assignLayerToUvFace = (face, layer) => {
        if (!values.uv.faces[face] || !isUsableTextureLayer(layer)) {
            return;
        }

        const url = resolveLayerTextureUrl(layer);

        values.uv.faces[face].bitmap = {
            layer_id: layer.id,
            url,
            name: layer.name || layer.id,
            width: Number(layer.width || 0),
            height: Number(layer.height || 0),
            filename: layer.texture?.filename || "",
            cached: layer.texture?.cached === true,
            ...mergeTextureSettingsForSlot(getUvTargetSlots()[0], values.bitmap_maps[getUvTargetSlots()[0]]),
        };
    };

    const assignLayerToSelectedUvFaces = async layer => {
        if (!isUsableTextureLayer(layer)) {
            return;
        }

        pauseAutoSync.value = true;

        try {
            if (values.uv.view_mode === "unwrap") {
                const bitmap = UV.createBitmap({
                    layer_id: layer.id,
                    url: resolveLayerTextureUrl(layer),
                    name: layer.name || layer.id,
                    width: Number(layer.width || 0),
                    height: Number(layer.height || 0),
                    filename: layer.texture?.filename || "",
                    cached: layer.texture?.cached === true,
                    ...mergeTextureSettingsForSlot("baseColor", values.bitmap_maps.baseColor),
                });
                const selected = new Set(values.uv.selected_island_ids || []);
                const shouldAssignAll = selected.size === 0;

                values.uv.islands = values.uv.islands.map(island => (
                    shouldAssignAll || selected.has(island.id)
                        ? {
                            ...island,
                            bitmap,
                            bitmaps: {
                                baseColor: bitmap,
                            },
                        }
                        : island
                ));

                syncUvToBitmapSlot("baseColor");
                await drawUvCanvas();
                return;
            }

            selectedUvFaces.value.forEach(face => {
                assignLayerToUvFace(face, layer);
            });

            syncUvCubeMapToShaderGraph();
            await drawUvCanvas();
        } finally {
            queueMicrotask(() => {
                pauseAutoSync.value = false;
                requestPreviewDebounced();
            });
        }
    };

    const cloneData = value => {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    };

    const mergeBitmapMaps = incoming => {
        const defaults = createBitmapMaps();
        const source = incoming || {};

        Object.keys(defaults).forEach(key => {
            defaults[key] = {
                ...defaults[key],
                ...(source[key] || {}),
                ...mergeTextureSettingsForSlot(key, defaults[key], source[key] || {}),
            };

            defaults[key].texture_groups = (defaults[key].texture_groups || []).map(group => ({
                ...group,
                ...mergeTextureSettingsForSlot(key, defaults[key], group),
            }));
        });

        return defaults;
    };

    const loadMaterialPackage = async layer => {
        const packageUrl = layer?.package?.url;

        if (!packageUrl) {
            return null;
        }

        try {
            const response = await fetch(packageUrl, {
                cache: "no-store",
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (_error) {
            return null;
        }
    };

    const resolveMaterialEditSource = (layer, materialPackage = null) => {
        const packageValues =
            materialPackage?.values ||
            materialPackage?.material ||
            materialPackage ||
            {};

        const layerValues =
            layer?.values ||
            layer?.material ||
            {};

        return {
            ...cloneData(layerValues),
            ...cloneData(packageValues),

            surface: {
                ...cloneData(layerValues.surface || layerValues.principled_bsdf || {}),
                ...cloneData(layer?.surface || {}),
                ...cloneData(packageValues.surface || packageValues.principled_bsdf || {}),
            },

            geometry: {
                ...cloneData(layerValues.geometry || {}),
                ...cloneData(layer?.geometry || {}),
                ...cloneData(packageValues.geometry || {}),
            },

            mesh: {
                ...cloneData(layerValues.mesh || {}),
                ...cloneData(layer?.mesh || {}),
                ...cloneData(packageValues.mesh || {}),
            },

            particle_system: {
                ...cloneData(layerValues.particle_system || {}),
                ...cloneData(layer?.particle_system || {}),
                ...cloneData(packageValues.particle_system || {}),
            },

            light: {
                ...cloneData(layerValues.light || {}),
                ...cloneData(layer?.light || {}),
                ...cloneData(layer?.settings?.light || {}),
                ...cloneData(packageValues.light || {}),
                ...cloneData(packageValues.settings?.light || {}),
            },

            bitmap_maps: {
                ...cloneData(layerValues.bitmap_maps || {}),
                ...cloneData(layer?.bitmap_maps || {}),
                ...cloneData(packageValues.bitmap_maps || {}),
            },

            uv: {
                ...cloneData(layerValues.uv || {}),
                ...cloneData(layer?.uv || {}),
                ...cloneData(packageValues.uv || {}),
            },

            shader_graph: resolveImportedShaderGraphSource(layer, packageValues),

            preview: {
                ...cloneData(layerValues.preview || {}),
                ...cloneData(layer?.preview || {}),
                ...cloneData(packageValues.preview || {}),
            },

            settings: {
                ...cloneData(layerValues.settings || {}),
                ...cloneData(layer?.settings || {}),
                ...cloneData(packageValues.settings || {}),
            },
        };
    };

    const resolveImportedShaderGraphSource = (layer, source = {}) => {
        const candidates = [
            source.shader_graph,
            source.shader?.graph,
            source.material?.shader_graph,
            source.material?.shader?.graph,

            layer?.shader_graph,
            layer?.shader?.graph,
            layer?.material?.shader_graph,
            layer?.material?.shader?.graph,
            layer?.values?.shader_graph,
            layer?.values?.shader?.graph,
        ];

        return candidates.find(graph => (
            graph &&
            Array.isArray(graph.nodes) &&
            graph.nodes.length
        )) || null;
    };

    const isMaterialOutputNode = node => (
        node?.id === "material-output" ||
        node?.settings?.node_key === "output.material"
    );

    const isPrincipledNode = node => (
        node?.id === "principled-bsdf" ||
        node?.settings?.node_key === "shader.principled" ||
        node?.settings?.node_key === "principled.bsdf"
    );

    const normalizeImportedShaderGraph = graph => {
        const fallback = createShaderGraph();

        const sourceNodes = Array.isArray(graph?.nodes)
            ? cloneData(graph.nodes)
            : cloneData(fallback.nodes);

        const sourceEdges = Array.isArray(graph?.edges)
            ? cloneData(graph.edges)
            : cloneData(fallback.edges);

        let nodes = sourceNodes.map(node => ({
            ...node,
            settings: Node.normalizeSettings(node),
        }));

        let edges = sourceEdges.map(edge => ({
            ...edge,
            from: { ...(edge.from || {}) },
            to: { ...(edge.to || {}) },
        }));

        // -------------------------
        // Principled kanonisieren
        // -------------------------
        const principledNodes = nodes.filter(isPrincipledNode);

        if (!principledNodes.length) {
            nodes.push(createPrincipledNode());
        } else {
            const keeper =
                principledNodes.find(node => node.id === "principled-bsdf") ||
                principledNodes[0];

            const duplicateIds = principledNodes
                .filter(node => node !== keeper)
                .map(node => node.id)
                .filter(Boolean);

            keeper.id = "principled-bsdf";
            keeper.settings = {
                ...(keeper.settings || {}),
                node_key: keeper.settings?.node_key || "shader.principled",
            };

            edges = edges.map(edge => {
                const next = {
                    ...edge,
                    from: { ...(edge.from || {}) },
                    to: { ...(edge.to || {}) },
                };

                if (duplicateIds.includes(next.from.node)) {
                    next.from.node = keeper.id;
                }

                if (duplicateIds.includes(next.to.node)) {
                    next.to.node = keeper.id;
                }

                return next;
            });

            nodes = nodes.filter(node => (
                node === keeper ||
                !duplicateIds.includes(node.id)
            ));
        }

        // -------------------------
        // Material Output kanonisieren
        // -------------------------
        const outputNodes = nodes.filter(isMaterialOutputNode);

        if (!outputNodes.length) {
            nodes.push(createOutputNode());
        } else {
            const keeper =
                outputNodes.find(node => node.id === "material-output") ||
                outputNodes[0];

            const duplicateIds = outputNodes
                .filter(node => node !== keeper)
                .map(node => node.id)
                .filter(Boolean);

            keeper.id = "material-output";
            keeper.settings = {
                ...(keeper.settings || {}),
                node_key: "output.material",
            };

            edges = edges.map(edge => {
                const next = {
                    ...edge,
                    from: { ...(edge.from || {}) },
                    to: { ...(edge.to || {}) },
                };

                if (duplicateIds.includes(next.from.node)) {
                    next.from.node = keeper.id;
                }

                if (duplicateIds.includes(next.to.node)) {
                    next.to.node = keeper.id;
                }

                return next;
            });

            nodes = nodes.filter(node => (
                node === keeper ||
                !duplicateIds.includes(node.id)
            ));
        }

        const nodeIds = new Set(nodes.map(node => node.id));

        edges = edges.filter(edge => (
            edge?.from?.node &&
            edge?.from?.socket &&
            edge?.to?.node &&
            edge?.to?.socket &&
            nodeIds.has(edge.from.node) &&
            nodeIds.has(edge.to.node) &&
            edge.from.node !== edge.to.node
        ));

        // Surface-Verbindung nur ergänzen, wenn keine existiert.
        const hasSurfaceConnection = edges.some(edge => (
            edge.from.node === "principled-bsdf" &&
            edge.from.socket === "bsdf" &&
            edge.to.node === "material-output" &&
            edge.to.socket === "surface"
        ));

        if (!hasSurfaceConnection) {
            edges.push({
                id: uuid("edge"),
                from: {
                    node: "principled-bsdf",
                    socket: "bsdf",
                },
                to: {
                    node: "material-output",
                    socket: "surface",
                },
                generated: true,
                system: "material-core",
            });
        }

        return {
            ...(graph || {}),
            nodes,
            edges,
        };
    };

    const hydrateFromMaterialLayer = async layer => {
        if (!layer || Number(layer.type) !== 5) {
            return;
        }

        pauseAutoSync.value = true;

        const materialPackage = await loadMaterialPackage(layer);
        const source = resolveMaterialEditSource(layer, materialPackage);

        values.name = layer.name || values.name;
        values.surface = {
            ...createSurface(),
            ...(cloneData(source.surface || source.material?.principled_bsdf || {})),
        };
        values.geometry = {
            ...createGeometry(),
            ...(cloneData(source.geometry || source.material?.geometry || {})),
        };
        values.mesh = Mesh.fromPlain(
            cloneData(source.mesh || source.material?.mesh || {}),
            values.geometry,
        );
        values.particle_system = ParticleSystem.fromPlain(
            cloneData(source.particle_system || source.material?.particle_system || source.shader?.particle_system || {}),
            {
                mesh: values.mesh,
                volume: values.mesh?.volume || values.geometry?.volume,
                fluid: values.mesh?.fluid || values.geometry?.fluid,
                physics: values.physics,
            },
        );
        values.light = {
            ...createLight(),
            ...(cloneData(source.light || source.settings?.light || source.shader?.light || {})),
        };
        values.bitmap_maps = mergeBitmapMaps(cloneData(source.bitmap_maps || source.material?.bitmap_maps || {}));
        values.uv = UV.normalize(cloneData(source.uv || createUv()));
        if (!values.uv.vertices.length || !values.uv.triangles.length) {
            applyUvLayoutToMesh({ source: "hydrate" });
        }
        values.shader_graph = normalizeImportedShaderGraph(source.shader_graph);
        rememberAllNodePositions();
        values.cube_size = Number(source.settings?.cube_size || values.cube_size || 256);
        values.texture_size = normalizeTextureSize(
            source?.settings?.texture_size ??
            source?.texture_size ??
            source?.material?.texture_size ??
            "Original"
        );
        values.texture_preload = TEXTURE_SIZE_OPTIONS;
        values.rotate_preview = source.preview?.rotate ?? source.preview?.idle_rotation?.enabled ?? values.rotate_preview;
        values.wireframe_preview = source.preview?.wireframe ?? values.wireframe_preview;
        values.faces_preview = source.preview?.faces ?? values.faces_preview;
        values.vertices_preview = source.preview?.vertices ?? values.vertices_preview;
        values.fluid_mesh_preview = source.preview?.fluid_mesh ?? source.settings?.fluid_mesh_preview ?? values.fluid_mesh_preview;
        values.fluid_particle_preview = source.preview?.fluid_particles ?? source.settings?.fluid_particle_preview ?? values.fluid_particle_preview;
        values.render_backend = String(
            source.settings?.render_backend ??
            source.render_backend ??
            values.render_backend ??
            "WEBGL2"
        ).toUpperCase() === "CANVAS2D" ? "CANVAS2D" : "WEBGL2";
        values.blend_mode = source.settings?.blend_mode || values.blend_mode;
        values.alpha_clip = Number(source.settings?.alpha_clip ?? source.alpha_clip ?? values.alpha_clip ?? 0.5);
        values.shadow_method = source.settings?.shadow_method || values.shadow_method;
        values.backface_culling = source.settings?.backface_culling ?? values.backface_culling;
        values.show_backface = source.settings?.show_backface ?? values.show_backface;
        values.screen_space_refraction = source.settings?.screen_space_refraction ?? values.screen_space_refraction;
        values.refraction_depth = Number(source.settings?.refraction_depth ?? values.refraction_depth ?? 0);
        values.subsurface_translucency = source.settings?.subsurface_translucency ?? values.subsurface_translucency;
        values.use_nodes = source.settings?.use_nodes ?? values.use_nodes;

        syncGeometryVolumeShaderGraph();
        syncParticleSystemGeometryVolumeBinding();
        syncSurfaceSlotFromUvCubeMap();
        syncAllSurfaceSlotsFromShaderGraph();

        queueMicrotask(() => {
            pauseAutoSync.value = false;
            requestPreviewDebounced();
        });
    };

    const CUBE_FACE_ORDER = ["front", "back", "left", "right", "top", "bottom"];

    const getCubemapTextureLayers = () => {
        const layers = textureLayers.value.filter(isUsableTextureLayer);

        if (layers.length) {
            return layers;
        }

        return selectedSourceLayer.value && isUsableTextureLayer(selectedSourceLayer.value)
            ? [selectedSourceLayer.value]
            : [];
    };

    const ensureCubemapFaceTexturesFromLayers = () => {
        const layers = getCubemapTextureLayers();

        if (!layers.length) {
            return false;
        }

        CUBE_FACE_ORDER.forEach((face, index) => {
            const currentBitmap = values.uv.faces[face]?.bitmap || {};

            if (currentBitmap.url || currentBitmap.layer_id) {
                return;
            }

            const layer = layers[index % layers.length];

            assignLayerToUvFace(face, layer);
        });

        values.uv.mode = "cubemap";
        values.uv.view_mode = "cubemap";

        values.uv.active_face = values.uv.active_face || "front";
        values.uv.selected_faces = [values.uv.active_face];

        return true;
    };

    const getMappedUvFaces = () => {
        return CUBE_FACE_ORDER.filter(face => Boolean(values.uv.faces[face]?.bitmap?.url));
    };

    const getMappedUvTextureGroups = () => {
        const mappedFaces = getMappedUvFaces();

        if ((values.uv.mode === "cubemap" || values.uv.view_mode === "cubemap") && hasUvCubemapNode.value) {
            return CUBE_FACE_ORDER
                .map((face, index) => {
                    const bitmap = values.uv.faces[face]?.bitmap || {};
                    const url = normalizeTextureUrl(bitmap.url);

                    if (!url && !bitmap.layer_id) {
                        return null;
                    }

                    return {
                        url,
                        layer_id: bitmap.layer_id || "",
                        name: bitmap.name || bitmap.layer_id || `CubeMap ${face}`,
                        filename: bitmap.filename || "",
                        cached: bitmap.cached === true,
                        bitmap,
                        slot: `texture_${index + 1}`,
                        faces: [face],
                    };
                })
                .filter(Boolean);
        }

        const groups = mappedFaces.reduce((acc, face) => {
            const bitmap = values.uv.faces[face]?.bitmap || {};
            const url = normalizeTextureUrl(bitmap.url);

            if (!url) {
                return acc;
            }

            if (!acc[url]) {
                acc[url] = {
                    url,
                    bitmap,
                    ...mergeTextureSettingsForSlot(getUvTargetSlots()[0], values.bitmap_maps[getUvTargetSlots()[0]], bitmap),
                    faces: [],
                };
            }

            acc[url].faces.push(face);

            return acc;
        }, {});

        return Object.values(groups);
    };

    const getUvTextureMode = () => {
        const groups = getMappedUvTextureGroups();

        if (!groups.length) {
            return "none";
        }

        return groups.length > 1 ? "multitexture" : "single";
    };

    const getIncomingShaderEdge = (nodeId, sockets = []) => {
        return values.shader_graph.edges.find(edge => (
            edge.to.node === nodeId &&
            (!sockets.length || sockets.includes(edge.to.socket))
        ));
    };

    const resolveShaderGraphSource = (nodeId, seen = new Set()) => {
        if (!nodeId || seen.has(nodeId)) {
            return null;
        }

        seen.add(nodeId);

        const node = getGraphNode(nodeId);

        if (!node) {
            return null;
        }

        const settings = normalizeNodeSettings(node);

        if (node.settings?.node_key === "texture.bitmap") {
            if (!settings.url && !settings.layer_id) {
                return null;
            }

            return {
                source_type: "single",
                enabled: true,
                node_id: node.id,
                layer_id: settings.layer_id || "",
                url: settings.url || "",
                name: settings.name || node.label || node.id,
                filename: settings.filename || "",
                cached: settings.cached === true,
                ...mergeTextureSettingsForSlot(settings.slot || settings.target_slot || getSurfaceSlotForNode(node.id), settings),
                strength: settings.strength ?? 1,
                offset: settings.offset ?? 0,
                invert: settings.invert === true,
                blend: settings.blend || "replace",
                texture_groups: [],
            };
        }

        if (node.settings?.node_key === "texture.multitexture") {
            const configuredGroups = Array.isArray(settings.texture_groups)
                ? settings.texture_groups
                : [];

            const textureGroups = configuredGroups
                .map((group, index) => {
                    const inputSocket = group.slot || `texture_${index + 1}`;
                    const sourceEdge = getIncomingShaderEdge(node.id, [inputSocket]);
                    const resolved = resolveShaderGraphSource(sourceEdge?.from?.node, new Set(seen));
                    const merged = resolved?.url
                        ? {
                            ...group,
                            url: resolved.url,
                            layer_id: resolved.layer_id || group.layer_id || "",
                            name: resolved.name || group.name || "Texture",
                            filename: resolved.filename || group.filename || "",
                            cached: resolved.cached === true,
                            ...mergeTextureSettingsForSlot(settings.slot || settings.target_slot || getSurfaceSlotForNode(node.id), settings, group, resolved),
                        }
                        : group;

                    if (!merged.url) {
                        return null;
                    }

                    return {
                        slot: merged.slot || inputSocket,
                        url: merged.url,
                        name: merged.name || merged.layer_id || "Texture",
                        layer_id: merged.layer_id || "",
                        filename: merged.filename || "",
                        cached: merged.cached === true,
                        ...mergeTextureSettingsForSlot(settings.slot || settings.target_slot || getSurfaceSlotForNode(node.id), settings, merged),
                        faces: Array.isArray(merged.faces) ? merged.faces : [],
                    };
                })
                .filter(Boolean);

            if (!textureGroups.length) {
                return null;
            }

            return {
                source_type: "multitexture",
                enabled: true,
                node_id: node.id,
                layer_id: "",
                url: "",
                name: settings.name || node.label || "Cube MultiTexture",
                filename: "",
                cached: textureGroups.every(group => group.cached === true),
                ...mergeTextureSettingsForSlot(settings.slot || settings.target_slot || getSurfaceSlotForNode(node.id), settings),
                strength: settings.strength ?? 1,
                offset: settings.offset ?? 0,
                invert: settings.invert === true,
                blend: settings.blend || "replace",
                texture_groups: textureGroups,
            };
        }

        const sourceEdge = getIncomingShaderEdge(node.id, [
            "image",
            "bitmap",
            "color",
            "value",
            "factor",
            "vector",
            "uv",
            "surface",
            "texture",
            "a",
            "b",
        ]);
        const resolved = resolveShaderGraphSource(sourceEdge?.from?.node, seen);

        if (!resolved) {
            return null;
        }

        return {
            ...resolved,
            source_type: "shader",
            node_id: node.id,
            name: node.label || resolved.name || node.id,
            ...mergeTextureSettingsForSlot(getSurfaceSlotForNode(node.id), resolved, settings),
            strength: settings.strength ?? resolved.strength ?? 1,
            offset: settings.offset ?? resolved.offset ?? 0,
            invert: settings.invert === true || resolved.invert === true,
            blend: settings.blend || resolved.blend || "replace",
        };
    };

    const syncSurfaceSlotFromShaderGraph = slotKey => {
        const edge = values.shader_graph.edges.find(item => (
            item.to.node === "principled-bsdf" &&
            item.to.socket === slotKey
        ));

        if (!edge) {
            if (values.bitmap_maps[slotKey]?.source_type === "shader") {
                values.bitmap_maps[slotKey] = {
                    ...values.bitmap_maps[slotKey],
                    enabled: false,
                    source_type: "none",
                    node_id: "",
                    uv_node_id: "",
                    name: "",
                };
            }

            return;
        }

        const sourceNode = getGraphNode(edge.from.node);

        if (!sourceNode) {
            return;
        }

        const isGeneratedUv =
            sourceNode.generated === true &&
            sourceNode.system === "uv-cubemap";

        if (isGeneratedUv) {
            syncSurfaceSlotFromUvCubeMap(slotKey);
            return;
        }

        const resolved = resolveShaderGraphSource(sourceNode.id);

        if (!resolved) {
            const value = resolveNodeOutputValue(sourceNode.id, edge.from.socket);

            if (value !== null && value !== undefined) {
                applyResolvedValueToSurfaceSlot(slotKey, value, sourceNode);
            }

            return;
        }

        values.bitmap_maps[slotKey] = {
            ...values.bitmap_maps[slotKey],
            enabled: true,
            source_type: resolved.source_type,
            node_id: sourceNode.id,
            uv_node_id: "",
            name: resolved.name || sourceNode.label || sourceNode.id,
            url: resolved.url || "",
            layer_id: resolved.layer_id || "",
            filename: resolved.filename || "",
            cached: resolved.cached === true,
            faces: resolved.faces || values.bitmap_maps[slotKey]?.faces || {},
            mapped_faces: resolved.mapped_faces || values.bitmap_maps[slotKey]?.mapped_faces || [],
            texture_groups: resolved.texture_groups || [],
            ...mergeTextureSettingsForSlot(slotKey, values.bitmap_maps[slotKey], resolved),
            strength: resolved.strength ?? values.bitmap_maps[slotKey]?.strength ?? 1,
            offset: resolved.offset ?? values.bitmap_maps[slotKey]?.offset ?? 0,
            invert: resolved.invert === true,
            blend: resolved.blend || values.bitmap_maps[slotKey]?.blend || "replace",
        };
    };

    const syncAllSurfaceSlotsFromShaderGraph = () => {
        SURFACE_FIELDS.forEach(field => {
            syncSurfaceSlotFromShaderGraph(field.key);
        });
    };

    const getUvTargetSlots = () => {
        const targetSlots = Array.isArray(values.uv.target_slots) && values.uv.target_slots.length
            ? values.uv.target_slots
            : [values.uv.target_slot || "baseColor"];

        const valid = targetSlots.filter(slotKey => Boolean(values.bitmap_maps[slotKey]));

        return valid.length ? Array.from(new Set(valid)) : ["baseColor"];
    };

    const prepareMaterialValues = ({ preview = false } = {}) => {
        pauseAutoSync.value = true;

        try {
            ensureCoreNodes();
            rebuildMaterialMesh({ preserveLayout: true });
            syncGeometryVolumeShaderGraph();
            syncParticleSystemGeometryVolumeBinding();

            // Wichtig: Source-Layer als echte BaseColor-Map in den Contract schreiben.
            ensureBaseColorSourceTexture();

            // UV zuerst in die aktive Node-Kette schreiben, ohne die andere UV-Variante zu verwerfen.
            if (values.uv.view_mode === "cubemap" && hasUvCubemapNode.value) {
                ensureCubemapFaceTexturesFromLayers();
                syncUvCubeMapToShaderGraph();
                connectUvModeOutputToSurfaceSlots("cubemap");
            } else {
                connectUvModeOutputToSurfaceSlots("unwrap");
            }

            // Graph bereinigen und Slot-Zustände ableiten.
            reconcileShaderGraph();
            syncAllSurfaceSlotsFromShaderGraph();
            syncSurfaceOffsetsFromNodes();

            return buildMaterialDraft({ preview });
        } finally {
            queueMicrotask(() => {
                pauseAutoSync.value = false;
            });
        }
    };

    const syncSurfaceSlotFromUvCubeMap = slotKey => {
        if (slotKey) {
            syncUvToBitmapSlot(slotKey);
            return;
        }

        syncUvToActiveSlots();
    };

    const syncUvToActiveSlots = () => {
        getUvTargetSlots().forEach(syncUvToBitmapSlot);
    };

    const syncUvToBitmapSlot = slotKey => {
        const slot = values.bitmap_maps[slotKey];

        if (!slot) {
            return;
        }

        if (values.uv.mode === "unwrap" || values.uv.view_mode === "unwrap") {
            const islandBitmaps = (values.uv.islands || [])
                .map(island => island?.bitmap || island?.bitmaps?.baseColor || null)
                .filter(bitmap => bitmap?.url || bitmap?.layer_id);
            const fallbackLayer = selectedSourceLayer.value;
            const fallbackBitmap = fallbackLayer
                ? {
                    layer_id: fallbackLayer.id,
                    url: resolveLayerTextureUrl(fallbackLayer),
                    name: fallbackLayer.name || fallbackLayer.id,
                    width: Number(fallbackLayer.width || 0),
                    height: Number(fallbackLayer.height || 0),
                    filename: fallbackLayer.texture?.filename || "",
                    cached: fallbackLayer.texture?.cached === true,
                }
                : null;
            const bitmap = islandBitmaps[0] || (slot.url || slot.layer_id ? slot : fallbackBitmap);

            if (!bitmap?.url && !bitmap?.layer_id) {
                return;
            }

            values.bitmap_maps[slotKey] = {
                ...slot,
                enabled: true,
                source_type: "single",
                layer_id: bitmap.layer_id || "",
                url: bitmap.url || "",
                name: bitmap.name || slot.name || "Unwrap Texture",
                filename: bitmap.filename || "",
                cached: bitmap.cached === true,
                node_id: slot.node_id || `bitmap-${slotKey}`,
                uv_node_id: "uv-map-layout",
                faces: {},
                mapped_faces: [],
                texture_groups: [],
                ...mergeTextureSettingsForSlot(slotKey, slot, bitmap),
                strength: slot.strength ?? 1,
                offset: slot.offset ?? 0,
                invert: slot.invert === true,
                blend: slot.blend || "replace",
            };

            return;
        }

        const faces = values.uv.faces || {};
        const groups = new Map();
        const mappedFaces = [];

        if ((values.uv.mode === "cubemap" || values.uv.view_mode === "cubemap") && hasUvCubemapNode.value) {
            const textureGroups = getMappedUvTextureGroups().map((group, index) => ({
                url: group.url || "",
                layer_id: group.layer_id || "",
                name: group.name || `CubeMap ${index + 1}`,
                filename: group.filename || "",
                cached: group.cached === true,
                ...mergeTextureSettingsForSlot(slotKey, slot, group.bitmap || group),
                slot: `texture_${index + 1}`,
                faces: group.faces || [],
            }));

            values.bitmap_maps[slotKey] = {
                ...slot,
                enabled: textureGroups.length > 0,
                source_type: textureGroups.length > 0 ? "multitexture" : "none",

                layer_id: "",
                url: "",
                name: textureGroups.length
                    ? `${slotKey} CubeMap MultiTexture`
                    : "",

                node_id: textureGroups.length > 0 ? "uv-cubemap-multitexture" : "",
                uv_node_id: textureGroups.length > 0 ? "uv-cubemap-layout" : "",

                faces,
                mapped_faces: textureGroups.flatMap(group => group.faces || []),
                texture_groups: textureGroups,

                ...mergeTextureSettingsForSlot(slotKey, slot),
                strength: slot.strength ?? 1,
                offset: slot.offset ?? 0,
                invert: slot.invert === true,
                blend: slot.blend || "replace",
            };

            return;
        }

        Object.entries(faces).forEach(([faceName, face]) => {
            const bitmap = face?.bitmap || {};
            const url = bitmap.url || "";
            const layerId = bitmap.layer_id || "";
            const key = url || layerId;

            if (!key) {
                return;
            }

            mappedFaces.push(faceName);

            if (!groups.has(key)) {
                groups.set(key, {
                    url,
                    layer_id: layerId,
                    name: bitmap.name || layerId || "Texture",
                    filename: bitmap.filename || "",
                    cached: bitmap.cached === true,
                    ...mergeTextureSettingsForSlot(slotKey, slot, bitmap),
                    faces: [],
                });
            }

            groups.get(key).faces.push(faceName);
        });

        const textureGroups = Array.from(groups.values());

        values.bitmap_maps[slotKey] = {
            ...slot,
            enabled: textureGroups.length > 0,
            source_type: textureGroups.length > 1 ? "multitexture" : textureGroups.length === 1 ? "single" : "none",

            layer_id: textureGroups.length === 1 ? textureGroups[0].layer_id : "",
            url: textureGroups.length === 1 ? textureGroups[0].url : "",
            name: textureGroups.length > 1
                ? `${slotKey} MultiTexture`
                : textureGroups[0]?.name || "",

            node_id: textureGroups.length > 1
                ? "uv-cubemap-multitexture"
                : textureGroups.length === 1
                    ? "uv-cubemap-single-bitmap"
                    : "",

            uv_node_id: textureGroups.length > 0 ? "uv-cubemap-layout" : "",

            faces,
            mapped_faces: mappedFaces,
            texture_groups: textureGroups,

            ...mergeTextureSettingsForSlot(slotKey, slot),
            strength: slot.strength ?? 1,
            offset: slot.offset ?? 0,
            invert: slot.invert === true,
            blend: slot.blend || "replace",
        };

    };

    const removeGeneratedUvShaderNodes = () => {
        rememberAllNodePositions();

        const generatedUvNodeIds = values.shader_graph.nodes
            .filter(node => node.generated === true && node.system === "uv-cubemap")
            .map(node => node.id);

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            !generatedUvNodeIds.includes(edge.from.node) &&
            !generatedUvNodeIds.includes(edge.to.node)
        ));

        values.shader_graph.nodes = values.shader_graph.nodes.filter(node => (
            !(node.generated === true && node.system === "uv-cubemap")
        ));
    };

    const getGeneratedUvNodeSnapshots = () => {
        return values.shader_graph.nodes
            .filter(node => node.generated === true && node.system === "uv-cubemap")
            .reduce((acc, node) => {
                acc[node.id] = cloneData(node);
                return acc;
            }, {});
    };

    const isGeneratedUvNodeId = nodeId => {
        const node = getGraphNode(nodeId);
        return node?.generated === true && node.system === "uv-cubemap";
    };

    const getGeneratedUvBridgeEdges = () => {
        return values.shader_graph.edges
            .filter(edge => {
                const fromGenerated = isGeneratedUvNodeId(edge.from.node);
                const toGenerated = isGeneratedUvNodeId(edge.to.node);

                if (fromGenerated === toGenerated) {
                    return false;
                }

                if (edge.to.node === "principled-bsdf") {
                    return false;
                }

                return fromGenerated || toGenerated;
            })
            .map(edge => cloneData(edge));
    };

    const restoreGeneratedUvBridgeEdges = bridgeEdges => {
        bridgeEdges.forEach(edge => {
            if (!getGraphNode(edge.from.node) || !getGraphNode(edge.to.node)) {
                return;
            }

            if (!canConnectSockets(edge.from, edge.to)) {
                return;
            }

            connectEdgeUnique(
                edge.from,
                edge.to,
                {
                    ...(edge.generated ? { generated: edge.generated } : {}),
                    ...(edge.system ? { system: edge.system } : {}),
                },
            );
        });
    };

    const isSocketOccupied = to => values.shader_graph.edges.some(edge => (
        edge.to.node === to.node &&
        edge.to.socket === to.socket
    ));

    const mergeGeneratedUvSettings = (snapshots, nodeId, baseSettings, forcedSettings = {}) => {
        const previousSettings = snapshots[nodeId]?.settings || {};
        const merged = {
            ...baseSettings,
            ...previousSettings,
            ...forcedSettings,
        };

        [
            "name",
            "bitmap",
            "interpolation",
            "projection",
            "extension",
            "offset_x",
            "offset_y",
            "scale_x",
            "scale_y",
            "rotate",
            "clamp",
            "channel",
            "color_mode",
            "strength",
            "offset",
            "invert",
            "blend",
        ].forEach(key => {
            if (previousSettings[key] !== undefined) {
                merged[key] = previousSettings[key];
            }
        });

        return merged;
    };

    const mergeGeneratedUvTextureGroups = (snapshots, nodeId, groups) => {
        const previousGroups = snapshots[nodeId]?.settings?.texture_groups || [];

        return groups.map(group => {
            const previous = previousGroups.find(item => (
                (item.slot && item.slot === group.slot) ||
                (item.url && item.url === group.url) ||
                (item.layer_id && item.layer_id === group.layer_id)
            )) || {};

            return {
                ...group,
                channel: previous.channel ?? group.channel,
                color_mode: previous.color_mode ?? group.color_mode,
                name: previous.name ?? group.name,
                strength: previous.strength ?? group.strength,
                offset: previous.offset ?? group.offset,
                invert: previous.invert ?? group.invert,
                blend: previous.blend ?? group.blend,
            };
        });
    };

    const getGeneratedUvChainEntryForSlot = slotKey => {
        const surfaceEdge = values.shader_graph.edges.find(edge => (
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        if (!surfaceEdge) {
            return null;
        }

        const directSource = getGraphNode(surfaceEdge.from.node);

        if (directSource?.generated === true && directSource.system === "uv-cubemap") {
            return null;
        }

        let currentNodeId = surfaceEdge.from.node;
        const seen = new Set();

        while (currentNodeId && !seen.has(currentNodeId)) {
            seen.add(currentNodeId);

            const incoming = values.shader_graph.edges.find(edge => (
                edge.to.node === currentNodeId
            ));

            if (!incoming) {
                return null;
            }

            const sourceNode = getGraphNode(incoming.from.node);

            if (sourceNode?.generated === true && sourceNode.system === "uv-cubemap") {
                return {
                    node: incoming.to.node,
                    socket: incoming.to.socket,
                };
            }

            currentNodeId = incoming.from.node;
        }

        return null;
    };

    const getUvMapTextureNodeIdForSlot = slotKey => {
        syncUvToBitmapSlot(slotKey);
        ensureBitmapNodeForSlot(slotKey);

        const nodeId = `bitmap-${slotKey}`;

        return getGraphNode(nodeId) ? nodeId : "";
    };

    const getCubemapTextureOutputNodeId = () => {
        if (getGraphNode("uv-cubemap-multitexture")) {
            return "uv-cubemap-multitexture";
        }

        if (getGraphNode("uv-cubemap-single-bitmap")) {
            return "uv-cubemap-single-bitmap";
        }

        return "";
    };

    const connectTextureOutputToSurfaceSlot = (sourceNodeId, slotKey, system = "uv-mode-active") => {
        if (!sourceNodeId || !values.bitmap_maps[slotKey]) {
            return;
        }

        const sourceNode = getGraphNode(sourceNodeId);
        const outputSocket = slotKey === "alpha" && sourceNode?.outputs?.alpha ? "alpha" : "color";

        if (!sourceNode?.outputs?.[outputSocket]) {
            return;
        }

        connectEdgeUnique(
            {
                node: sourceNodeId,
                socket: outputSocket,
            },
            {
                node: "principled-bsdf",
                socket: slotKey,
            },
            {
                generated: true,
                system,
            },
        );

        syncSurfaceSlotFromShaderGraph(slotKey);
    };

    const connectUvModeOutputToSurfaceSlots = mode => {
        const targetSlots = getUvTargetSlots();

        if (mode === "cubemap") {
            if (!hasUvCubemapNode.value) {
                return;
            }

            const sourceNodeId = getCubemapTextureOutputNodeId();

            targetSlots.forEach(slotKey => {
                connectTextureOutputToSurfaceSlot(sourceNodeId, slotKey, "uv-cubemap-active");
            });

            return;
        }

        if (!hasUvMapNode.value) {
            return;
        }

        targetSlots.forEach(slotKey => {
            const sourceNodeId = getUvMapTextureNodeIdForSlot(slotKey);
            connectTextureOutputToSurfaceSlot(sourceNodeId, slotKey, "uv-map-active");
        });
    };

    const syncUvCubeMapToShaderGraph = () => {
        ensureCoreNodes();

        const mappedFaces = getMappedUvFaces();
        const textureGroups = getMappedUvTextureGroups();
        const textureMode = getUvTextureMode();
        const targetSlots = getUvTargetSlots();
        const primarySlotKey = targetSlots[0] || "baseColor";
        const primarySlot = values.bitmap_maps[primarySlotKey] || {};
        const primaryTextureSettings = mergeTextureSettingsForSlot(primarySlotKey, primarySlot);

        rememberAllNodePositions();

        const preservedUvNodePositions = getGeneratedUvNodePositions();
        const generatedUvSnapshots = getGeneratedUvNodeSnapshots();
        const generatedUvBridgeEdges = getGeneratedUvBridgeEdges();

        const preservedSlotChainEntries = targetSlots.reduce((acc, slotKey) => {
            acc[slotKey] = getGeneratedUvChainEntryForSlot(slotKey);
            return acc;
        }, {});

        removeGeneratedUvShaderNodes();
        syncUvToActiveSlots();

        if (!mappedFaces.length || textureMode === "none") {
            return;
        }

        const existingCubemapNode = values.shader_graph.nodes.find(node => (
            node?.settings?.node_key === "uv.cubemap"
        ));
        const uvNodeId = existingCubemapNode?.id || "uv-cubemap-layout";

        const uvNode = {
            ...(existingCubemapNode || {}),
            id: uvNodeId,
            type: "UV",
            label: "UV-CubeMap",
            locked: false,
            generated: existingCubemapNode ? existingCubemapNode.generated === true : true,
            system: existingCubemapNode?.system || "uv-cubemap",
            position: getPreservedNodePosition(
                preservedUvNodePositions,
                uvNodeId,
                getNodePosition(
                    existingCubemapNode || getGraphNode(uvNodeId),
                    { x: 70, y: 430 }
                ),
            ),
            ...Node.getSockets("uv.cubemap"),
            settings: mergeGeneratedUvSettings(generatedUvSnapshots, uvNodeId, {
                node_key: "uv.cubemap",
                node_name: "UV-CubeMap",
                group: "UV",
            }, {
                node_key: "uv.cubemap",
                node_name: "UV-CubeMap",
                group: "UV",
                mode: values.uv.mode,
                view_mode: values.uv.view_mode,
                active_face: values.uv.active_face,
                selected_faces: cloneData(values.uv.selected_faces),
                atlas: values.uv.atlas,
                target_slot: primarySlotKey,
                target_slots: cloneData(targetSlots),
                texture_mode: textureMode,
                faces: cloneData(values.uv.faces),
                mapped_faces: cloneData(mappedFaces),
                texture_groups: cloneData(mergeGeneratedUvTextureGroups(
                    generatedUvSnapshots,
                    uvNodeId,
                    textureGroups.map(group => ({
                        url: group.url,
                        name: group.bitmap?.name || group.bitmap?.layer_id || "Texture",
                        layer_id: group.bitmap?.layer_id || "",
                        filename: group.bitmap?.filename || "",
                        cached: group.bitmap?.cached === true,
                        ...mergeTextureSettingsForSlot(primarySlotKey, primaryTextureSettings, group.bitmap),
                        faces: group.faces,
                    }))
                )),
            }),
        };

        if (existingCubemapNode) {
            values.shader_graph.nodes = values.shader_graph.nodes.map(node => (
                node.id === existingCubemapNode.id ? uvNode : node
            ));
        } else {
            values.shader_graph.nodes.push(uvNode);
        }

        const restoreGeneratedBridges = () => {
            restoreGeneratedUvBridgeEdges(generatedUvBridgeEdges);
        };

        const connectGeneratedOutputToSlots = sourceNodeId => {
            restoreGeneratedBridges();

            values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
                edge.to.node === "principled-bsdf" &&
                targetSlots.includes(edge.to.socket) &&
                getGraphNode(edge.from.node)?.generated === true &&
                getGraphNode(edge.from.node)?.system === "uv-cubemap"
            ));

            targetSlots.forEach(slotKey => {
                const chainEntry = preservedSlotChainEntries[slotKey];

                if (chainEntry && getGraphNode(chainEntry.node)) {
                    if (isSocketOccupied(chainEntry)) {
                        return;
                    }

                    connectEdgeUnique(
                        {
                            node: sourceNodeId,
                            socket: "color",
                        },
                        chainEntry,
                        {
                            generated: true,
                            system: "uv-cubemap",
                        },
                    );

                    return;
                }

                const to = {
                    node: "principled-bsdf",
                    socket: slotKey,
                };

                if (isSocketOccupied(to)) {
                    return;
                }

                connectEdgeUnique(
                    {
                        node: sourceNodeId,
                        socket: "color",
                    },
                    to,
                    {
                        generated: true,
                        system: "uv-cubemap",
                    },
                );
            });
        };

        if (textureMode === "single") {
            const group = textureGroups[0];
            const bitmap = group.bitmap || {};
            const bitmapNodeId = "uv-cubemap-single-bitmap";

            values.shader_graph.nodes.push({
                id: bitmapNodeId,
                type: "Texture",
                label: bitmap.name || "Bitmap/Image",
                locked: false,
                generated: true,
                system: "uv-cubemap",
                position: getPreservedNodePosition(
                    preservedUvNodePositions,
                    bitmapNodeId,
                    getNodePosition(
                        getGraphNode(bitmapNodeId),
                        { x: 350, y: 430 }
                    ),
                ),
                ...Node.getSockets("texture.bitmap"),
                settings: mergeGeneratedUvSettings(generatedUvSnapshots, bitmapNodeId, {
                    node_key: "texture.bitmap",
                    node_name: "Bitmap/Image",
                    group: "Texture",
                }, {
                    node_key: "texture.bitmap",
                    node_name: "Bitmap/Image",
                    group: "Texture",
                    mode: "single-texture-cubemap-uv",
                    slot: primarySlotKey,
                    target_slot: primarySlotKey,
                    target_slots: cloneData(targetSlots),
                    layer_id: bitmap.layer_id || "",
                    url: bitmap.url || "",
                    name: bitmap.name || "SingleTexture",
                    width: bitmap.width || 0,
                    height: bitmap.height || 0,
                    ...mergeTextureSettingsForSlot(primarySlotKey, primaryTextureSettings, bitmap),
                    faces: cloneData(values.uv.faces),
                    mapped_faces: cloneData(mappedFaces),
                    texture_faces: cloneData(group.faces),
                }),
            });

            connectEdgeUnique(
                {
                    node: uvNodeId,
                    socket: "uv",
                },
                {
                    node: bitmapNodeId,
                    socket: "uv",
                },
                {
                    generated: true,
                    system: "uv-cubemap",
                    replaceInput: false,
                },
            );

            connectGeneratedOutputToSlots(bitmapNodeId);
            reconcileShaderGraph();
            return;
        }

        const multiTextureNodeId = "uv-cubemap-multitexture";

        const multiTextureNode = {
            id: multiTextureNodeId,
            type: "Texture",
            label: "Multi Texture",
            locked: false,
            generated: true,
            system: "uv-cubemap",
            position: getPreservedNodePosition(
                preservedUvNodePositions,
                multiTextureNodeId,
                getNodePosition(
                    getGraphNode(multiTextureNodeId),
                    { x: 720, y: 430 }
                ),
            ),
            inputs: textureGroups.reduce((acc, group, index) => {
                acc[`texture_${index + 1}`] = { type: "color" };
                return acc;
            }, {}),
            outputs: {
                color: { type: "color" },
                alpha: { type: "float" },
            },
            settings: mergeGeneratedUvSettings(generatedUvSnapshots, multiTextureNodeId, {
                node_key: "texture.multitexture",
                node_name: "Multi Texture",
                group: "Texture",
            }, {
                node_key: "texture.multitexture",
                node_name: "Multi Texture",
                group: "Texture",
                mode: "cubemap-url-group-composite",
                slot: primarySlotKey,
                target_slot: primarySlotKey,
                target_slots: cloneData(targetSlots),
                ...primaryTextureSettings,
                atlas: values.uv.atlas,
                faces: cloneData(values.uv.faces),
                mapped_faces: cloneData(mappedFaces),
                texture_groups: cloneData(mergeGeneratedUvTextureGroups(
                    generatedUvSnapshots,
                    multiTextureNodeId,
                    textureGroups.map((group, index) => ({
                        slot: `texture_${index + 1}`,
                        url: group.url,
                        name: group.bitmap?.name || group.bitmap?.layer_id || `Texture ${index + 1}`,
                        layer_id: group.bitmap?.layer_id || "",
                        filename: group.bitmap?.filename || "",
                        cached: group.bitmap?.cached === true,
                        ...mergeTextureSettingsForSlot(primarySlotKey, primaryTextureSettings, group.bitmap),
                        faces: group.faces,
                    }))
                )),
            }),
        };

        textureGroups.forEach((group, index) => {
            const bitmap = group.bitmap || {};
            const bitmapNodeId = `uv-texture-group-bitmap-${index + 1}`;
            const inputSocket = `texture_${index + 1}`;

            values.shader_graph.nodes.push({
                id: bitmapNodeId,
                type: "Texture",
                label: bitmap.name || `Bitmap/Image ${index + 1}`,
                locked: false,
                generated: true,
                system: "uv-cubemap",
                position: getPreservedNodePosition(
                    preservedUvNodePositions,
                    bitmapNodeId,
                    getNodePosition(
                        getGraphNode(bitmapNodeId),
                        { x: 350, y: 350 + index * 92 }
                    ),
                ),
                ...Node.getSockets("texture.bitmap"),
                settings: mergeGeneratedUvSettings(generatedUvSnapshots, bitmapNodeId, {
                    node_key: "texture.bitmap",
                    node_name: "Bitmap/Image",
                    group: "Texture",
                }, {
                    node_key: "texture.bitmap",
                    node_name: "Bitmap/Image",
                    group: "Texture",
                    mode: "texture-group-cubemap-uv",
                    group_index: index,
                    target_slot: primarySlotKey,
                    target_slots: cloneData(targetSlots),
                    layer_id: bitmap.layer_id || "",
                    url: bitmap.url || "",
                    name: bitmap.name || `Texture Group ${index + 1}`,
                    width: bitmap.width || 0,
                    height: bitmap.height || 0,
                    ...mergeTextureSettingsForSlot(primarySlotKey, primaryTextureSettings, bitmap),
                    faces: cloneData(values.uv.faces),
                    mapped_faces: cloneData(group.faces),
                }),
            });

            connectEdgeUnique(
                {
                    node: uvNodeId,
                    socket: "uv",
                },
                {
                    node: bitmapNodeId,
                    socket: "uv",
                },
                {
                    generated: true,
                    system: "uv-cubemap",
                    replaceInput: false,
                },
            );

            connectEdgeUnique(
                {
                    node: bitmapNodeId,
                    socket: "color",
                },
                {
                    node: multiTextureNodeId,
                    socket: inputSocket,
                },
                {
                    generated: true,
                    system: "uv-cubemap",
                    replaceInput: false,
                },
            );
        });

        values.shader_graph.nodes.push(multiTextureNode);
        connectGeneratedOutputToSlots(multiTextureNodeId);
        reconcileShaderGraph();
        applyRememberedNodePositions();
    };

    const selectUvLayer = async layer => {
        await assignLayerToSelectedUvFaces(layer);
    };

    const setUvEditorMode = async mode => {
        setUvBoxSelectState(false);
        if (!["unwrap", "cubemap"].includes(mode)) {
            return;
        }

        if (mode === "unwrap" && !hasUvMapNode.value) {
            return;
        }

        if (mode === "cubemap" && !hasUvCubemapNode.value) {
            return;
        }

        values.uv.mode = mode;
        values.uv.view_mode = mode;

        if (mode === "unwrap") {
            rebuildMaterialMesh({ preserveLayout: values.uv.vertices.length > 0 });
            connectUvModeOutputToSurfaceSlots("unwrap");
        }

        if (mode === "cubemap") {
            ensureCubemapFaceTexturesFromLayers();
            syncUvCubeMapToShaderGraph();
            connectUvModeOutputToSurfaceSlots("cubemap");
        }

        reconcileShaderGraph();
        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const selectUvIsland = async (islandId, event = null) => {
        const additive = event?.shiftKey || event?.ctrlKey || event?.metaKey;
        values.uv = UV.selectIsland(values.uv, islandId, { additive });
        await drawUvCanvas();
    };

    const syncUnwrapReferenceMap = async () => {
        await drawUvCanvas();
        syncUvToBitmapSlot("baseColor");
        requestPreviewDebounced();
    };

    const isLayerAssignedToSelectedUvFaces = layerId => {
        return selectedUvFaces.value.some(face => (
            values.uv.faces[face]?.bitmap?.layer_id === layerId
        ));
    };

    const setActiveUvFace = async face => {
        if (!values.uv.faces[face]) {
            return;
        }

        values.uv.active_face = face;
        values.uv.selected_faces = [face];

        await drawUvCanvas();
    };

    const isUvFaceSelected = face => {
        return selectedUvFaces.value.includes(face);
    };

    const applyUvMoveAxisLock = delta => {
        if (uvMoveAxis.value === "x") {
            return {
                x: delta.x,
                y: 0,
            };
        }

        if (uvMoveAxis.value === "y") {
            return {
                x: 0,
                y: delta.y,
            };
        }

        return delta;
    };

    const setUvMoveAxis = axis => {
        uvMoveAxis.value = uvMoveAxis.value === axis ? "" : axis;
    };

    const clearUvMoveAxis = () => {
        uvMoveAxis.value = "";
    };

    const toggleUvFaceSelection = async (face, event = null) => {
        if (!values.uv.faces[face]) {
            return;
        }

        values.uv.active_face = face;

        const multi = event?.shiftKey || event?.metaKey || event?.ctrlKey;

        if (!multi) {
            values.uv.selected_faces = [face];
            await drawUvCanvas();
            return;
        }

        const set = new Set(selectedUvFaces.value);

        if (set.has(face) && set.size > 1) {
            set.delete(face);
        } else {
            set.add(face);
        }

        values.uv.selected_faces = Array.from(set);
        await drawUvCanvas();
    };

    const selectAllUvFaces = async () => {
        values.uv.selected_faces = ["front", "back", "left", "right", "top", "bottom"];
        values.uv.mode = "cubemap";
        values.uv.view_mode = "cubemap";
        await drawUvCanvas();
    };

    const unwrapAllUvIslands = async () => {
        if (values.uv.view_mode !== "unwrap") {
            values.uv.mode = "unwrap";
            values.uv.view_mode = "unwrap";
        }

        values.uv.vertices = [];
        values.uv.edges = [];
        values.uv.triangles = [];
        values.uv.islands = [];
        values.uv.selected_vertex_ids = [];
        values.uv.selected_edge_ids = [];
        values.uv.selected_island_ids = [];
        values.uv.active_island_id = "";

        rebuildMaterialMesh({
            preserveLayout: false,
        });

        values.uv.active_island_id = values.uv.islands[0]?.id || "";
        values.uv.selected_island_ids = values.uv.active_island_id
            ? [values.uv.active_island_id]
            : [];

        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const resetSelectedUvFaces = async () => {
        if (values.uv.view_mode === "unwrap") {
            await unwrapAllUvIslands();
            return;
        }

        selectedUvFaces.value.forEach(face => {
            values.uv.faces[face] = getDefaultCubeFaceUv(face);
        });

        syncUvCubeMapToShaderGraph();

        await drawUvCanvas();
        requestPreviewDebounced();
    }

    const syncUvAndPreview = async () => {
        if (values.uv.view_mode === "unwrap") {
            applyUvLayoutToMesh({ source: "uv-sync" });
            syncUvToActiveSlots();
        } else {
            syncUvCubeMapToShaderGraph();
        }
        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const loadImageFromUrl = url => {
        return new Promise(resolve => {
            if (!url) {
                resolve(null);
                return;
            }

            if (uvImageCache.has(url)) {
                resolve(uvImageCache.get(url));
                return;
            }

            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => {
                uvImageCache.set(url, image);
                resolve(image);
            };
            image.onerror = () => resolve(null);
            image.src = url;
        });
    };

    const getUvFacesToDraw = () => {
        if (values.uv.view_mode === "face") {
            return [values.uv.active_face];
        }

        return ["top", "left", "front", "right", "back", "bottom"];
    };

    const getFaceRect = (face, gridX, gridY, gridW, gridH) => {
        const data = values.uv.faces[face];

        if (values.uv.view_mode === "cubemap") {
            const cell = Math.min(gridW / 4, gridH / 3);
            const atlasW = cell * 4;
            const atlasH = cell * 3;
            const atlasX = gridX + (gridW - atlasW) * 0.5;
            const atlasY = gridY + (gridH - atlasH) * 0.5;

            return {
                x: atlasX + Math.round(Number(data.x || 0) * 4) * cell,
                y: atlasY + Math.round(Number(data.y || 0) * 3) * cell,
                w: cell,
                h: cell,
            };
        }

        return {
            x: gridX + data.x * gridW,
            y: gridY + data.y * gridH,
            w: data.width * gridW,
            h: data.height * gridH,
        };
    };

    const getUvCanvasPoint = event => {
        const rect = uvCanvasRef.value?.getBoundingClientRect();

        if (!rect) {
            return { x: 0, y: 0 };
        }

        return {
            x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 720,
            y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 720,
        };
    };

    const getUvPointFromEvent = event => {
        const point = getUvCanvasPoint(event);
        const padding = 42;
        const size = 720 - padding * 2;

        return {
            x: clamp((point.x - padding) / size, -1, 2),
            y: clamp((point.y - padding) / size, -1, 2),
        };
    };

    const getUnwrapBitmapUrl = island => {
        return (
            island?.bitmap?.url ||
            island?.bitmaps?.baseColor?.url ||
            values.uv.faces?.[island?.faceName]?.bitmap?.url ||
            values.bitmap_maps.baseColor?.url ||
            sourceLayerTextureUrl.value ||
            ""
        );
    };

    const getUnwrapReferenceTransform = island => ({
        translateX: Number(island?.bitmap_translate_x || 0),
        translateY: Number(island?.bitmap_translate_y || 0),
        scaleX: Number(island?.bitmap_scale_x ?? 1) || 1,
        scaleY: Number(island?.bitmap_scale_y ?? 1) || 1,
        rotate: Number(island?.bitmap_rotate || 0),
    });

    const drawUnwrapCanvas = async ({ ctx, height, gridX, gridY, gridW, gridH }) => {
        const referenceIsland = activeUvIsland.value || values.uv.islands?.[0];
        const backgroundUrl = getUnwrapBitmapUrl(referenceIsland);
        const background = await loadImageFromUrl(backgroundUrl);

        if (background) {
            const transform = getUnwrapReferenceTransform(referenceIsland);
            const centerX = gridX + gridW * 0.5 + transform.translateX * gridW;
            const centerY = gridY + gridH * 0.5 + transform.translateY * gridH;

            ctx.save();
            ctx.beginPath();
            ctx.rect(gridX, gridY, gridW, gridH);
            ctx.clip();
            ctx.globalAlpha = 0.32;
            ctx.translate(centerX, centerY);
            ctx.rotate((transform.rotate * Math.PI) / 180);
            ctx.scale(transform.scaleX, transform.scaleY);
            ctx.drawImage(background, -gridW / 2, -gridH / 2, gridW, gridH);
            ctx.restore();
        }

        const vertexById = new Map((values.uv.vertices || []).map(vertex => [vertex.id, vertex]));
        const selectedVertices = new Set(values.uv.selected_vertex_ids || []);
        const selectedIslands = new Set(values.uv.selected_island_ids || []);

        const toCanvas = vertex => ({
            x: gridX + vertex.x * gridW,
            y: gridY + vertex.y * gridH,
        });

        (values.uv.triangles || []).forEach(triangle => {
            const points = (triangle.vertex_ids || [])
                .map(id => vertexById.get(id))
                .filter(Boolean)
                .map(toCanvas);

            if (points.length !== 3) {
                return;
            }

            const isSelected = selectedIslands.has(triangle.island_id);

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.lineTo(points[2].x, points[2].y);
            ctx.closePath();
            ctx.fillStyle = isSelected
                ? "rgba(97,230,255,0.18)"
                : "rgba(112,223,180,0.055)";
            ctx.fill();
            ctx.strokeStyle = isSelected
                ? "rgba(97,230,255,0.7)"
                : "rgba(255,255,255,0.18)";
            ctx.lineWidth = isSelected ? 1.4 : 0.8;
            ctx.stroke();
        });

        (values.uv.edges || []).forEach(edge => {
            const from = vertexById.get(edge.from);
            const to = vertexById.get(edge.to);

            if (!from || !to) {
                return;
            }

            const a = toCanvas(from);
            const b = toCanvas(to);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = edge.seam
                ? "rgba(255,190,120,0.92)"
                : "rgba(112,223,180,0.55)";
            ctx.lineWidth = edge.seam ? 2 : 1;
            ctx.stroke();
        });

        (values.uv.vertices || []).forEach(vertex => {
            const point = toCanvas(vertex);
            const selected = selectedVertices.has(vertex.id);

            ctx.beginPath();
            ctx.arc(point.x, point.y, selected ? 4.8 : 3.2, 0, Math.PI * 2);
            ctx.fillStyle = selected
                ? "rgba(97,230,255,0.98)"
                : "rgba(255,255,255,0.86)";
            ctx.fill();
            ctx.strokeStyle = "rgba(10,12,18,0.9)";
            ctx.lineWidth = 1.2;
            ctx.stroke();
        });

        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.fillText(
            `UV Unwrap - islands:${values.uv.islands.length} vertices:${values.uv.vertices.length}`,
            gridX,
            height - 10,
        );
    };

    const drawUvCanvas = async () => {
        const canvas = uvCanvasRef.value;

        if (!canvas) {
            return;
        }

        const size = 720;
        const width = size;
        const height = size;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "rgba(10, 12, 18, 0.98)";
        ctx.fillRect(0, 0, width, height);

        const padding = 42;
        const gridSize = width - padding * 2;
        const gridX = padding;
        const gridY = padding;
        const gridW = gridSize;
        const gridH = gridSize;

        ctx.save();

        /**
         * BACKGROUND GRID
         */
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1;

        for (let index = 0; index <= 20; index += 1) {
            const x = gridX + (gridW / 20) * index;

            ctx.beginPath();
            ctx.moveTo(x, gridY);
            ctx.lineTo(x, gridY + gridH);
            ctx.stroke();
        }

        for (let index = 0; index <= 20; index += 1) {
            const y = gridY + (gridH / 20) * index;

            ctx.beginPath();
            ctx.moveTo(gridX, y);
            ctx.lineTo(gridX + gridW, y);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(112,223,180,0.35)";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(gridX, gridY, gridW, gridH);

        if (values.uv.view_mode === "unwrap") {
            await drawUnwrapCanvas({ ctx, width, height, gridX, gridY, gridW, gridH });
            ctx.restore();
            return;
        }

        /**
         * DRAW MODE:
         * - cubemap = all cube faces in the atlas
         * - face = only active face fullscreen in grid
         */
        const facesToDraw = getUvFacesToDraw();

        for (const faceName of facesToDraw) {
            const face = values.uv.faces[faceName];

            if (!face) {
                continue;
            }

            const rect = values.uv.view_mode === "face"
                ? {
                    x: gridX,
                    y: gridY,
                    w: gridW,
                    h: gridH,
                }
                : getFaceRect(faceName, gridX, gridY, gridW, gridH);

            const image = await loadImageFromUrl(face.bitmap?.url);

            /**
             * FACE SECTOR BACKGROUND
             */
            ctx.save();

            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.w, rect.h);
            ctx.clip();

            ctx.fillStyle = "rgba(255,255,255,0.035)";
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

            /**
             * FACE BITMAP
             * Each face owns its own bitmap.
             */
            if (image) {
                const centerX = rect.x + rect.w / 2 + face.translate_x * rect.w;
                const centerY = rect.y + rect.h / 2 + face.translate_y * rect.h;

                ctx.translate(centerX, centerY);
                ctx.rotate((face.rotate * Math.PI) / 180);
                ctx.scale(
                    (face.flip_x ? -1 : 1) * face.scale_x,
                    (face.flip_y ? -1 : 1) * face.scale_y,
                );

                ctx.drawImage(
                    image,
                    -rect.w / 2,
                    -rect.h / 2,
                    rect.w,
                    rect.h,
                );
            } else {
                ctx.fillStyle = "rgba(112,223,180,0.055)";
                ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

                ctx.fillStyle = "rgba(255,255,255,0.34)";
                ctx.font = "700 11px Inter, system-ui, sans-serif";
                ctx.fillText("NO BITMAP", rect.x + 8, rect.y + rect.h - 10);
            }

            ctx.restore();

            /**
             * FACE BORDER + LABEL
             */
            const isActive = values.uv.active_face === faceName;
            const isSelected = selectedUvFaces.value.includes(faceName);
            const hasBitmap = Boolean(face.bitmap?.url);

            ctx.save();

            ctx.lineWidth = isActive ? 3 : isSelected ? 2 : 1.2;
            ctx.strokeStyle = isActive
                ? "rgba(97,230,255,0.96)"
                : isSelected
                    ? "rgba(112,223,180,0.88)"
                    : hasBitmap
                        ? "rgba(112,223,180,0.42)"
                        : "rgba(255,255,255,0.22)";

            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

            if (isSelected) {
                ctx.fillStyle = isActive
                    ? "rgba(97,230,255,0.18)"
                    : "rgba(112,223,180,0.12)";

                ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            }

            ctx.fillStyle = isActive
                ? "rgba(97,230,255,0.98)"
                : isSelected
                    ? "rgba(112,223,180,0.92)"
                    : "rgba(255,255,255,0.62)";

            ctx.font = "800 12px Inter, system-ui, sans-serif";
            ctx.fillText(faceName.toUpperCase(), rect.x + 8, rect.y + 18);

            if (face.bitmap?.name) {
                ctx.fillStyle = "rgba(255,255,255,0.72)";
                ctx.font = "600 10px Inter, system-ui, sans-serif";

                const label = String(face.bitmap.name).slice(0, 24);
                ctx.fillText(label, rect.x + 8, rect.y + rect.h - 10);
            }

            ctx.restore();
        }

        /**
         * CUBEMAP ATLAS GUIDE
         */
        if (values.uv.view_mode === "cubemap") {
            ctx.save();

            ctx.strokeStyle = "rgba(255,255,255,0.16)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 5]);

            Object.keys(values.uv.faces).forEach(faceName => {
                const rect = getFaceRect(faceName, gridX, gridY, gridW, gridH);

                ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
            });

            ctx.restore();
        }

        /**
         * FOOTER INFO
         */
        const activeFace = activeUvFace.value;

        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.font = "11px Inter, system-ui, sans-serif";

        ctx.fillText(
            `UV ${values.uv.view_mode === "cubemap" ? "CubeMap" : values.uv.active_face}`,
            gridX,
            height - 10,
        );

        ctx.fillText(
            `selected:${selectedUvFaces.value.join(", ")}`,
            gridX + 120,
            height - 10,
        );

        if (activeFace) {
            ctx.fillText(
                `x:${activeFace.x.toFixed(3)} y:${activeFace.y.toFixed(3)} w:${activeFace.width.toFixed(3)} h:${activeFace.height.toFixed(3)}`,
                gridX + 300,
                height - 10,
            );

            ctx.fillText(
                `tx:${activeFace.translate_x.toFixed(3)} ty:${activeFace.translate_y.toFixed(3)} sx:${activeFace.scale_x.toFixed(3)} sy:${activeFace.scale_y.toFixed(3)} rot:${activeFace.rotate.toFixed(1)}°`,
                gridX + 520,
                height - 10,
            );
        }

        ctx.restore();
    };

    const getDefaultCubeFaceUv = face => {
        const defaults = {
            top: [0.25, 0],
            left: [0, 1 / 3],
            front: [0.25, 1 / 3],
            right: [0.5, 1 / 3],
            back: [0.75, 1 / 3],
            bottom: [0.25, 2 / 3],
        };

        const [x, y] = defaults[face] || [0.25, 1 / 3];

        return UV.createCubeFace(face, x, y);
    };

    const resetActiveUvFace = () => {
        const face = values.uv.active_face;

        values.uv.faces[face] = getDefaultCubeFaceUv(face);

        requestPreviewDebounced();
    };

    const resetUvViewport = () => {
        uvViewport.zoom = 1;
        uvViewport.panX = 0;
        uvViewport.panY = 0;
    };

    const startUvPan = event => {
        if (uvBoxSelectState.value) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            return;
        }
        if (event.button !== 0) {
            return;
        }

        uvViewport.isPanning = true;
        uvHoverState.value = "pan";
        uvViewport.panStart = {
            x: event.clientX,
            y: event.clientY,
        };

        uvViewport.origin = {
            x: uvViewport.panX,
            y: uvViewport.panY,
        };

        window.addEventListener("pointermove", moveUvPan);
        window.addEventListener("pointerup", stopUvPan);
    };

    const moveUvPan = event => {
        if (!uvViewport.isPanning) {
            return;
        }

        uvViewport.panX = uvViewport.origin.x + event.clientX - uvViewport.panStart.x;
        uvViewport.panY = uvViewport.origin.y + event.clientY - uvViewport.panStart.y;
    };

    const stopUvPan = () => {
        uvViewport.isPanning = false;
        uvHoverState.value = "empty";

        window.removeEventListener("pointermove", moveUvPan);
        window.removeEventListener("pointerup", stopUvPan);
    };

    const handleUvWheel = event => {
        const oldZoom = uvViewport.zoom;
        uvViewport.zoom = clamp(oldZoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.35, 4);
    };

    const setUvHoverStateFromEvent = event => {
        if (
            uvBoxSelectState.value ||
            values.uv.view_mode !== "unwrap" ||
            uvDragState.active ||
            uvViewport.isPanning
        ) {
            return;
        }

        if (!values.uv.vertices.length || !values.uv.triangles.length) {
            uvHoverState.value = "empty";
            return;
        }

        const point = getUvPointFromEvent(event);
        const vertex = UV.pickVertex(values.uv, point, 0.018 / uvViewport.zoom);

        if (vertex) {
            uvHoverState.value = "vertex";
            return;
        }

        const island = UV.pickIsland(values.uv, point);

        uvHoverState.value = island ? "island" : "empty";
    };

    const clearUvHoverState = () => {
        uvHoverState.value = "empty";
    };

    const uvCursorClass = computed(() => ({
        "box-select-active": uvBoxSelectState.value,
        "is-panning": uvViewport.isPanning,
        "is-dragging-uv": uvDragState.active,
        "hover-vertex": uvHoverState.value === "vertex",
        "hover-island": uvHoverState.value === "island",
        "hover-empty": uvHoverState.value === "empty",
    }));

    const startUvCanvasPointer = async event => {
        if (uvBoxSelectState.value) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            return;
        }
        if (values.uv.view_mode !== "unwrap" || event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!values.uv.vertices.length || !values.uv.triangles.length) {
            rebuildMaterialMesh({ preserveLayout: false });
        }

        const point = getUvPointFromEvent(event);
        const vertex = UV.pickVertex(values.uv, point, 0.018 / uvViewport.zoom);
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;
        pauseAutoSync.value = true;

        if (vertex) {
            values.uv = UV.selectVertex(values.uv, vertex.id, { additive });
            uvDragState.mode = "vertex";
            uvHoverState.value = "vertex";
        } else {
            const island = UV.pickIsland(values.uv, point);

            if (island) {
                values.uv = UV.selectIsland(values.uv, island.id, { additive });
                uvDragState.mode = "island";
                uvHoverState.value = "island";
            } else {
                values.uv = UV.clearSelection(values.uv);
                uvDragState.mode = "";

                queueMicrotask(() => {
                    pauseAutoSync.value = false;
                });

                await drawUvCanvas();

                startUvPan(event);
                return;
            }
        }

        uvDragState.active = true;
        uvDragState.last = point;

        window.addEventListener("pointermove", moveUvCanvasPointer);
        window.addEventListener("pointerup", stopUvCanvasPointer);

        await drawUvCanvas();
    };

    const moveUvCanvasPointer = async event => {
        if (!uvDragState.active || values.uv.view_mode !== "unwrap") {
            return;
        }

        uvHoverState.value = uvDragState.mode || "vertex";

        const point = getUvPointFromEvent(event);

        const rawDelta = {
            x: point.x - uvDragState.last.x,
            y: point.y - uvDragState.last.y,
        };

        uvDragState.last = point;

        const delta = applyUvMoveAxisLock(rawDelta);

        if (Math.abs(delta.x) < 0.000001 && Math.abs(delta.y) < 0.000001) {
            return;
        }

        values.uv = UV.moveSelection(values.uv, delta.x, delta.y);

        applyUvLayoutToMesh({
            source: uvMoveAxis.value
                ? `uv-drag-align-${uvMoveAxis.value}`
                : "uv-drag",
        });

        await drawUvCanvas();
    };

    const stopUvCanvasPointer = () => {
        if (!uvDragState.active) {
            return;
        }

        uvDragState.active = false;
        uvDragState.mode = "";
        uvHoverState.value = "empty";

        window.removeEventListener("pointermove", moveUvCanvasPointer);
        window.removeEventListener("pointerup", stopUvCanvasPointer);

        queueMicrotask(() => {
            pauseAutoSync.value = false;
            syncUvAndPreview();
        });
    };

    const requestPreviewNow = () => {
        if (!selectedSourceLayer.value?.id) {
            return;
        }

        previewRequestId.value += 1;

        emitEvent("material:preview", {
            layer: selectedSourceLayer.value,
            values: prepareMaterialValues({ preview: true }),
            requestId: previewRequestId.value,
        });
    };

    const setPreviewSetting = (key, value) => {
        values[key] = value === true;
        requestPreviewDebounced();
    };

    const particleEmitterMode = computed(() => {
        const system = values.particle_system || {};

        if (system.source === "volume" || (system.emitter === "volume" && values.geometry?.volume?.enabled === true)) {
            return "volume";
        }

        if (system.use_mesh_reference === true || system.source === "mesh") {
            return "mesh";
        }

        return "off";
    });

    const particleEmitterModeLabel = computed(() => {
        if (particleEmitterMode.value === "mesh") {
            return "Mesh";
        }

        if (particleEmitterMode.value === "volume") {
            return "Volumen";
        }

        return "Aus";
    });

    const hasFluidParticleReference = computed(() => (
        values.particle_system?.enabled === true ||
        values.geometry?.volume?.particle_bind !== false ||
        values.geometry?.fluid?.particle_collision !== false
    ));

    const isVolumeOrFluidPreview = computed(() => (
        values.geometry?.volume?.enabled === true ||
        values.geometry?.fluid?.enabled === true ||
        values.mesh?.volume?.enabled === true ||
        values.mesh?.fluid?.enabled === true
    ));

    const isFluidVolumePreview = computed(() => (
        values.geometry?.volume?.enabled === true &&
        values.geometry?.fluid?.enabled === true &&
        hasFluidParticleReference.value
    ));

    const cycleParticleEmitterMode = () => {
        const current = particleEmitterMode.value;
        const nextMode = current === "off"
            ? "mesh"
            : current === "mesh"
                ? "volume"
                : "off";
        const next = {
            ...(values.particle_system || createParticles()),
        };

        if (nextMode === "mesh") {
            next.mode = "mesh";
            next.use_mesh_reference = true;
            next.source = "mesh";
            next.emitter = "surface";
        } else if (nextMode === "volume") {
            next.mode = "mesh";
            next.use_mesh_reference = true;
            next.source = "volume";
            next.emitter = "volume";
        } else {
            next.mode = "texture";
            next.use_mesh_reference = false;
            next.source = "texture";
            next.emitter = "volume";
        }

        values.particle_system = ParticleSystem.update(next, { age: 0 }, {
            mesh: values.mesh,
            volume: values.mesh?.volume || values.geometry?.volume,
            fluid: values.mesh?.fluid || values.geometry?.fluid,
            physics: values.physics,
        });
        requestPreviewDebounced();
    };

    const setParticleSystemBoolean = (key, value) => {
        const next = {
            ...(values.particle_system || createParticles()),
        };

        if (key === "path_follow") {
            next.path_follow = {
                ...(next.path_follow || {}),
                enabled: value === true,
            };
        } else {
            next[key] = value === true;
        }

        values.particle_system = ParticleSystem.update(next, { age: 0 }, {
            mesh: values.mesh,
            volume: values.mesh?.volume || values.geometry?.volume,
            fluid: values.mesh?.fluid || values.geometry?.fluid,
            physics: values.physics,
        });
        requestPreviewDebounced();
    };

    const setActiveMaterialTab = key => {
        if (key !== "uv") {
            setUvBoxSelectState(false);
        }
        const previousTab = ui.value.activeTab;
        ui.value.activeTab = key;

        if (key === "particleSystem" && values.particle_system?.enabled !== true) {
            setParticleSystemBoolean("enabled", true);
        } else if (
            previousTab === "particleSystem" &&
            key !== "particleSystem" &&
            values.particle_system?.enabled === true &&
            !isFluidVolumePreview.value
        ) {
            setParticleSystemBoolean("enabled", false);
        }
    };

    const removeGeneratedVolumeFluidNodes = () => {
        const generatedIds = values.shader_graph.nodes
            .filter(node => node.generated === true && ["geometry-volume", "geometry-fluid"].includes(node.system))
            .map(node => node.id);

        if (!generatedIds.length) {
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            !generatedIds.includes(edge.from.node) &&
            !generatedIds.includes(edge.to.node)
        ));
        values.shader_graph.nodes = values.shader_graph.nodes.filter(node => !generatedIds.includes(node.id));
    };

    const removeGeneratedFluidNodes = () => {
        const generatedIds = values.shader_graph.nodes
            .filter(node => node.generated === true && node.system === "geometry-fluid")
            .map(node => node.id);

        if (!generatedIds.length) {
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            !generatedIds.includes(edge.from.node) &&
            !generatedIds.includes(edge.to.node)
        ));
        values.shader_graph.nodes = values.shader_graph.nodes.filter(node => !generatedIds.includes(node.id));
    };

    const ensureGeneratedShaderNode = (nodeKey, id, position, settings = {}, system = "") => {
        let node = getGraphNode(id);

        if (node) {
            node.settings = {
                ...Node.normalizeSettings(node),
                ...settings,
                node_key: nodeKey,
            };
            return node;
        }

        node = Node.create(nodeKey, position, {
            id,
            generated: true,
            system,
            settings,
        });

        if (node) {
            values.shader_graph.nodes.push(node);
        }

        return node;
    };

    const syncGeometryVolumeShaderGraph = () => {
        const outputNode = getGraphNode("material-output");
        const principledNode = getGraphNode("principled-bsdf");

        if (!outputNode || !principledNode) {
            return;
        }

        const volume = Volume.create(values.geometry.volume || {});
        const fluid = Fluid.create(values.geometry.fluid || {});
        const enabled = volume.enabled === true && volume.shader_bind !== false;

        if (!enabled) {
            removeGeneratedVolumeFluidNodes();
            return;
        }

        const volumeNode = ensureGeneratedShaderNode(
            "shader.volume",
            "geometry-volume-node",
            { x: 80, y: 520 },
            Volume.shaderNodeSettings(volume),
            "geometry-volume",
        );

        if (!volumeNode) {
            return;
        }

        if (!fluid.enabled) {
            removeGeneratedFluidNodes();
        }

        const targetNode = fluid.enabled
            ? ensureGeneratedShaderNode(
                "shader.fluid",
                "geometry-fluid-node",
                { x: 310, y: 520 },
                Fluid.shaderNodeSettings(fluid),
                "geometry-fluid",
            )
            : volumeNode;

        if (!targetNode) {
            return;
        }

        if (fluid.enabled) {
            connectEdgeUnique(
                { node: volumeNode.id, socket: "volume" },
                { node: targetNode.id, socket: "volume" },
                {
                    generated: true,
                    system: "geometry-fluid",
                    replaceInput: true,
                },
            );
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
            edge.generated === true &&
            ["geometry-volume", "geometry-fluid"].includes(edge.system) &&
            edge.to.node === outputNode.id &&
            ["surface", "volume"].includes(edge.to.socket)
        ));

        connectEdgeUnique(
            { node: targetNode.id, socket: "volume" },
            { node: outputNode.id, socket: "volume" },
            {
                generated: true,
                system: fluid.enabled ? "geometry-fluid" : "geometry-volume",
                replaceInput: true,
            },
        );
    };

    const syncParticleSystemGeometryVolumeBinding = () => {
        const volume = Volume.create(values.geometry.volume || {});
        const fluid = Fluid.create(values.geometry.fluid || {});
        const particleBindingActive = volume.particle_bind !== false || (fluid.enabled && fluid.particle_collision !== false);

        if (volume.enabled && particleBindingActive) {
            values.particle_system = ParticleSystem.update(
                {
                    ...(values.particle_system || createParticles()),
                    enabled: true,
                    mode: "mesh",
                    source: "volume",
                    emitter: fluid.enabled ? "volume" : volume.sample === "surface" ? "surface" : "volume",
                    use_mesh_reference: true,
                    mesh_influence: fluid.enabled ? fluid.particle_coupling : values.particle_system?.mesh_influence,
                    turbulence: fluid.enabled ? Math.max(values.particle_system?.turbulence || 0, fluid.turbulence) : values.particle_system?.turbulence,
                    gravity: values.particle_system?.gravity,
                    meta: {
                        ...(values.particle_system?.meta || {}),
                        volume_binding: "geometry-volume",
                        fluid_binding: fluid.enabled ? fluid.type : "none",
                    },
                },
                { age: 0 },
                {
                    mesh: values.mesh,
                    volume: values.mesh?.volume || volume,
                    fluid: values.mesh?.fluid || fluid,
                    physics: values.physics,
                },
            );
        } else if (values.particle_system?.meta?.volume_binding) {
            values.particle_system = ParticleSystem.update(
                {
                    ...values.particle_system,
                    mode: values.particle_system?.source === "volume" ? "texture" : values.particle_system?.mode,
                    source: values.particle_system?.source === "volume" ? "texture" : values.particle_system?.source,
                    use_mesh_reference: values.particle_system?.source === "volume" ? false : values.particle_system?.use_mesh_reference,
                    meta: {
                        ...(values.particle_system.meta || {}),
                        volume_binding: "none",
                        fluid_binding: "none",
                    },
                },
                {},
                {
                    mesh: values.mesh,
                    volume: values.mesh?.volume || volume,
                    fluid: values.mesh?.fluid || fluid,
                    physics: values.physics,
                },
            );
        }
    };

    const handleGeometryChange = () => {
        rebuildMaterialMesh({ preserveLayout: false });
        syncGeometryVolumeShaderGraph();
        syncParticleSystemGeometryVolumeBinding();
        values.particle_system = ParticleSystem.update(values.particle_system, {}, {
            mesh: values.mesh,
            volume: values.mesh?.volume || values.geometry?.volume,
            fluid: values.mesh?.fluid || values.geometry?.fluid,
            physics: values.physics,
        });
        requestPreviewDebounced();

        if (ui.value.activeTab === "uv") {
            drawUvCanvas();
        }
    };

    const handleParticleSystemChange = particleSystem => {
        values.particle_system = ParticleSystem.fromPlain(particleSystem, {
            mesh: values.mesh,
            volume: values.mesh?.volume || values.geometry?.volume,
            fluid: values.mesh?.fluid || values.geometry?.fluid,
            physics: values.physics,
        });
        requestPreviewDebounced();
    };

    const handlePhysicsChange = () => {
        if (values.mesh) {
            values.mesh.physics = clone(values.physics || {}, 'json');
        }

        if (values.particle_system?.enabled === true) {
            values.particle_system = ParticleSystem.update(values.particle_system, { age: 0 }, {
                mesh: values.mesh,
                volume: values.mesh?.volume || values.geometry?.volume,
                fluid: values.mesh?.fluid || values.geometry?.fluid,
                physics: values.physics,
            });
        }

        requestPreviewDebounced();
    };

    const ensureDefaultUvMapNode = () => {
        let node = values.shader_graph.nodes.find(item => item.settings?.node_key === "uv.map");

        if (node) {
            return node;
        }

        node = Node.create("uv.map", { x: 70, y: 260 }, {
            id: "uv-map-layout",
            generated: true,
            system: "uv-map",
            settings: {
                uv_map: "Unwrap",
                mode: "unwrap",
            },
        });

        if (!node) {
            return null;
        }

        values.shader_graph.nodes.push(node);
        return node;
    };

    const requestPreviewDebounced = () => {
        if (previewTimer.value) {
            clearTimeout(previewTimer.value);
        }

        previewTimer.value = setTimeout(() => {
            requestPreviewNow();
        }, PREVIEW_DEBOUNCE_MS);
    };

    const submit = () => {
        if (props.loading) {
            return;
        }

        const materialValues = prepareMaterialValues();

        if (isEditingMaterialLayer.value && props.layer?.id) {
            emitEvent("material:update", {
                id: props.layer.id,
                layer: props.layer,
                values: materialValues,
            });
            return;
        }

        if (!selectedSourceLayer.value?.id) {
            console.warn("[MaterialEditor submit] no selected source layer");
            return;
        }

        emitEvent("material:create-cube", {
            source_layer_id: selectedSourceLayer.value.id,
            layer: selectedSourceLayer.value,
            values: materialValues,
        });
    };

    const requestExport = () => {
        if (!props.layer?.id) {
            return;
        }

        emitEvent("material:export-blender", {
            id: props.layer.id,
        });
    };

    watch(
        () => props.layer?.id,
        async () => {
            await hydrateFromMaterialLayer(props.layer);
        },
        { immediate: true }
    );

    watch(
        () => JSON.stringify(values.shader_graph.nodes.map(node => ({
            id: node.id,
            settings: node.settings,
        }))),
        () => {
            if (pauseAutoSync.value) {
                return;
            }

            pauseAutoSync.value = true;

            try {
                syncSurfaceOffsetsFromNodes();
            } finally {
                queueMicrotask(() => {
                    pauseAutoSync.value = false;
                    requestPreviewDebounced();
                });
            }
        },
        { flush: "post" }
    );

    const materialSnapshot = computed(() => JSON.stringify({
        name: values.name,
        surface: values.surface,
        geometry: values.geometry,
        mesh: values.mesh?.meta,
        light: values.light,
        bitmap_maps: values.bitmap_maps,
        uv: values.uv,
        shader_graph: values.shader_graph,
        cube_size: values.cube_size,
        rotate_preview: values.rotate_preview,
        wireframe_preview: values.wireframe_preview,
        faces_preview: values.faces_preview,
        vertices_preview: values.vertices_preview,
        render_backend: values.render_backend,
        texture_size: values.texture_size,
        blend_mode: values.blend_mode,
        alpha_clip: values.alpha_clip,
        shadow_method: values.shadow_method,
        backface_culling: values.backface_culling,
        show_backface: values.show_backface,
        screen_space_refraction: values.screen_space_refraction,
        refraction_depth: values.refraction_depth,
        subsurface_translucency: values.subsurface_translucency,
        use_nodes: values.use_nodes,
    }));

    watch(
        materialSnapshot,
        () => {
            if (pauseAutoSync.value) {
                return;
            }

            requestPreviewDebounced();
        },
        { flush: "post" }
    );

    watch(
        () => [
            ui.value.activeTab,
            values.uv.view_mode,
            values.uv.active_face,
            JSON.stringify(values.uv.faces),
            JSON.stringify(values.uv.vertices),
            JSON.stringify(values.uv.selected_vertex_ids),
            JSON.stringify(values.uv.selected_island_ids),
        ].join("|"),
        async () => {
            if (pauseAutoSync.value) {
                return;
            }

            if (ui.value.activeTab === "uv") {
                await drawUvCanvas();
            }
        },
        {
            immediate: true,
            flush: "post",
        }
    );

    watch(
        () => JSON.stringify(values.shader_graph.edges),
        () => {
            if (pauseAutoSync.value) {
                return;
            }

            pauseAutoSync.value = true;

            try {
                SURFACE_FIELDS.forEach(field => {
                    syncSurfaceSlotFromShaderGraph(field.key);
                });
                syncConnectedSurfaceValuesFromGraph();
            } finally {
                queueMicrotask(() => {
                    pauseAutoSync.value = false;
                    requestPreviewDebounced();
                });
            }
        },
        { flush: "post" }
    );

    watch(
        () => [
            props.layer?.id,
            props.layer?.url,
            props.layer?.masked,
            props.layers?.length,
        ].join("|"),
        () => {
            const source = selectedSourceLayer.value;

            if (!materialSourceLayerId.value && source?.id) {
                materialSourceLayerId.value = source.id;
            }

            ensureCoreNodes();
            requestPreviewDebounced();
        },
        { immediate: true }
    );

    onMounted(() => {
        ensureCoreNodes();
        requestAnimationFrame(() => {
            nodeLayoutVersion.value += 1;
        });
        requestPreviewDebounced();
    });

    onBeforeUnmount(() => {
        if (previewTimer.value) {
            clearTimeout(previewTimer.value);
        }

        window.removeEventListener("pointermove", moveNode);
        window.removeEventListener("pointerup", stopMoveNode);
        window.removeEventListener("pointermove", moveConnection);
        window.removeEventListener("pointerup", cancelConnection);
        window.removeEventListener("pointermove", moveCanvasPan);
        window.removeEventListener("pointerup", stopCanvasPan);
        window.removeEventListener("pointermove", moveUvPan);
        window.removeEventListener("pointerup", stopUvPan);
        window.removeEventListener("pointermove", moveUvCanvasPointer);
        window.removeEventListener("pointerup", stopUvCanvasPointer);
    });

    return {
        config,
        ui,
        values,
        previewLayer,
        surfaceFields: SURFACE_FIELDS,
        surfaceGroups: PRINCIPLED_SURFACE_GROUPS,
        nodeTypeGroups,
        textureChannelOptions: TEXTURE_CHANNEL_OPTIONS,
        textureColorModeOptions: TEXTURE_COLOR_MODE_OPTIONS,
        textureSizeOptions: TEXTURE_SIZE_OPTIONS,

        textureLayers,
        selectedSourceLayer,
        materialModeLabel,
        sourceLayerName,
        sourceLayerThumbnail,
        imageSizeLabel,
        isEditingMaterialLayer,
        materialTimelineTime,
        setMaterialTimelineTime,
        materialKeyframeToolsVisible,
        materialKeyframeRecordActive,
        getMaterialFieldValue,
        addMaterialInputKeyframe,

        uvMoveAxis,
        setUvMoveAxis,
        clearUvMoveAxis,
        unwrapAllUvIslands,
        uvTextureLayerId,
        uvGridMetrics,
        uvFaceLayout,
        uvIslandLayout,
        activeUvFace,
        activeUvIsland,
        unwrapReferenceMetrics,
        hasUvMapNode,
        hasUvCubemapNode,
        showUvModeSwitch,
        uvEditorModeOptions,

        selectedUvFaces,
        uvViewModeLabel,
        activeUvFaceBitmap,
        activeUvFaceBitmapUrl,
        activeUvFaceBitmapName,
        activeSnapEdgeId,
        syncUvCubeMapToShaderGraph,
        syncUvAndPreview,
        syncUnwrapReferenceMap,
        setPreviewSetting,
        particleEmitterMode,
        particleEmitterModeLabel,
        isVolumeOrFluidPreview,
        isFluidVolumePreview,
        cycleParticleEmitterMode,
        setParticleSystemBoolean,
        setActiveMaterialTab,
        handleGeometryChange,
        handleParticleSystemChange,
        handlePhysicsChange,

        isUvFaceSelected,
        toggleUvFaceSelection,
        selectAllUvFaces,
        resetSelectedUvFaces,

        assignLayerToUvFace,
        assignLayerToSelectedUvFaces,
        isLayerAssignedToSelectedUvFaces,
        getSurfaceSlotSourceNode,
        getSurfaceSlotOffset,
        setSurfaceSlotOffset,
        setSurfaceSlotChannel,
        setSurfaceTextureSetting,
        syncSurfaceOffsetsFromNodes,
        requestPreviewDebounced,
        nodeCanvasRef,
        graphEdges,
        activeConnection,
        activeConnectionPath,
        activeShaderNode,
        activeShaderNodeId,
        materialConnected,

        isFullWorkspaceTab,

        getSurfaceSlotNode,
        getSurfaceSlotLabel,
        getSurfaceSlotDetail,
        getSurfaceSlotIcon,
        isSurfaceSlotConnected,
        syncSurfaceSlotFromShaderGraph,
        syncSurfaceSlotFromUvCubeMap,
        normalizeNodeSettings,
        ensureNodeSettings,
        updateNodeSetting,
        updateNodeTextureGroupSetting,
        syncNodeValuesToSurface,
        getSurfaceSlotForNode,
        getNodeValueSummary,
        getNodeConnectionSummary,
        getNodeBadge,
        getNodeCategoryChip,
        getNodeDisplayTitle,
        isMiniShaderNode,
        toggleShaderNodeCollapsed,
        getNodeInlineFieldItems,
        getNodeSocketVisualType,
        getNodeSocketLabel,
        getShaderNodeFieldItems,
        getShaderNodeFieldOptions,
        hasShaderNodeDefinition,
        resolveNodeDisplayValue,
        getNodeResolvedValueText,
        uvViewportRef,
        uvViewport,
        uvCanvasStyle,
        startUvPan,
        handleUvWheel,
        startUvCanvasPointer,
        resetUvViewport,
        uvCanvasRef,
        uvViewportId,
        uvCanvasId,
        uvBoxSelectState,
        uvSelectedVertexCount,
        selectedUvVertices,

        toggleUvBoxSelect,
        selectUvVerticesByBox,
        alignSelectedUvVertices,
        mergeSelectedUvVertices,
        unwrapActiveUvIsland,
        drawUvCanvas,

        assignTextureSlotFromSurface,
        clearTextureSlotFromSurface,

        nodeCanvas,
        nodeWorldStyle,
        getShaderNodeIcon,
        startCanvasPan,
        handleCanvasWheel,
        openNodeContextMenu,
        closeNodeContextMenu,
        syncTextureSettingsToUvFaces,
        syncTextureGroupSettingsToUvFaces,
        emitEvent,
        uvHoverState,
        uvCursorClass,
        setUvHoverStateFromEvent,
        clearUvHoverState,
        materialSettings,
        requestPreviewNow,
        submit,
        requestExport,

        getSurfaceColor,
        setSurfaceColor,

        getMapSlot,
        clearMapSlot,
        assignLayerToMap,
        handleMapDrop,
        handleLayerDragStart,

        selectUvLayer,
        selectUvIsland,
        setUvEditorMode,
        setActiveUvFace,
        resetActiveUvFace,

        addShaderNode,
        addShaderNodeFromContext,
        removeShaderNode,

        startMoveNode,
        startConnection,
        completeConnection,
        disconnectEdge,
        isCoreEdge,

        getNodeEdgesIn,
        getNodeEdgesOut,
    };
}

export const materialEditorProps = {
    state: {
        type: Boolean,
        required: true,
    },
    animatorState: {
        type: Boolean,
        required: false
    },
    loading: {
        type: Boolean,
        required: true,
    },
    loadingPreview: {
        type: Boolean,
        required: true,
    },
    layer: {
        type: Object,
        required: false,
        default: null,
    },
    layers: {
        type: Array,
        required: false,
        default: () => [],
    },
    theme: {
        type: String,
        required: false,
        default: "dark",
    },
    materialPreview: {
        type: Object,
        required: false,
        default: null,
    },
};
