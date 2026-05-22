import {computed, onBeforeUnmount, onMounted, reactive, ref, watch,} from "vue";

const PREVIEW_DEBOUNCE_MS = 220;

const uuid = () => crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const clamp = (value, min, max) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return min;
    }

    return Math.min(Math.max(number, min), max);
};

const hexToRgbaArray = (hex = "#ffffff", alpha = 1) => {
    const value = String(hex || "#ffffff").replace("#", "");
    const full = value.length === 3
        ? value.split("").map(char => char + char).join("")
        : value.padEnd(6, "f").slice(0, 6);

    return [
        parseInt(full.slice(0, 2), 16) / 255,
        parseInt(full.slice(2, 4), 16) / 255,
        parseInt(full.slice(4, 6), 16) / 255,
        clamp(Number(alpha), 0, 1),
    ];
};

const rgbaArrayToHex = value => {
    if (!Array.isArray(value)) {
        return "#ffffff";
    }

    const toHex = number => Math.round(clamp(number, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0");

    return `#${toHex(value[0])}${toHex(value[1])}${toHex(value[2])}`;
};

const TABS = [
    { key: "surface", title: "Surface", icon: "mdi-tune-variant" },
    { key: "geometry", title: "Geometry", icon: "mdi-cube-outline" },
    { key: "uv", title: "UV", icon: "mdi-vector-square" },
    { key: "shader", title: "Shader", icon: "mdi-graph-outline" },
    { key: "export", title: "Export", icon: "mdi-export-variant" },
    { key: "settings", title: "Settings", icon: "mdi-cog" },
];

const SURFACE_FIELDS = [
    { key: "baseColor", label: "Base Color", type: "color" },
    { key: "subsurface", label: "Subsurface", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "subsurfaceRadius", label: "Subsurface Radius", type: "vector3" },
    { key: "subsurfaceColor", label: "Subsurface Color", type: "color" },
    { key: "metallic", label: "Metallic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specular", label: "Specular", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specularTint", label: "Specular Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "roughness", label: "Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropic", label: "Anisotropic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropicRotation", label: "Anisotropic Rotation", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheen", label: "Sheen", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenTint", label: "Sheen Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoat", label: "Clearcoat", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatRoughness", label: "Clearcoat Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "ior", label: "IOR", type: "number", min: 1, max: 3, step: 0.001 },
    { key: "transmission", label: "Transmission", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "transmissionRoughness", label: "Transmission Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "emission", label: "Emission", type: "color" },
    { key: "emissionStrength", label: "Emission Strength", type: "number", min: 0, max: 20, step: 0.01 },
    { key: "alpha", label: "Alpha", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "normal", label: "Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatNormal", label: "Clearcoat Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "tangent", label: "Tangent", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "bumpStrength", label: "Bump Strength", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "displacementStrength", label: "Displacement Strength", type: "number", min: 0, max: 1, step: 0.001 },
];

const NODE_TYPES = [
    { type: "bitmap", label: "Bitmap", icon: "mdi-image" },
    { type: "uv-map", label: "Map UV", icon: "mdi-vector-square" },
    { type: "filter", label: "Filter", icon: "mdi-filter" },
    { type: "modifier", label: "Modifier", icon: "mdi-tune-variant" },
    { type: "falloff", label: "Falloff", icon: "mdi-chart-bell-curve" },
    { type: "blend", label: "Blend", icon: "mdi-blender-software" },
    { type: "math", label: "Math", icon: "mdi-function" },
    { type: "preview", label: "Viewer", icon: "mdi-eye" },
];

const createSurface = () => ({
    baseColor: [1, 1, 1, 1],
    subsurface: 0,
    subsurfaceRadius: [1, 0.2, 0.1],
    subsurfaceColor: [1, 1, 1, 1],
    metallic: 0,
    specular: 0.5,
    specularTint: 0,
    roughness: 0.4,
    anisotropic: 0,
    anisotropicRotation: 0,
    sheen: 0,
    sheenTint: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.03,
    ior: 1.45,
    transmission: 0,
    transmissionRoughness: 0,
    emission: [0, 0, 0, 1],
    emissionStrength: 0,
    alpha: 1,
    normal: 0,
    clearcoatNormal: 0,
    tangent: 0,
    bumpStrength: 0,
    displacementStrength: 0,
});

const createGeometry = () => ({
    primitive: "cube",

    width: 1,
    height: 1,
    depth: 1,

    bevel: 0,
    bevel_segments: 1,

    subdivision: 0,
    shade_smooth: true,

    displacement_enabled: false,
    displacement_strength: 0,
    displacement_midlevel: 0.5,

    normal_strength: 1,
    bump_strength: 0,

    uv_fit: "stretch",
    uv_density: 1,

    pivot_x: 0,
    pivot_y: 0,
    pivot_z: 0,

    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,

    scale_x: 1,
    scale_y: 1,
    scale_z: 1,
});

const createBitmapMaps = () => {
    return SURFACE_FIELDS.reduce((acc, field) => {
        acc[field.key] = {
            enabled: false,

            // single | multitexture | shader | none
            source_type: "none",

            layer_id: "",
            url: "",
            name: "",

            // reference to generated shader node, if any
            node_id: "",
            uv_node_id: "",

            // for multi texture / cubemap
            faces: {},
            mapped_faces: [],

            channel: "rgba",
            strength: 1,
            offset: 0,
            invert: false,
            blend: "replace",
        };

        return acc;
    }, {});
};

const createCubeFace = (face, x, y, width = 0.25, height = 1 / 3) => ({
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

    bitmap: {
        layer_id: "",
        url: "",
        name: "",
        width: 0,
        height: 0,
    },
});

const createUv = () => ({
    mode: "cubemap",
    view_mode: "cubemap",
    active_face: "front",
    selected_faces: ["front"],
    atlas: "cross",

    faces: {
        top: createCubeFace("top", 0.25, 0),
        left: createCubeFace("left", 0, 1 / 3),
        front: createCubeFace("front", 0.25, 1 / 3),
        right: createCubeFace("right", 0.5, 1 / 3),
        back: createCubeFace("back", 0.75, 1 / 3),
        bottom: createCubeFace("bottom", 0.25, 2 / 3),
    },
});

const createPrincipledNode = () => ({
    id: "principled-bsdf",
    type: "principled",
    label: "Principled BSDF",
    locked: false,
    position: { x: 620, y: 130 },
    inputs: SURFACE_FIELDS.reduce((acc, field) => {
        acc[field.key] = {
            type: Array.isArray(createSurface()[field.key]) ? "color" : "float",
        };

        return acc;
    }, {}),
    outputs: {
        bsdf: { type: "shader" },
    },
    settings: {
        source: "surface",
    },
});

const createOutputNode = () => ({
    id: "material-output",
    type: "output",
    label: "Material Output",
    locked: false,
    position: { x: 940, y: 220 },
    inputs: {
        surface: { type: "shader" },
    },
    outputs: {},
    settings: {},
});

const createShaderGraph = () => ({
    version: 1,
    nodes: [
        createPrincipledNode(),
        createOutputNode(),
    ],
    edges: [
        {
            id: "edge-principled-output",
            core: true,
            from: {
                node: "principled-bsdf",
                socket: "bsdf",
            },
            to: {
                node: "material-output",
                socket: "surface",
            },
        },
    ],
});

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

    const uvViewport = reactive({
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
    });

    const nodeCanvas = reactive({
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
    });

    const uvCanvasStyle = computed(() => ({
        transform: `translate(${uvViewport.panX}px, ${uvViewport.panY}px) scale(${uvViewport.zoom})`,
    }));

    const ui = reactive({
        activeTab: "surface",
    });

    const values = reactive({
        name: "Cube Material",
        surface: createSurface(),
        geometry: createGeometry(),
        bitmap_maps: createBitmapMaps(),
        uv: createUv(),
        shader_graph: createShaderGraph(),

        cube_size: 256,
        rotate_preview: true,
        blend_mode: "BLEND",
        shadow_method: "HASHED",
        use_nodes: true,
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

    const isFullWorkspaceTab = computed(() => {
        return ["shader", "uv"].includes(ui.activeTab);
    });

    const nodeWorldStyle = computed(() => ({
        transform: `translate(${nodeCanvas.panX}px, ${nodeCanvas.panY}px) scale(${nodeCanvas.zoom})`,
        transformOrigin: "0 0",
    }));

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const isUsableTextureLayer = layer => {
        if (!layer || layer.hidden === 1) {
            return false;
        }

        return [0, 2, 5].includes(Number(layer.type));
    };

    const resolveLayerTextureUrl = layer => {
        if (!layer) {
            return "";
        }

        return (
            layer.masked ||
            layer.texture?.url ||
            layer.material?.textures?.base_color?.url ||
            layer.thumbnail ||
            layer.url ||
            layer.svg ||
            ""
        );
    };

    const textureLayers = computed(() => {
        return (props.layers || []).filter(isUsableTextureLayer);
    });

    const fallbackSourceLayer = computed(() => {
        if (props.layer?.id && isUsableTextureLayer(props.layer)) {
            return props.layer;
        }

        return textureLayers.value[0] || null;
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

    const sourceLayerThumbnail = computed(() => {
        return resolveLayerTextureUrl(selectedSourceLayer.value);
    });

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

    const imageSizeLabel = computed(() => {
        const width = Number(selectedSourceLayer.value?.width || 0);
        const height = Number(selectedSourceLayer.value?.height || 0);

        if (!width || !height) {
            return "Keine Textur";
        }

        return `${width} × ${height}`;
    });

    const activeUvFace = computed(() => {
        return values.uv.faces[values.uv.active_face];
    });

    const selectedUvFaces = computed(() => {
        const list = Array.isArray(values.uv.selected_faces)
            ? values.uv.selected_faces
            : [];

        return list.length ? list : [values.uv.active_face];
    });

    const uvViewModeLabel = computed(() => {
        return values.uv.view_mode === "cubemap"
            ? "CubeMap Grid"
            : "Single Face";
    });

    const activeUvFaceBitmap = computed(() => {
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

    const uvFaceLayout = computed(() => [
        { face: "top", col: 2, row: 1 },
        { face: "left", col: 1, row: 2 },
        { face: "front", col: 2, row: 2 },
        { face: "right", col: 3, row: 2 },
        { face: "back", col: 4, row: 2 },
        { face: "bottom", col: 2, row: 3 },
    ]);

    const getGraphNode = id => {
        return values.shader_graph.nodes.find(node => node.id === id);
    };

    const NODE_VALUE_DEFAULTS = {
        bitmap: {
            channel: "rgba",
            strength: 1,
            offset: 0,
            invert: false,
            blend: "replace",
        },

        "uv-map": {
            offset_x: 0,
            offset_y: 0,
            scale_x: 1,
            scale_y: 1,
            rotate: 0,
            clamp: true,
        },

        filter: {
            filter: "none",
            strength: 1,
            offset: 0,
            clamp: true,
        },

        modifier: {
            operation: "none",
            strength: 1,
            offset: 0,
            clamp: true,
        },

        falloff: {
            falloff: "smooth",
            strength: 1,
            offset: 0,
            invert: false,
            clamp: true,
        },

        blend: {
            operation: "multiply",
            factor: 1,
            offset: 0,
            clamp: true,
        },

        math: {
            operation: "add",
            value: 0,
            factor: 1,
            offset: 0,
            clamp: true,
        },

        multitexture: {
            mode: "cubemap-url-group-composite",
            strength: 1,
            offset: 0,
            blend: "replace",
        },

        preview: {
            exposure: 1,
            offset: 0,
        },
    };

    const normalizeNodeSettings = node => {
        if (!node) {
            return {};
        }

        return {
            ...(NODE_VALUE_DEFAULTS[node.type] || {}),
            ...(node.settings || {}),
        };
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

        if (key === "offset" || key === "strength" || key === "channel" || key === "invert" || key === "blend") {
            syncNodeValuesToSurface(node);
            syncSurfaceOffsetsFromNodes();
        }

        syncNodeValuesToSurface(node);
        requestPreviewDebounced();
    };

    const getSurfaceSlotForNode = nodeId => {
        const edge = values.shader_graph.edges.find(item => (
            item.from.node === nodeId &&
            item.to.node === "principled-bsdf" &&
            values.bitmap_maps[item.to.socket]
        ));

        return edge?.to?.socket || "";
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

            channel: settings.channel || values.bitmap_maps[slotKey].channel || "rgba",
            strength: settings.strength ?? values.bitmap_maps[slotKey].strength ?? 1,
            offset: settings.offset ?? values.bitmap_maps[slotKey].offset ?? 0,
            invert: settings.invert === true,
            blend: settings.blend || values.bitmap_maps[slotKey].blend || "replace",
        };
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

    const materialConnected = computed(() => {
        return values.shader_graph.edges.some(edge => (
            edge.from.node === "principled-bsdf" &&
            edge.from.socket === "bsdf" &&
            edge.to.node === "material-output" &&
            edge.to.socket === "surface"
        ));
    });

    const normalizeValues = () => ({
        name: values.name || "Cube Material",
        surface: values.surface,
        geometry: values.geometry,
        bitmap_maps: values.bitmap_maps,
        uv: values.uv,
        shader_graph: {
            ...values.shader_graph,
            material_connected: materialConnected.value,
        },
        cube_size: clamp(Number(values.cube_size), 64, 1024),
        rotate_preview: values.rotate_preview === true,
        blend_mode: values.blend_mode || "BLEND",
        shadow_method: values.shadow_method || "HASHED",
        use_nodes: values.use_nodes === true,
    });

    const previewLayer = computed(() => {
        const normalized = normalizeValues();

        return {
            id: `preview-${props.layer?.id || selectedSourceLayer.value?.id || "material"}`,
            source: selectedSourceLayer.value?.id || props.layer?.id || "",
            name: normalized.name,
            type: 5,

            renderer: "canvas-cube",
            engine: "material",

            width: 512,
            height: 512,

            url: normalized.bitmap_maps.baseColor?.url || sourceLayerThumbnail.value,
            thumbnail: normalized.bitmap_maps.baseColor?.url || sourceLayerThumbnail.value,

            surface: normalized.surface,
            geometry: normalized.geometry,
            bitmap_maps: normalized.bitmap_maps,
            uv: normalized.uv,
            shader_graph: normalized.shader_graph,

            material: {
                surface: normalized.surface,
                bitmap_maps: normalized.bitmap_maps,
                shader_graph: normalized.shader_graph,
            },

            shader: {
                shader: "canvas-principled-node-graph",
                version: 3,
                inputs: normalized.surface,
                bitmap_maps: normalized.bitmap_maps,
                graph: normalized.shader_graph,
            },

            texture: {
                url: normalized.bitmap_maps.baseColor?.url || sourceLayerThumbnail.value,
            },

            preview: {
                rotate: normalized.rotate_preview,
                idle_rotation: {
                    enabled: normalized.rotate_preview,
                    speed: 0.006,
                    tilt: 0.42,
                },
            },

            time: previewStableTime.value,
        };
    });

    const getSurfaceColor = key => {
        return rgbaArrayToHex(values.surface[key]);
    };

    const setSurfaceColor = (key, hex) => {
        const alpha = Array.isArray(values.surface[key])
            ? values.surface[key][3] ?? 1
            : 1;

        values.surface[key] = hexToRgbaArray(hex, alpha);
        requestPreviewDebounced();
    };

    const getSurfaceSlotSourceNode = key => {
        const slot = values.bitmap_maps[key];

        if (slot?.node_id) {
            const node = getGraphNode(slot.node_id);

            if (node) {
                return node;
            }
        }

        const edge = values.shader_graph.edges.find(item => (
            item.to.node === "principled-bsdf" &&
            item.to.socket === key
        ));

        return edge ? getGraphNode(edge.from.node) : null;
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
                channel: node.settings.channel || values.bitmap_maps[field.key].channel || "rgba",
                invert: node.settings.invert === true,
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

    const getNodeSocketPosition = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);

        if (!node) {
            return { x: 0, y: 0 };
        }

        const nodeX = node.position?.x || 0;
        const nodeY = node.position?.y || 0;

        const sockets = direction === "input"
            ? Object.keys(node.inputs || {})
            : Object.keys(node.outputs || {});

        const index = Math.max(0, sockets.indexOf(socket));

        const nodeWidth = node.type === "output" ? 230 : node.type === "principled" ? 270 : 220;

        return {
            x: direction === "input" ? nodeX : nodeX + nodeWidth,
            y: nodeY + 58 + index * 24,
        };
    };

    const graphEdges = computed(() => {
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

        if (node.type === "output") {
            return 230;
        }

        if (node.type === "principled") {
            return 270;
        }

        if (node.type === "multitexture") {
            return 280;
        }

        return 220;
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

    const getPrimaryInputSocket = node => {
        if (!node) {
            return "image";
        }

        const sockets = Object.keys(node.inputs || {});

        return (
            sockets.find(socket => ["image", "color", "value", "factor", "surface"].includes(socket)) ||
            sockets[0] ||
            "image"
        );
    };

    const getPrimaryOutputSocket = node => {
        if (!node) {
            return "color";
        }

        const sockets = Object.keys(node.outputs || {});

        return (
            sockets.find(socket => ["color", "image", "value", "bsdf"].includes(socket)) ||
            sockets[0] ||
            "color"
        );
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

        const inputSocket = getPrimaryInputSocket(node);
        const outputSocket = getPrimaryOutputSocket(node);

        values.shader_graph.edges = values.shader_graph.edges.filter(item => item.id !== edge.id);

        values.shader_graph.edges.push({
            id: uuid(),
            from: edge.from,
            to: {
                node: node.id,
                socket: inputSocket,
            },
        });

        values.shader_graph.edges.push({
            id: uuid(),
            from: {
                node: node.id,
                socket: outputSocket,
            },
            to: edge.to,
        });

        syncNodeValuesToSurface(node);

        activeSnapEdgeId.value = "";
        requestPreviewDebounced();
    };

    const getNodeValueSummary = node => {
        if (!node) {
            return "No node";
        }

        const settings = normalizeNodeSettings(node);

        if (node.type === "bitmap") {
            return [
                settings.name || settings.layer_id || "Bitmap",
                settings.channel ? `ch:${settings.channel}` : "",
                Number.isFinite(Number(settings.strength)) ? `str:${Number(settings.strength).toFixed(2)}` : "",
                Number.isFinite(Number(settings.offset)) ? `off:${Number(settings.offset).toFixed(2)}` : "",
            ].filter(Boolean).join(" · ");
        }

        if (node.type === "uv-map") {
            return [
                `x:${Number(settings.offset_x || 0).toFixed(2)}`,
                `y:${Number(settings.offset_y || 0).toFixed(2)}`,
                `sx:${Number(settings.scale_x || 1).toFixed(2)}`,
                `sy:${Number(settings.scale_y || 1).toFixed(2)}`,
                `rot:${Number(settings.rotate || 0).toFixed(1)}°`,
            ].join(" · ");
        }

        if (node.type === "falloff") {
            return `${settings.falloff || "smooth"} · str:${Number(settings.strength || 1).toFixed(2)} · off:${Number(settings.offset || 0).toFixed(2)}`;
        }

        if (node.type === "filter") {
            return `${settings.filter || "none"} · str:${Number(settings.strength || 1).toFixed(2)} · off:${Number(settings.offset || 0).toFixed(2)}`;
        }

        if (node.type === "blend" || node.type === "math" || node.type === "modifier") {
            return `${settings.operation || "none"} · factor:${Number(settings.factor ?? settings.strength ?? 1).toFixed(2)} · off:${Number(settings.offset || 0).toFixed(2)}`;
        }

        if (node.type === "multitexture") {
            const groups = settings.texture_groups || [];
            return `${groups.length} textures · str:${Number(settings.strength || 1).toFixed(2)} · off:${Number(settings.offset || 0).toFixed(2)}`;
        }

        return node.type;
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

        if (getSurfaceSlotForNode(node.id)) {
            return getSurfaceSlotForNode(node.id);
        }

        return node.type;
    };

    const interpolateValue = (value, settings = {}) => {
        const strength = Number(settings.strength ?? settings.factor ?? 1);
        const offset = Number(settings.offset ?? 0);
        const shouldClamp = settings.clamp !== false;

        let result = Number(value ?? 0) * strength + offset;

        if (settings.invert === true) {
            result = 1 - result;
        }

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

            let result = Number(channel ?? 0) * strength + offset;

            if (settings.invert === true) {
                result = 1 - result;
            }

            return shouldClamp ? clamp(result, 0, 1) : result;
        });
    };

    const resolveNodeDisplayValue = node => {
        if (!node) {
            return null;
        }

        const settings = normalizeNodeSettings(node);

        if (node.type === "bitmap") {
            return {
                type: "color",
                label: settings.name || settings.url || "Bitmap",
                url: settings.url || "",
                value: interpolateColor([1, 1, 1, 1], settings),
                settings,
            };
        }

        if (node.type === "uv-map") {
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

        if (node.locked) {
            return;
        }

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

        node.position = {
            x: draggingNode.value.origin.x + point.x - draggingNode.value.start.x,
            y: draggingNode.value.origin.y + point.y - draggingNode.value.start.y,
        };

        const snapEdge = getClosestEdgeForNode(node);
        activeSnapEdgeId.value = snapEdge?.id || "";
    };

    const stopMoveNode = () => {
        const draggedNodeId = draggingNode.value?.id || "";
        const snapEdgeId = activeSnapEdgeId.value;

        draggingNode.value = null;

        window.removeEventListener("mousemove", moveNode);
        window.removeEventListener("mouseup", stopMoveNode);

        if (draggedNodeId && snapEdgeId) {
            insertNodeIntoEdge(draggedNodeId, snapEdgeId);
            return;
        }

        activeSnapEdgeId.value = "";
        requestPreviewDebounced();
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

        if (!from || !to) {
            cancelConnection();
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
            edge.to.node === to.node &&
            edge.to.socket === to.socket
        ));

        values.shader_graph.edges.push({
            id: uuid(),
            core: (
                from.node === "principled-bsdf" &&
                from.socket === "bsdf" &&
                to.node === "material-output" &&
                to.socket === "surface"
            ),
            from,
            to,
        });

        if (
            to.node === "principled-bsdf" &&
            values.bitmap_maps[to.socket]
        ) {
            syncSurfaceSlotFromShaderGraph(to.socket);
            syncNodeValuesToSurface(getGraphNode(from.node));
        }

        cancelConnection();
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

        requestPreviewDebounced();
    };

    const ensureBitmapNodeForSlot = slotKey => {
        ensureCoreNodes();

        const nodeId = `bitmap-${slotKey}`;
        const slot = values.bitmap_maps[slotKey];

        let node = getGraphNode(nodeId);

        if (!node) {
            node = {
                id: nodeId,
                type: "bitmap",
                label: `${slotKey} Bitmap`,
                locked: false,
                position: {
                    x: 70,
                    y: 80 + SURFACE_FIELDS.findIndex(field => field.key === slotKey) * 44,
                },
                inputs: {
                    uv: null,
                },
                outputs: {
                    color: { type: "color" },
                    value: { type: "float" },
                    alpha: { type: "float" },
                },
                settings: {
                    slot: slotKey,
                    layer_id: slot.layer_id,
                    url: slot.url,
                    name: slot.name,
                    channel: slot.channel,
                    strength: slot.strength,
                    offset: slot.offset,
                    invert: slot.invert,
                    blend: slot.blend,
                },
            };

            values.shader_graph.nodes.push(node);
        } else {
            node.settings = {
                ...node.settings,
                slot: slotKey,
                layer_id: slot.layer_id,
                url: slot.url,
                name: slot.name,
                channel: slot.channel,
                strength: slot.strength,
                offset: slot.offset,
                invert: slot.invert,
                blend: slot.blend,
            };
        }

        const outputSocket = Array.isArray(values.surface[slotKey])
            ? "color"
            : "value";

        const exists = values.shader_graph.edges.some(edge => (
            edge.from.node === nodeId &&
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        if (!exists) {
            values.shader_graph.edges.push({
                id: uuid(),
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

            channel: "rgba",
            strength: 1,
            offset: 0,
            invert: false,
            blend: "replace",
        };

        removeAutoBitmapNode(key);

        if (key === "baseColor") {
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

            node_id: `bitmap-${key}`,
            uv_node_id: "",

            faces: {},
            mapped_faces: [],
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

    const addShaderNode = type => {
        ensureCoreNodes();

        const id = uuid();

        const node = {
            id,
            type,
            label: {
                "uv-map": "Map UV",
                filter: "Filter",
                modifier: "Modifier",
                falloff: "Falloff",
                blend: "Blend",
                math: "Math",
                bitmap: "Bitmap",
                value: "Value",
                preview: "Viewer",
            }[type] || "Shader Node",
            locked: false,
            position: {
                x: 280,
                y: 120 + values.shader_graph.nodes.length * 30,
            },
            inputs: {
                image: null,
                value: null,
                factor: null,
            },
            outputs: {
                image: { type: "image" },
                value: { type: "float" },
                color: { type: "color" },
            },
            settings: {
                operation: type === "blend" ? "multiply" : "none",
                filter: "none",
                falloff: "smooth",
                strength: 1,
                offset: 0,
                clamp: true,
            },
        };

        values.shader_graph.nodes.push(node);
        activeShaderNodeId.value = id;
        requestPreviewDebounced();
    };

    const removeShaderNode = id => {
        const node = getGraphNode(id);

        if (!node || node.locked) {
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            edge.from.node !== id &&
            edge.to.node !== id
        ));

        values.shader_graph.nodes = values.shader_graph.nodes.filter(item => item.id !== id);

        activeShaderNodeId.value = "principled-bsdf";
        requestPreviewDebounced();
    };

    const insertNodeBetweenSurfaceSlot = (slotKey, type = "modifier") => {
        const sourceEdge = values.shader_graph.edges.find(edge => (
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        if (!sourceEdge) {
            return;
        }

        const id = uuid();

        const node = {
            id,
            type,
            label: {
                modifier: "Modifier",
                falloff: "Falloff",
                filter: "Filter",
                blend: "Blend",
                math: "Math",
                "uv-map": "Map UV",
            }[type] || "Node",
            locked: false,
            position: {
                x: 410,
                y: 100 + values.shader_graph.nodes.length * 30,
            },
            inputs: {
                image: null,
                value: null,
                factor: null,
            },
            outputs: {
                image: { type: "image" },
                value: { type: "float" },
                color: { type: "color" },
            },
            settings: {
                operation: type === "blend" ? "multiply" : "none",
                filter: "none",
                falloff: "smooth",
                strength: 1,
                offset: values.bitmap_maps[slotKey]?.offset || 0,
                clamp: true,
                slot: slotKey,
            },
        };

        values.shader_graph.nodes.push(node);
        values.shader_graph.edges = values.shader_graph.edges.filter(edge => edge.id !== sourceEdge.id);

        values.shader_graph.edges.push({
            id: uuid(),
            from: sourceEdge.from,
            to: {
                node: id,
                socket: Array.isArray(values.surface[slotKey]) ? "image" : "value",
            },
        });

        values.shader_graph.edges.push({
            id: uuid(),
            from: {
                node: id,
                socket: Array.isArray(values.surface[slotKey]) ? "color" : "value",
            },
            to: sourceEdge.to,
        });

        activeShaderNodeId.value = id;
        requestPreviewDebounced();
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
        };
    };

    const assignLayerToSelectedUvFaces = async layer => {
        if (!isUsableTextureLayer(layer)) {
            return;
        }

        selectedUvFaces.value.forEach(face => {
            assignLayerToUvFace(face, layer);
        });

        if (!values.bitmap_maps.baseColor.url) {
            assignLayerToMap("baseColor", layer);
        }

        syncUvCubeMapToShaderGraph();

        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const cloneData = value => {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    };

    const CUBE_FACE_ORDER = ["front", "back", "left", "right", "top", "bottom"];

    const getMappedUvFaces = () => {
        return CUBE_FACE_ORDER.filter(face => Boolean(values.uv.faces[face]?.bitmap?.url));
    };

    const normalizeTextureUrl = url => {
        return String(url || "").trim();
    };

    const getMappedUvTextureGroups = () => {
        const mappedFaces = getMappedUvFaces();

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

    const getPrimaryUvTextureGroup = () => {
        return getMappedUvTextureGroups()[0] || null;
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
            syncSurfaceSlotFromUvCubeMap();
            return;
        }

        values.bitmap_maps[slotKey] = {
            ...values.bitmap_maps[slotKey],
            enabled: true,
            source_type: "shader",
            node_id: sourceNode.id,
            uv_node_id: "",
            name: sourceNode.label || sourceNode.id,
            url: sourceNode.settings?.url || "",
            layer_id: sourceNode.settings?.layer_id || "",
        };
    };

    const syncSurfaceSlotFromUvCubeMap = () => {
        const mappedFaces = getMappedUvFaces();
        const textureGroups = getMappedUvTextureGroups();
        const textureMode = getUvTextureMode();
        const primaryGroup = getPrimaryUvTextureGroup();

        if (!mappedFaces.length || textureMode === "none") {
            if (
                values.bitmap_maps.baseColor?.source_type === "multitexture" ||
                values.bitmap_maps.baseColor?.uv_node_id === "uv-cubemap-layout"
            ) {
                values.bitmap_maps.baseColor = {
                    ...values.bitmap_maps.baseColor,
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
                };
            }

            return;
        }

        const firstBitmap = primaryGroup?.bitmap || {};
        const isMultiTexture = textureMode === "multitexture";

        values.bitmap_maps.baseColor = {
            ...values.bitmap_maps.baseColor,

            enabled: true,
            source_type: isMultiTexture ? "multitexture" : "single",

            layer_id: isMultiTexture ? "" : firstBitmap.layer_id || "",
            url: isMultiTexture ? "" : firstBitmap.url || "",
            name: isMultiTexture
                ? `Cube MultiTexture (${textureGroups.length} textures / ${mappedFaces.length} faces)`
                : firstBitmap.name || "SingleTexture",

            node_id: isMultiTexture
                ? "uv-cubemap-multitexture"
                : "uv-cubemap-single-bitmap",

            uv_node_id: "uv-cubemap-layout",

            faces: cloneData(values.uv.faces),
            mapped_faces: cloneData(mappedFaces),
            texture_groups: cloneData(textureGroups.map(group => ({
                url: group.url,
                name: group.bitmap?.name || group.bitmap?.layer_id || "Texture",
                layer_id: group.bitmap?.layer_id || "",
                faces: group.faces,
            }))),

            channel: values.bitmap_maps.baseColor.channel || "rgba",
            strength: values.bitmap_maps.baseColor.strength ?? 1,
            offset: values.bitmap_maps.baseColor.offset ?? 0,
            invert: values.bitmap_maps.baseColor.invert === true,
            blend: values.bitmap_maps.baseColor.blend || "replace",
        };
    };

    const removeGeneratedUvShaderNodes = () => {
        const generatedIds = values.shader_graph.nodes
            .filter(node => node.generated === true && node.system === "uv-cubemap")
            .map(node => node.id);

        if (!generatedIds.length) {
            return;
        }

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => (
            !generatedIds.includes(edge.from.node) &&
            !generatedIds.includes(edge.to.node)
        ));

        values.shader_graph.nodes = values.shader_graph.nodes.filter(node => (
            !generatedIds.includes(node.id)
        ));
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

        values.shader_graph.edges.push({
            id: uuid(),
            from,
            to,
            ...extra,
        });
    };

    const syncUvCubeMapToShaderGraph = () => {
        ensureCoreNodes();

        const mappedFaces = getMappedUvFaces();
        const textureGroups = getMappedUvTextureGroups();
        const textureMode = getUvTextureMode();

        removeGeneratedUvShaderNodes();
        syncSurfaceSlotFromUvCubeMap();

        if (!mappedFaces.length || textureMode === "none") {
            return;
        }

        const uvNodeId = "uv-cubemap-layout";

        const uvNode = {
            id: uvNodeId,
            type: "uv-map",
            label: "CubeMap UV Coordinates",
            locked: false,
            generated: true,
            system: "uv-cubemap",
            position: {
                x: 70,
                y: 430,
            },
            inputs: {},
            outputs: {
                uv: { type: "uv" },
            },
            settings: {
                mode: values.uv.mode,
                view_mode: values.uv.view_mode,
                active_face: values.uv.active_face,
                selected_faces: cloneData(values.uv.selected_faces),
                atlas: values.uv.atlas,
                texture_mode: textureMode,
                faces: cloneData(values.uv.faces),
                mapped_faces: cloneData(mappedFaces),
                texture_groups: cloneData(textureGroups.map(group => ({
                    url: group.url,
                    name: group.bitmap?.name || group.bitmap?.layer_id || "Texture",
                    layer_id: group.bitmap?.layer_id || "",
                    faces: group.faces,
                }))),
            },
        };

        values.shader_graph.nodes.push(uvNode);

        /**
         * SINGLE TEXTURE:
         * All mapped faces use the same URL.
         * Result:
         * UV Coordinates -> one Bitmap -> Principled BSDF
         */
        if (textureMode === "single") {
            const group = textureGroups[0];
            const bitmap = group.bitmap || {};
            const bitmapNodeId = "uv-cubemap-single-bitmap";

            values.shader_graph.nodes.push({
                id: bitmapNodeId,
                type: "bitmap",
                label: bitmap.name || "Cube SingleTexture",
                locked: false,
                generated: true,
                system: "uv-cubemap",
                position: {
                    x: 350,
                    y: 430,
                },
                inputs: {
                    uv: { type: "uv" },
                },
                outputs: {
                    color: { type: "color" },
                    alpha: { type: "float" },
                },
                settings: {
                    mode: "single-texture-cubemap-uv",
                    layer_id: bitmap.layer_id || "",
                    url: bitmap.url || "",
                    name: bitmap.name || "SingleTexture",
                    width: bitmap.width || 0,
                    height: bitmap.height || 0,
                    faces: cloneData(values.uv.faces),
                    mapped_faces: cloneData(mappedFaces),
                    texture_faces: cloneData(group.faces),
                },
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
                },
            );

            values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
                edge.to.node === "principled-bsdf" &&
                edge.to.socket === "baseColor"
            ));

            connectEdgeUnique(
                {
                    node: bitmapNodeId,
                    socket: "color",
                },
                {
                    node: "principled-bsdf",
                    socket: "baseColor",
                },
                {
                    generated: true,
                    system: "uv-cubemap",
                },
            );

            return;
        }

        /**
         * MULTI TEXTURE:
         * At least two different URLs exist.
         * Result:
         * UV Coordinates -> Bitmap per URL group -> MultiTexture -> Principled BSDF
         */
        const multiTextureNodeId = "uv-cubemap-multitexture";

        const multiTextureNode = {
            id: multiTextureNodeId,
            type: "multitexture",
            label: "Cube MultiTexture",
            locked: false,
            generated: true,
            system: "uv-cubemap",
            position: {
                x: 720,
                y: 430,
            },
            inputs: textureGroups.reduce((acc, group, index) => {
                acc[`texture_${index + 1}`] = { type: "color" };
                return acc;
            }, {}),
            outputs: {
                color: { type: "color" },
                alpha: { type: "float" },
            },
            settings: {
                mode: "cubemap-url-group-composite",
                atlas: values.uv.atlas,
                faces: cloneData(values.uv.faces),
                mapped_faces: cloneData(mappedFaces),
                texture_groups: cloneData(textureGroups.map((group, index) => ({
                    slot: `texture_${index + 1}`,
                    url: group.url,
                    name: group.bitmap?.name || group.bitmap?.layer_id || `Texture ${index + 1}`,
                    layer_id: group.bitmap?.layer_id || "",
                    faces: group.faces,
                }))),
            },
        };

        textureGroups.forEach((group, index) => {
            const bitmap = group.bitmap || {};
            const bitmapNodeId = `uv-texture-group-bitmap-${index + 1}`;
            const inputSocket = `texture_${index + 1}`;

            values.shader_graph.nodes.push({
                id: bitmapNodeId,
                type: "bitmap",
                label: bitmap.name || `Texture Group ${index + 1}`,
                locked: false,
                generated: true,
                system: "uv-cubemap",
                position: {
                    x: 350,
                    y: 350 + index * 92,
                },
                inputs: {
                    uv: { type: "uv" },
                },
                outputs: {
                    color: { type: "color" },
                    alpha: { type: "float" },
                },
                settings: {
                    mode: "texture-group-cubemap-uv",
                    group_index: index,
                    layer_id: bitmap.layer_id || "",
                    url: bitmap.url || "",
                    name: bitmap.name || `Texture Group ${index + 1}`,
                    width: bitmap.width || 0,
                    height: bitmap.height || 0,
                    faces: cloneData(values.uv.faces),
                    mapped_faces: cloneData(group.faces),
                },
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
                },
            );
        });

        values.shader_graph.nodes.push(multiTextureNode);

        values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === "baseColor"
        ));

        connectEdgeUnique(
            {
                node: multiTextureNodeId,
                socket: "color",
            },
            {
                node: "principled-bsdf",
                socket: "baseColor",
            },
            {
                generated: true,
                system: "uv-cubemap",
            },
        );
    };

    const selectUvLayer = async layer => {
        await assignLayerToSelectedUvFaces(layer);
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
        values.uv.view_mode = "cubemap";
        await drawUvCanvas();
    };

    const resetSelectedUvFaces = async () => {
        selectedUvFaces.value.forEach(face => {
            values.uv.faces[face] = getDefaultCubeFaceUv(face);
        });

        syncUvCubeMapToShaderGraph();

        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const syncUvAndPreview = async () => {
        syncUvCubeMapToShaderGraph();
        await drawUvCanvas();
        requestPreviewDebounced();
    };

    const loadImageFromUrl = url => {
        return new Promise(resolve => {
            if (!url) {
                resolve(null);
                return;
            }

            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => resolve(image);
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

        return {
            x: gridX + data.x * gridW,
            y: gridY + data.y * gridH,
            w: data.width * gridW,
            h: data.height * gridH,
        };
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

        return createCubeFace(face, x, y);
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

    const requestPreviewNow = () => {
        if (!selectedSourceLayer.value?.id) {
            return;
        }

        previewRequestId.value += 1;

        emitEvent("material:preview", {
            layer: selectedSourceLayer.value,
            values: normalizeValues(),
            requestId: previewRequestId.value,
        });
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

        if (isEditingMaterialLayer.value && props.layer?.id) {
            emitEvent("material:update", {
                layer: props.layer,
                values: normalizeValues(),
            });
            return;
        }

        if (!selectedSourceLayer.value?.id) {
            return;
        }

        emitEvent("material:create-cube", {
            layer: selectedSourceLayer.value,
            values: normalizeValues(),
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
        () => JSON.stringify(normalizeValues()),
        () => {
            requestPreviewDebounced();
        }
    );

    watch(
        () => JSON.stringify(values.shader_graph.nodes.map(node => ({
            id: node.id,
            settings: node.settings,
        }))),
        () => {
            syncSurfaceOffsetsFromNodes();
        }
    );

    watch(
        () => [
            values.uv.view_mode,
            values.uv.active_face,
            JSON.stringify(values.uv.faces),
        ].join("|"),
        async () => {
            syncUvCubeMapToShaderGraph();
            syncSurfaceSlotFromUvCubeMap();

            if (ui.activeTab === "uv") {
                await drawUvCanvas();
            }
        },
        { immediate: true }
    );

    watch(
        () => JSON.stringify(values.shader_graph.edges),
        () => {
            SURFACE_FIELDS.forEach(field => {
                syncSurfaceSlotFromShaderGraph(field.key);
            });
        }
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

            if (source?.id && !values.bitmap_maps.baseColor.url) {
                assignLayerToMap("baseColor", source);
            }

            ensureCoreNodes();
            requestPreviewDebounced();
        },
        { immediate: true }
    );

    onMounted(() => {
        ensureCoreNodes();
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
    });

    return {
        config,
        ui,
        values,
        previewLayer,

        tabs: TABS,
        surfaceFields: SURFACE_FIELDS,
        nodeTypes: NODE_TYPES,

        textureLayers,
        selectedSourceLayer,
        sourceLayerName,
        sourceLayerThumbnail,
        materialModeLabel,
        imageSizeLabel,
        isEditingMaterialLayer,

        uvTextureLayerId,
        uvGridMetrics,
        uvFaceLayout,
        activeUvFace,

        selectedUvFaces,
        uvViewModeLabel,
        activeUvFaceBitmap,
        activeUvFaceBitmapUrl,
        activeUvFaceBitmapName,
        activeSnapEdgeId,
        syncUvCubeMapToShaderGraph,
        syncUvAndPreview,

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
        syncNodeValuesToSurface,
        getSurfaceSlotForNode,
        getNodeValueSummary,
        getNodeConnectionSummary,
        getNodeBadge,
        resolveNodeDisplayValue,
        getNodeResolvedValueText,
        interpolateValue,
        interpolateColor,
        uvViewportRef,
        uvViewport,
        uvCanvasStyle,
        startUvPan,
        handleUvWheel,
        resetUvViewport,
        uvCanvasRef,
        drawUvCanvas,

        nodeCanvas,
        nodeWorldStyle,
        startCanvasPan,
        handleCanvasWheel,

        emitEvent,
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
        setActiveUvFace,
        resetActiveUvFace,

        addShaderNode,
        removeShaderNode,
        insertNodeBetweenSurfaceSlot,

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
};