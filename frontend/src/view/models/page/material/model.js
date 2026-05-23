import {computed, onBeforeUnmount, onMounted, reactive, ref, watch,} from "vue";
import {clamp} from "@/utils/tools";
import {uuid} from "@/utils/uuid";
import {colorArrayToHex, hexToRgbaArray} from "@/utils/color";
import {Node} from "@/view/models/page/material/core/Node/Node";
import {Mesh} from "@/view/models/page/material/core/Mesh/Mesh";
import {UV} from "@/view/models/page/material/core/UV/UV";
import {ParticleSystem} from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";
import {
    createBitmapMaps,
    createSurface,
    getTextureSettingDefaults,
    PRINCIPLED_SURFACE_GROUPS, SURFACE_FIELD_MAP, SURFACE_FIELDS, TEXTURE_CHANNEL_OPTIONS, TEXTURE_COLOR_MODE_OPTIONS
} from "@/view/models/page/material/surface/model";
import {createGeometry} from "@/view/models/page/material/geometry/model";
import {createLight} from "@/view/models/page/material/light/model";
import {createSettings, normalizeTextureSize, TEXTURE_SIZE_OPTIONS} from "@/view/models/page/material/settings/model";
import {createPhysics} from "@/view/models/page/material/physics/model";
import {createParticleSystem} from "@/view/models/page/material/particleSystem/model";

const PREVIEW_DEBOUNCE_MS = 220;

const TABS = [
    { key: "surface", title: "Surface", icon: "mdi-tune-variant" },
    { key: "geometry", title: "Geometry", icon: "mdi-cube-outline" },
    { key: "particleSystem", title: "Particle System", icon: "mdi-particle" },
    { key: "physics", title: "Physics", icon: "mdi-atom" },
    { key: "light", title: "Light", icon: "mdi-lightbulb-spot" },
    { key: "uv", title: "UV", icon: "mdi-vector-square" },
    { key: "shader", title: "Shader", icon: "mdi-graph-outline" },
    { key: "export", title: "Export", icon: "mdi-export-variant" },
    { key: "settings", title: "Settings", icon: "mdi-cog" },
];

const PRINCIPLED_NODE_INPUT_KEYS = PRINCIPLED_SURFACE_GROUPS.map(group => group.key);

const createShaderNode = (nodeKey, position = { x: 280, y: 140 }) => {
    return Node.create(nodeKey, position);
};


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

const createUv = () => UV.create();
const createMesh = geometry => Mesh.create(geometry || createGeometry(), {
    rootKey: "material",
    source: "material-editor",
});
const createParticles = (settings = {}, context = {}) => ParticleSystem.create(settings || createParticleSystem(), context);

const createPrincipledNode = () => Node.createPrincipled({
    surfaceFieldMap: SURFACE_FIELD_MAP,
    principledNodeInputKeys: PRINCIPLED_NODE_INPUT_KEYS,
    principledSurfaceGroups: PRINCIPLED_SURFACE_GROUPS,
    createSurface,
});

const createOutputNode = () => Node.createOutput();

const createShaderGraph = () => Node.createGraph({
    createPrincipled: createPrincipledNode,
});

const clonePlain = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

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

        return [0, 2, 5].includes(Number(layer.type));
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

    const previewLayer = computed(() => {
        const normalized = normalizeValues();
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

        return (
            backendLayer?.texture?.url ||
            backendLayer?.url ||
            sourceLayerTextureUrl.value
        );
    };

    const loading3DState = computed(() => {
        return props.loadingPreview;
    });

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

    const toFiniteNumber = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    const clampSurfaceValue = (slotKey, value) => {
        const field = SURFACE_FIELD_MAP[slotKey];
        const number = toFiniteNumber(value, toFiniteNumber(createSurface()[slotKey], 0));

        if (!field || field.type !== "number") {
            return number;
        }

        return clamp(number, field.min ?? 0, field.max ?? 1);
    };

    const coerceSocketValue = (value, socketType = "float", slotKey = "") => {
        if (value === null || value === undefined) {
            return null;
        }

        if (socketType === "color" || socketType === "image") {
            if (Array.isArray(value)) {
                return [
                    clamp(toFiniteNumber(value[0], 1), 0, 1),
                    clamp(toFiniteNumber(value[1], 1), 0, 1),
                    clamp(toFiniteNumber(value[2], 1), 0, 1),
                    clamp(toFiniteNumber(value[3], 1), 0, 1),
                ];
            }

            const number = clamp(toFiniteNumber(value, 1), 0, 1);
            return [number, number, number, 1];
        }

        if (socketType === "vector") {
            if (Array.isArray(value)) {
                return [
                    toFiniteNumber(value[0], 0),
                    toFiniteNumber(value[1], value[0] ?? 0),
                    toFiniteNumber(value[2], value[0] ?? 0),
                ];
            }

            const number = toFiniteNumber(value, 0);
            return [number, number, number];
        }

        if (Array.isArray(value)) {
            return clampSurfaceValue(slotKey, value[0]);
        }

        return clampSurfaceValue(slotKey, value);
    };

    const mixNumbers = (a, b, factor) => {
        const amount = clamp(toFiniteNumber(factor, 0.5), 0, 1);
        return toFiniteNumber(a, 0) * (1 - amount) + toFiniteNumber(b, 0) * amount;
    };

    const applyMathOperation = (mode, a, b) => {
        const left = toFiniteNumber(a, 0);
        const right = toFiniteNumber(b, 0);

        switch (String(mode || "add").toLowerCase()) {
            case "subtract":
                return left - right;
            case "multiply":
                return left * right;
            case "divide":
                return right === 0 ? left : left / right;
            case "min":
                return Math.min(left, right);
            case "max":
                return Math.max(left, right);
            case "power":
                return Math.pow(left, right);
            case "mix":
                return mixNumbers(left, right, 0.5);
            case "add":
            default:
                return left + right;
        }
    };

    const normalizeColorValue = (value, fallback = [1, 1, 1, 1]) => {
        if (Array.isArray(value)) {
            return [
                clamp(toFiniteNumber(value[0], fallback[0] ?? 1), 0, 1),
                clamp(toFiniteNumber(value[1], fallback[1] ?? 1), 0, 1),
                clamp(toFiniteNumber(value[2], fallback[2] ?? 1), 0, 1),
                clamp(toFiniteNumber(value[3], fallback[3] ?? 1), 0, 1),
            ];
        }

        const number = clamp(toFiniteNumber(value, fallback[0] ?? 1), 0, 1);
        return [number, number, number, 1];
    };

    const luminanceFromColor = color => {
        const value = normalizeColorValue(color, [0, 0, 0, 1]);
        return clamp(value[0] * 0.2126 + value[1] * 0.7152 + value[2] * 0.0722, 0, 1);
    };

    const mixColors = (a, b, factor) => {
        const amount = clamp(toFiniteNumber(factor, 0.5), 0, 1);
        const left = normalizeColorValue(a, [0, 0, 0, 1]);
        const right = normalizeColorValue(b, [1, 1, 1, 1]);

        return left.map((channel, index) => (
            index === 3
                ? mixNumbers(channel, right[index] ?? 1, amount)
                : clamp(mixNumbers(channel, right[index] ?? 0, amount), 0, 1)
        ));
    };

    const kelvinToColor = value => {
        const temperature = clamp(toFiniteNumber(value, 6500), 1000, 40000) / 100;
        const red = temperature <= 66
            ? 255
            : 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
        const green = temperature <= 66
            ? 99.4708025861 * Math.log(temperature) - 161.1195681661
            : 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
        const blue = temperature >= 66
            ? 255
            : temperature <= 19
                ? 0
                : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;

        return [
            clamp(red / 255, 0, 1),
            clamp(green / 255, 0, 1),
            clamp(blue / 255, 0, 1),
            1,
        ];
    };

    const resolveInputValue = (nodeId, socket, seen = new Set()) => {
        const edge = values.shader_graph.edges.find(item => (
            item.to.node === nodeId &&
            item.to.socket === socket
        ));

        if (!edge) {
            return null;
        }

        return resolveNodeOutputValue(edge.from.node, edge.from.socket, seen);
    };

    const resolveNodeOutputValue = (nodeId, socket = "", seen = new Set()) => {
        if (!nodeId || seen.has(nodeId)) {
            return null;
        }

        seen.add(nodeId);

        const node = getGraphNode(nodeId);

        if (!node) {
            return null;
        }

        const settings = normalizeNodeSettings(node);
        const nodeKey = settings.node_key || "";

        if (nodeKey === "texture.bitmap" || nodeKey === "texture.multitexture") {
            return null;
        }

        if (nodeKey === "uv.map" || nodeKey === "uv.cubemap") {
            return settings.uv || settings.vector || [0, 0, 0];
        }

        if (nodeKey === "math.value") {
            return toFiniteNumber(settings.value, 0);
        }

        if (nodeKey === "math.operation") {
            const a = resolveInputValue(node.id, "a", new Set(seen)) ?? settings.a ?? settings.value ?? 0;
            const b = resolveInputValue(node.id, "b", new Set(seen)) ?? settings.b ?? settings.factor ?? 0;
            const result = applyMathOperation(settings.mode || settings.operation, a, b);

            return settings.clamp === true ? clamp(result, 0, 1) : result;
        }

        if (nodeKey === "math.mix") {
            const factor = resolveInputValue(node.id, "factor", new Set(seen)) ?? settings.factor ?? 0.5;
            const a = resolveInputValue(node.id, "a", new Set(seen)) ?? settings.a ?? 0;
            const b = resolveInputValue(node.id, "b", new Set(seen)) ?? settings.b ?? 1;
            const result = mixNumbers(a, b, factor);

            return settings.clamp === false ? result : clamp(result, 0, 1);
        }

        if (nodeKey === "vector.mix") {
            const factor = resolveInputValue(node.id, "factor", new Set(seen)) ?? settings.factor ?? 0.5;
            const a = resolveInputValue(node.id, "a", new Set(seen)) ?? settings.a ?? [0, 0, 0];
            const b = resolveInputValue(node.id, "b", new Set(seen)) ?? settings.b ?? [1, 1, 1];
            const amount = clamp(toFiniteNumber(factor, 0.5), 0, 1);

            const left = Array.isArray(a)
                ? a
                : [toFiniteNumber(a, 0), toFiniteNumber(a, 0), toFiniteNumber(a, 0)];

            const right = Array.isArray(b)
                ? b
                : [toFiniteNumber(b, 1), toFiniteNumber(b, 1), toFiniteNumber(b, 1)];

            return [
                mixNumbers(left[0], right[0], amount),
                mixNumbers(left[1], right[1], amount),
                mixNumbers(left[2], right[2], amount),
            ];
        }

        if (nodeKey === "color.mix") {
            const factor = resolveInputValue(node.id, "factor", new Set(seen)) ?? settings.factor ?? 0.5;
            const a = resolveInputValue(node.id, "a", new Set(seen)) ?? settings.a ?? [0, 0, 0, 1];
            const b = resolveInputValue(node.id, "b", new Set(seen)) ?? settings.b ?? [1, 1, 1, 1];

            return mixColors(a, b, factor);
        }

        if (nodeKey === "math.clamp") {
            const value = resolveInputValue(node.id, "value", new Set(seen)) ?? settings.value ?? 0;
            const min = resolveInputValue(node.id, "min", new Set(seen)) ?? settings.min ?? 0;
            const max = resolveInputValue(node.id, "max", new Set(seen)) ?? settings.max ?? 1;

            return clamp(
                toFiniteNumber(value, 0),
                toFiniteNumber(min, 0),
                toFiniteNumber(max, 1)
            );
        }

        if (nodeKey === "math.floatCurve") {
            return resolveInputValue(node.id, "value", new Set(seen)) ??
                settings.value ??
                settings.factor ??
                0;
        }

        if (nodeKey === "color.blackbody") {
            const temperature =
                resolveInputValue(node.id, "temperature", new Set(seen)) ??
                settings.temperature ??
                6500;

            return socket === "color"
                ? kelvinToColor(temperature)
                : temperature;
        }

        if (nodeKey === "texture.gradient") {
            const factor =
                resolveInputValue(node.id, "vector", new Set(seen)) ??
                settings.factor ??
                0.5;

            return socket === "color"
                ? normalizeColorValue(factor, [0.5, 0.5, 0.5, 1])
                : clamp(toFiniteNumber(Array.isArray(factor) ? factor[0] : factor, 0.5), 0, 1);
        }

        if (nodeKey === "texture.noise" || nodeKey === "texture.wave") {
            const scale =
                resolveInputValue(node.id, "scale", new Set(seen)) ??
                settings.scale ??
                0.5;

            const factor = clamp(toFiniteNumber(scale, 0.5), 0, 1);

            return socket === "color"
                ? [factor, factor, factor, 1]
                : factor;
        }

        if (nodeKey === "color.colorRamp") {
            const factor =
                resolveInputValue(node.id, "factor", new Set(seen)) ??
                settings.factor ??
                settings.position ??
                0.5;

            return socket === "alpha"
                ? clamp(toFiniteNumber(factor, 1), 0, 1)
                : normalizeColorValue(settings.color ?? factor);
        }

        if (nodeKey === "color.brightnessContrast") {
            const source =
                resolveInputValue(node.id, "bitmap", new Set(seen)) ??
                settings.bitmap ??
                0.5;

            const brightness =
                resolveInputValue(node.id, "brightness", new Set(seen)) ??
                settings.brightness ??
                0;

            const contrast =
                resolveInputValue(node.id, "contrast", new Set(seen)) ??
                settings.contrast ??
                0;

            const value = clamp(
                (Array.isArray(source) ? luminanceFromColor(source) : toFiniteNumber(source, 0.5)) +
                toFiniteNumber(brightness, 0),
                0,
                1
            );

            const contrasted = clamp(
                (value - 0.5) * (1 + toFiniteNumber(contrast, 0)) + 0.5,
                0,
                1
            );

            return socket === "bitmap"
                ? [contrasted, contrasted, contrasted, 1]
                : contrasted;
        }

        if (nodeKey === "color.gamma") {
            const color =
                resolveInputValue(node.id, "color", new Set(seen)) ??
                settings.color ??
                [1, 1, 1, 1];

            const gamma = Math.max(
                0.001,
                toFiniteNumber(
                    resolveInputValue(node.id, "gamma", new Set(seen)) ?? settings.gamma,
                    1
                )
            );

            return normalizeColorValue(color).map((channel, index) => (
                index === 3 ? channel : clamp(Math.pow(channel, gamma), 0, 1)
            ));
        }

        if (nodeKey === "color.hsv") {
            const source =
                resolveInputValue(node.id, "bitmap", new Set(seen)) ??
                settings.bitmap ??
                [1, 1, 1, 1];

            const amount = toFiniteNumber(
                resolveInputValue(node.id, "value", new Set(seen)) ?? settings.value,
                1
            );

            return normalizeColorValue(source).map((channel, index) => (
                index === 3 ? channel : clamp(channel * amount, 0, 1)
            ));
        }

        if (nodeKey === "color.invert") {
            const color =
                resolveInputValue(node.id, "color", new Set(seen)) ??
                settings.color ??
                [1, 1, 1, 1];

            const factor = clamp(
                toFiniteNumber(
                    resolveInputValue(node.id, "factor", new Set(seen)) ?? settings.factor,
                    1
                ),
                0,
                1
            );

            return normalizeColorValue(color).map((channel, index) => (
                index === 3 ? channel : mixNumbers(channel, 1 - channel, factor)
            ));
        }

        if (nodeKey === "color.rgbToBw") {
            const source =
                resolveInputValue(node.id, "bitmap", new Set(seen)) ??
                settings.bitmap ??
                [1, 1, 1, 1];

            return luminanceFromColor(source);
        }

        if (nodeKey === "color.combine") {
            return [
                clamp(toFiniteNumber(resolveInputValue(node.id, "red", new Set(seen)) ?? settings.red, 0), 0, 1),
                clamp(toFiniteNumber(resolveInputValue(node.id, "green", new Set(seen)) ?? settings.green, 0), 0, 1),
                clamp(toFiniteNumber(resolveInputValue(node.id, "blue", new Set(seen)) ?? settings.blue, 0), 0, 1),
                clamp(toFiniteNumber(resolveInputValue(node.id, "alpha", new Set(seen)) ?? settings.alpha, 1), 0, 1),
            ];
        }

        if (nodeKey === "color.separate") {
            const color = normalizeColorValue(
                resolveInputValue(node.id, "color", new Set(seen)) ?? settings.color
            );

            const channelIndex = {
                red: 0,
                green: 1,
                blue: 2,
                alpha: 3,
            }[socket] ?? 0;

            return color[channelIndex];
        }

        if (nodeKey === "vector.combineXYZ") {
            return [
                toFiniteNumber(resolveInputValue(node.id, "x", new Set(seen)) ?? settings.x, 0),
                toFiniteNumber(resolveInputValue(node.id, "y", new Set(seen)) ?? settings.y, 0),
                toFiniteNumber(resolveInputValue(node.id, "z", new Set(seen)) ?? settings.z, 0),
            ];
        }

        if (nodeKey === "vector.separateXYZ") {
            const vector =
                resolveInputValue(node.id, "vector", new Set(seen)) ??
                [settings.x ?? 0, settings.y ?? 0, settings.z ?? 0];

            const channelIndex = {
                x: 0,
                y: 1,
                z: 2,
            }[socket] ?? 0;

            return Array.isArray(vector)
                ? toFiniteNumber(vector[channelIndex], 0)
                : toFiniteNumber(vector, 0);
        }

        if (nodeKey === "vector.mapping") {
            const vector =
                resolveInputValue(node.id, "vector", new Set(seen)) ??
                settings.vector ??
                [0, 0, 0];

            return Array.isArray(vector)
                ? vector
                : [toFiniteNumber(vector, 0), toFiniteNumber(vector, 0), toFiniteNumber(vector, 0)];
        }

        if (socket && settings[socket] !== undefined) {
            return settings[socket];
        }

        const primaryInput = Object.keys(node.inputs || {}).find(input => (
            ["value", "factor", "a", "b", "brightness", "contrast", "color", "bitmap", "vector"].includes(input)
        ));

        if (primaryInput) {
            const incoming = resolveInputValue(node.id, primaryInput, new Set(seen));

            if (incoming !== null && incoming !== undefined) {
                return incoming;
            }
        }

        return settings.value ?? settings.factor ?? settings.strength ?? null;
    };

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
        const maps = clonePlain(bitmapMaps);

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
        values.mesh = mesh;

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

    const getPlainMesh = () => Mesh.toPlain(values.mesh || createMesh(values.geometry));

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
        ...clonePlain(values.uv),
        vertices: [],
        edges: [],
        triangles: [],
        seams: [],
        islands: (values.uv.islands || []).map(island => ({
            ...clonePlain(island),
            vertex_ids: [],
            edge_ids: [],
            triangle_ids: [],
        })),
    });

    const getPlainParticleSystem = ({ compact = false } = {}) => ParticleSystem.toPlain(
        values.particle_system || createParticles(),
        { compact }
    );

    const normalizeValues = ({ preview = false } = {}) => ({
        name: values.name || "Cube Material",

        surface: clonePlain(values.surface),
        geometry: clonePlain(values.geometry),
        mesh: preview ? getPreviewPlainMesh() : getPlainMesh(),
        particle_system: getPlainParticleSystem({ compact: preview }),
        physics: clonePlain(values.physics),
        light: clonePlain(values.light),
        bitmap_maps: sanitizeSurfaceBitmapMaps(values.bitmap_maps),
        uv: preview ? getPreviewUv() : clonePlain(values.uv),
        shader_graph: {
            ...clonePlain(values.shader_graph),
            material_connected: materialConnected.value,
        },

        cube_size: clamp(Number(values.cube_size || 256), 64, 4096),
        rotate_preview: values.rotate_preview,
        wireframe_preview: values.wireframe_preview,
        faces_preview: values.faces_preview,
        vertices_preview: values.vertices_preview,
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

        window.addEventListener("mousemove", moveCanvasPan);
        window.addEventListener("mouseup", stopCanvasPan);
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

        window.removeEventListener("mousemove", moveCanvasPan);
        window.removeEventListener("mouseup", stopCanvasPan);
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

    const interpolateValue = (value, settings = {}) => {
        const strength = Number(settings.strength ?? settings.factor ?? 1);
        const offset = Number(settings.offset ?? 0);
        const shouldClamp = settings.clamp !== false;

        const input = strength < 0 ? 1 - clamp(Number(value ?? 0), 0, 1) : Number(value ?? 0);
        let result = input * Math.abs(strength) + offset;

        if (shouldClamp) {
            result = clamp(result, 0, 1);
        }

        return result;
    };

    const interpolateColor = (color, settings = {}) => {
        const source = Array.isArray(color) ? color : [1, 1, 1, 1];
        const strength = Number(settings.strength ?? settings.factor ?? 1);
        const offset = Number(settings.offset ?? 0);
        const shouldClamp = settings.clamp !== false;

        return source.map((channel, index) => {
            if (index === 3) {
                return channel;
            }

            const input = strength < 0 ? 1 - clamp(Number(channel ?? 0), 0, 1) : Number(channel ?? 0);
            const result = input * Math.abs(strength) + offset;

            return shouldClamp ? clamp(result, 0, 1) : result;
        });
    };

    const resolveNodeDisplayValue = node => {
        if (!node) {
            return null;
        }

        const settings = normalizeNodeSettings(node);
        const nodeKey = settings.node_key || "";

        if (nodeKey === "texture.bitmap") {
            return {
                type: "color",
                label: settings.name || settings.url || "Bitmap",
                url: settings.url || "",
                value: interpolateColor([1, 1, 1, 1], settings),
                settings,
            };
        }

        if (nodeKey === "uv.map" || nodeKey === "uv.cubemap") {
            return {
                type: "uv",
                label: node.label,
                value: {
                    offset_x: settings.offset_x,
                    offset_y: settings.offset_y,
                    scale_x: settings.scale_x,
                    scale_y: settings.scale_y,
                    rotate: settings.rotate,
                },
                settings,
            };
        }

        return {
            type: "value",
            label: node.label,
            value: interpolateValue(1, settings),
            settings,
        };
    };

    const getNodeResolvedValueText = node => {
        const resolved = resolveNodeDisplayValue(node);

        if (!resolved) {
            return "";
        }

        if (resolved.type === "uv") {
            return `UV ${resolved.value.offset_x}, ${resolved.value.offset_y} · ${resolved.value.scale_x}×${resolved.value.scale_y}`;
        }

        if (resolved.type === "color") {
            return resolved.label;
        }

        return String(Math.round(Number(resolved.value || 0) * 1000) / 1000);
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

        window.addEventListener("mousemove", moveNode);
        window.addEventListener("mouseup", stopMoveNode);
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

        window.removeEventListener("mousemove", moveNode);
        window.removeEventListener("mouseup", stopMoveNode);

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

        window.addEventListener("mousemove", moveConnection);
        window.addEventListener("mouseup", cancelConnection);
    };

    const moveConnection = event => {
        pointerPosition.value = getCanvasPoint(event);
    };

    const cancelConnection = () => {
        activeConnection.value = null;

        window.removeEventListener("mousemove", moveConnection);
        window.removeEventListener("mouseup", cancelConnection);
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
                    locked: node.locked === true,
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
                    locked: node.locked === true,
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
                locked: node.generated === true && node.system === "uv-cubemap"
                    ? false
                    : node.locked === true,
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

    const hydrateFromMaterialLayer = async layer => {
        if (!layer || Number(layer.type) !== 5) {
            return;
        }

        const materialPackage = await loadMaterialPackage(layer);
        const source = materialPackage || layer;

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
            { mesh: values.mesh },
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
        values.shader_graph = {
            ...createShaderGraph(),
            ...(cloneData(source.shader_graph || source.shader?.graph || {})),
        };
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

        ensureCoreNodes();
        syncSurfaceSlotFromUvCubeMap();
        syncAllSurfaceSlotsFromShaderGraph();
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
        values.uv.selected_faces = [...CUBE_FACE_ORDER];

        return true;
    };

    const getMappedUvFaces = () => {
        return CUBE_FACE_ORDER.filter(face => Boolean(values.uv.faces[face]?.bitmap?.url));
    };

    const normalizeTextureUrl = url => {
        return String(url || "").trim();
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

            return normalizeValues({ preview });
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

    const resetSelectedUvFaces = async () => {
        if (values.uv.view_mode === "unwrap") {
            values.uv.vertices = [];
            values.uv.edges = [];
            values.uv.triangles = [];
            values.uv.islands = [];
            rebuildMaterialMesh({ preserveLayout: false });
            await drawUvCanvas();
            requestPreviewDebounced();
            return;
        }

        selectedUvFaces.value.forEach(face => {
            values.uv.faces[face] = getDefaultCubeFaceUv(face);
        });

        syncUvCubeMapToShaderGraph();

        await drawUvCanvas();
        requestPreviewDebounced();
    };

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
        if (event.button !== 0) {
            return;
        }

        uvViewport.isPanning = true;
        uvViewport.panStart = {
            x: event.clientX,
            y: event.clientY,
        };

        uvViewport.origin = {
            x: uvViewport.panX,
            y: uvViewport.panY,
        };

        window.addEventListener("mousemove", moveUvPan);
        window.addEventListener("mouseup", stopUvPan);
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

        window.removeEventListener("mousemove", moveUvPan);
        window.removeEventListener("mouseup", stopUvPan);
    };

    const handleUvWheel = event => {
        const oldZoom = uvViewport.zoom;
        uvViewport.zoom = clamp(oldZoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.35, 4);
    };

    const startUvCanvasPointer = async event => {
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
        } else {
            const island = UV.pickIsland(values.uv, point);

            if (island) {
                values.uv = UV.selectIsland(values.uv, island.id, { additive });
                uvDragState.mode = "island";
            } else {
                values.uv = UV.clearSelection(values.uv);
                uvDragState.mode = "";
                queueMicrotask(() => {
                    pauseAutoSync.value = false;
                });
                await drawUvCanvas();
                return;
            }
        }

        uvDragState.active = true;
        uvDragState.last = point;

        window.addEventListener("mousemove", moveUvCanvasPointer);
        window.addEventListener("mouseup", stopUvCanvasPointer);

        await drawUvCanvas();
    };

    const moveUvCanvasPointer = async event => {
        if (!uvDragState.active || values.uv.view_mode !== "unwrap") {
            return;
        }

        const point = getUvPointFromEvent(event);
        const dx = point.x - uvDragState.last.x;
        const dy = point.y - uvDragState.last.y;

        uvDragState.last = point;

        if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) {
            return;
        }

        values.uv = UV.moveSelection(values.uv, dx, dy);
        applyUvLayoutToMesh({ source: "uv-drag" });
        await drawUvCanvas();
    };

    const stopUvCanvasPointer = () => {
        if (!uvDragState.active) {
            return;
        }

        uvDragState.active = false;
        uvDragState.mode = "";

        window.removeEventListener("mousemove", moveUvCanvasPointer);
        window.removeEventListener("mouseup", stopUvCanvasPointer);

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

    const handleGeometryChange = () => {
        rebuildMaterialMesh({ preserveLayout: false });
        values.particle_system = ParticleSystem.update(values.particle_system, {}, { mesh: values.mesh });
        requestPreviewDebounced();

        if (ui.value.activeTab === "uv") {
            drawUvCanvas();
        }
    };

    const handleParticleSystemChange = particleSystem => {
        values.particle_system = ParticleSystem.fromPlain(particleSystem, { mesh: values.mesh });
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

        window.removeEventListener("mousemove", moveNode);
        window.removeEventListener("mouseup", stopMoveNode);
        window.removeEventListener("mousemove", moveConnection);
        window.removeEventListener("mouseup", cancelConnection);
        window.removeEventListener("mousemove", moveCanvasPan);
        window.removeEventListener("mouseup", stopCanvasPan);
        window.removeEventListener("mousemove", moveUvPan);
        window.removeEventListener("mouseup", stopUvPan);
        window.removeEventListener("mousemove", moveUvCanvasPointer);
        window.removeEventListener("mouseup", stopUvCanvasPointer);
    });

    return {
        config,
        ui,
        values,
        previewLayer,

        tabs: TABS,
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
        handleGeometryChange,
        handleParticleSystemChange,

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
        interpolateValue,
        interpolateColor,
        uvViewportRef,
        uvViewport,
        uvCanvasStyle,
        startUvPan,
        handleUvWheel,
        startUvCanvasPointer,
        resetUvViewport,
        uvCanvasRef,
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

        emitEvent,
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
