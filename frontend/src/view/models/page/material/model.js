import {computed, onBeforeUnmount, onMounted, reactive, ref, watch,} from "vue";
import {clamp} from "@/utils/tools";
import {uuid} from "@/utils/uuid";

const PREVIEW_DEBOUNCE_MS = 220;

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
    { key: "light", title: "Light", icon: "mdi-lightbulb-spot" },
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
    { key: "subsurfaceScale", label: "Subsurface Scale", type: "number", min: 0, max: 50, step: 0.01 },
    { key: "subsurfaceIor", label: "Subsurface IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "subsurfaceAnisotropy", label: "Subsurface Anisotropy", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "metallic", label: "Metallic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specular", label: "Specular IOR Level", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specularTint", label: "Specular Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "roughness", label: "Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "diffuseRoughness", label: "Diffuse Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropic", label: "Anisotropic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropicRotation", label: "Anisotropic Rotation", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheen", label: "Sheen", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenRoughness", label: "Sheen Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenTint", label: "Sheen Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoat", label: "Coat Weight", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatRoughness", label: "Coat Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "coatIor", label: "Coat IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "coatTint", label: "Coat Tint", type: "color" },
    { key: "ior", label: "IOR", type: "number", min: 1, max: 4, step: 0.001 },
    { key: "transmission", label: "Transmission Weight", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "transmissionRoughness", label: "Transmission Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "emission", label: "Emission", type: "color" },
    { key: "emissionStrength", label: "Emission Strength", type: "number", min: 0, max: 10, step: 0.01 },
    { key: "thinFilmThickness", label: "Thin Film Thickness", type: "number", min: 0, max: 1200, step: 1 },
    { key: "thinFilmIor", label: "Thin Film IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "alpha", label: "Alpha", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "normal", label: "Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatNormal", label: "Clearcoat Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "tangent", label: "Tangent", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "bumpStrength", label: "Bump / Height", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "displacementStrength", label: "Displacement Height", type: "number", min: 0, max: 1, step: 0.001, hidden: true },
];

const SURFACE_FIELD_MAP = SURFACE_FIELDS.reduce((acc, field) => {
    acc[field.key] = field;
    return acc;
}, {});

const PRINCIPLED_SURFACE_GROUPS = [
    {
        key: "baseColor",
        label: "Base Color",
        relation: "Diffuse, subsurface, metal and transmission color",
    },
    {
        key: "metallic",
        label: "Metallic",
        relation: "Dielectric to metal reflection blend",
    },
    {
        key: "roughness",
        label: "Roughness",
        relation: "Specular and transmission microfacet roughness",
    },
    {
        key: "ior",
        label: "IOR",
        relation: "Specular and transmission refraction index",
    },
    {
        key: "alpha",
        label: "Alpha",
        relation: "Surface opacity / texture alpha mask",
    },
    {
        key: "normal",
        label: "Normal",
        relation: "Base layer normal response",
    },
    {
        key: "subsurface",
        label: "Subsurface",
        relation: "Weight -> Radius -> Scale -> IOR -> Anisotropy",
        affects: ["subsurfaceRadius", "subsurfaceColor", "subsurfaceScale", "subsurfaceIor", "subsurfaceAnisotropy"],
    },
    {
        key: "specular",
        label: "Specular",
        relation: "IOR Level -> Tint -> Anisotropic -> Anisotropic Rotation -> Tangent",
        affects: ["specularTint", "anisotropic", "anisotropicRotation", "tangent"],
    },
    {
        key: "transmission",
        label: "Transmission",
        relation: "Weight",
        affects: ["transmissionRoughness"],
    },
    {
        key: "clearcoat",
        label: "Coat",
        relation: "Weight -> Roughness -> IOR -> Tint -> Normal",
        affects: ["clearcoatRoughness", "coatIor", "coatTint", "clearcoatNormal"],
    },
    {
        key: "sheen",
        label: "Sheen",
        relation: "Weight -> Roughness -> Tint",
        affects: ["sheenRoughness", "sheenTint"],
    },
    {
        key: "emission",
        label: "Emission",
        relation: "Color -> Strength -> Tint",
        affects: ["emissionStrength"],
    },
].map(group => ({
    ...group,
    field: SURFACE_FIELD_MAP[group.key],
}));

const PRINCIPLED_NODE_INPUT_KEYS = PRINCIPLED_SURFACE_GROUPS.map(group => group.key);

const NODE_TYPES = [
    { type: "principled", label: "Principled BSDF", group: "Shader", icon: "mdi-material-design" },
    { type: "output", label: "Output", group: "Output", icon: "mdi-export" },

    { type: "modifier", label: "Combine XYZ", group: "Vector", icon: "mdi-vector-polyline" },
    { type: "blend", label: "Mix", group: "Vector", icon: "mdi-vector-combine" },
    { type: "modifier", label: "Separate XYZ", group: "Vector", icon: "mdi-vector-difference" },
    { type: "uv-map", label: "Mapping", group: "Vector", icon: "mdi-vector-square" },

    { type: "filter", label: "Blackbody", group: "Color", icon: "mdi-thermometer" },
    { type: "filter", label: "Brightness/Contrast", group: "Color", icon: "mdi-brightness-6" },
    { type: "filter", label: "Color Ramp", group: "Color", icon: "mdi-gradient-horizontal" },
    { type: "filter", label: "Gamma", group: "Color", icon: "mdi-chart-bell-curve" },
    { type: "filter", label: "Hue/Saturation/Value", group: "Color", icon: "mdi-palette" },
    { type: "filter", label: "Invert Color", group: "Color", icon: "mdi-invert-colors" },
    { type: "blend", label: "Mix Color", group: "Color", icon: "mdi-blender-software" },
    { type: "modifier", label: "Combine Color", group: "Color", icon: "mdi-format-color-fill" },
    { type: "modifier", label: "Separate Color", group: "Color", icon: "mdi-format-color-highlight" },
    { type: "filter", label: "RGB to BW", group: "Color", icon: "mdi-circle-half-full" },

    { type: "math", label: "Clamp", group: "Math", icon: "mdi-lock-outline" },
    { type: "math", label: "Float Curve", group: "Math", icon: "mdi-chart-bell-curve-cumulative" },
    { type: "math", label: "Math", group: "Math", icon: "mdi-function" },
    { type: "blend", label: "Mix", group: "Math", icon: "mdi-set-merge" },

    { type: "bitmap", label: "Bitmap", group: "Texture", icon: "mdi-image" },
    { type: "multitexture", label: "MultiTexture", group: "Texture", icon: "mdi-image-multiple" },
];

const TEXTURE_CHANNEL_OPTIONS = ["rgba", "rgb"];
const TEXTURE_COLOR_MODE_OPTIONS = ["color", "bw"];

const TEXTURE_SETTING_DEFAULTS = Object.freeze({
    channel: "rgba",
    color_mode: "color",
});

const BW_TEXTURE_SLOTS = Object.freeze([
    "subsurface",
    "subsurfaceScale",
    "subsurfaceIor",
    "subsurfaceAnisotropy",
    "metallic",
    "specular",
    "specularTint",
    "roughness",
    "diffuseRoughness",
    "anisotropic",
    "anisotropicRotation",
    "sheen",
    "sheenRoughness",
    "sheenTint",
    "clearcoat",
    "clearcoatRoughness",
    "coatIor",
    "ior",
    "transmission",
    "transmissionRoughness",
    "emissionStrength",
    "thinFilmThickness",
    "thinFilmIor",
    "alpha",
    "normal",
    "clearcoatNormal",
    "tangent",
    "bumpStrength",
    "displacementStrength",
]);

const getTextureSettingDefaults = slotKey => ({
    ...TEXTURE_SETTING_DEFAULTS,
    color_mode: BW_TEXTURE_SLOTS.includes(slotKey) ? "bw" : "color",
});

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

const createSurface = () => ({
    baseColor: [1, 1, 1, 1],
    subsurface: 0,
    subsurfaceRadius: [1, 0.2, 0.1],
    subsurfaceColor: [1, 1, 1, 1],
    subsurfaceScale: 1,
    subsurfaceIor: 1.45,
    subsurfaceAnisotropy: 0,
    metallic: 0,
    specular: 0.5,
    specularTint: 0,
    roughness: 0.5,
    diffuseRoughness: 0,
    anisotropic: 0,
    anisotropicRotation: 0,
    sheen: 0,
    sheenRoughness: 0.5,
    sheenTint: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.03,
    coatIor: 1.5,
    coatTint: [1, 1, 1, 1],
    ior: 1.45,
    transmission: 0,
    transmissionRoughness: 0,
    emission: [0, 0, 0, 1],
    emissionStrength: 0,
    thinFilmThickness: 0,
    thinFilmIor: 1.33,
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

const createLight = () => ({
    enabled: true,
    lightType: "sun",
    mode: "sun",
    intensity: 1,
    ambient: 0.34,
    softness: 0.32,
    color: "#fff4e6",
    ambient_color: "#b3c7e6",
    environment_color: "#b8d1ff",
    range: 4,
    radius: 0.25,
    decay: 2,
    innerCone: 0.35,
    outerCone: 0.75,
    castShadow: false,
    temperature: 6500,
    position_x: 0,
    position_y: 1.4,
    position_z: 2.8,
    direction_x: -0.35,
    direction_y: -0.65,
    direction_z: 0.72,
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
            texture_groups: [],

            filename: "",
            cached: false,
            ...mergeTextureSettingsForSlot(field.key),
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
        ...TEXTURE_SETTING_DEFAULTS,
    },
});

const createUv = () => ({
    mode: "cubemap",
    view_mode: "cubemap",
    active_face: "front",
    selected_faces: ["front"],
    atlas: "cross",

    target_slot: "baseColor",
    target_slots: ["baseColor"],

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
    inputs: PRINCIPLED_NODE_INPUT_KEYS.reduce((acc, key) => {
        const field = SURFACE_FIELD_MAP[key];
        acc[field.key] = {
            type: Array.isArray(createSurface()[field.key]) ? "color" : "float",
            relation: PRINCIPLED_SURFACE_GROUPS.find(group => group.key === key)?.relation || "",
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

    if (Array.isArray(slot.texture_groups) && slot.texture_groups.some(group => group?.url || group?.layer_id)) {
        return true;
    }

    return false;
};

const TEXTURE_SIZE_OPTIONS = [32, 64, 128, 256, 512, 1024, "Original"];

const normalizeTextureSize = value => {
    if (value === "Original" || value === "original" || value === null || value === undefined || value === "") {
        return "Original";
    }

    const number = Number(value);

    return TEXTURE_SIZE_OPTIONS.includes(number) ? number : "Original";
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
        light: createLight(),
        bitmap_maps: createBitmapMaps(),
        uv: createUv(),
        shader_graph: createShaderGraph(),

        cube_size: 256,
        rotate_preview: true,
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
            layer.masked ||
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
            layer.thumbnail ||
            resolveLayerTextureUrl(layer)
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
        return resolveLayerThumbnailUrl(selectedSourceLayer.value);
    });

    const sourceLayerTextureUrl = computed(() => {
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
            ...TEXTURE_SETTING_DEFAULTS,
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
            ...TEXTURE_SETTING_DEFAULTS,
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

        if (["offset", "strength", "channel", "color_mode", "invert", "blend"].includes(key)) {
            syncNodeValuesToSurface(node);
            syncSurfaceOffsetsFromNodes();
        }

        syncNodeValuesToSurface(node);
        requestPreviewDebounced();
    };

    const updateNodeTextureGroupSetting = (node, index, key, value) => {
        if (!node || node.type !== "multitexture") {
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

        syncNodeValuesToSurface(node);
        syncSurfaceOffsetsFromNodes();
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

            faces: settings.faces || values.bitmap_maps[slotKey].faces || {},
            mapped_faces: settings.mapped_faces || values.bitmap_maps[slotKey].mapped_faces || [],
            texture_groups: settings.texture_groups || values.bitmap_maps[slotKey].texture_groups || [],
            ...mergeTextureSettingsForSlot(slotKey, values.bitmap_maps[slotKey], settings),
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

    const normalizeValues = () => ({
        name: values.name || "Cube Material",

        surface: clonePlain(values.surface),
        geometry: clonePlain(values.geometry),
        light: clonePlain(values.light),
        bitmap_maps: sanitizeSurfaceBitmapMaps(values.bitmap_maps),
        uv: clonePlain(values.uv),
        shader_graph: {
            ...clonePlain(values.shader_graph),
            material_connected: materialConnected.value,
        },

        cube_size: clamp(Number(values.cube_size || 256), 64, 4096),
        rotate_preview: values.rotate_preview === true,
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

    const previewLayer = computed(() => {
        const normalized = normalizeValues();
        const backendLayer = getBackendPreviewLayer(normalized);

        if (backendLayer) {
            const previewLight = {
                ...normalized.light,
                editing: ui.activeTab === "light",
            };

            return {
                ...backendLayer,
                id: `preview-${props.layer?.id || selectedSourceLayer.value?.id || "material"}`,
                source: selectedSourceLayer.value?.id || props.layer?.id || backendLayer.source || "",
                source_layer_id: selectedSourceLayer.value?.id || props.layer?.id || backendLayer.source_layer_id || "",
                light: previewLight,
                shader: {
                    ...(backendLayer.shader || {}),
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
                    light: previewLight,
                    light_editing: ui.activeTab === "light",
                    render_backend: normalized.render_backend,
                },
                render_backend: normalized.render_backend,
                time: backendLayer.time || previewStableTime.value,
            };
        }

        const previewLight = {
            ...normalized.light,
            editing: ui.activeTab === "light",
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
            light: previewLight,
            bitmap_maps: normalized.bitmap_maps,
            uv: normalized.uv,
            shader_graph: normalized.shader_graph,

            material: {
                surface: normalized.surface,
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
                light_editing: ui.activeTab === "light",
                texture_size: normalized.texture_size,
                texture_preload: normalized.texture_preload,
            },

            texture_size: normalized.texture_size,
            texture_preload: normalized.texture_preload,
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
            sockets.find(socket => ["image", "color", "value", "factor", "vector", "surface"].includes(socket)) ||
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
            sockets.find(socket => ["color", "image", "value", "vector", "bsdf"].includes(socket)) ||
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

        if (
            to.node === "principled-bsdf" &&
            values.bitmap_maps[to.socket]
        ) {
            syncSurfaceSlotFromShaderGraph(to.socket);
            syncNodeValuesToSurface(getGraphNode(from.node));
        }

        cancelConnection();
        reconcileShaderGraph();
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
                    ...mergeTextureSettingsForSlot(slotKey, slot),
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
                ...mergeTextureSettingsForSlot(slotKey, slot),
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

    const pruneDisconnectedAutoBitmapNodes = () => {
        const connectedNodeIds = new Set(
            values.shader_graph.edges.map(edge => edge.from.node)
        );

        SURFACE_FIELDS.forEach(field => {
            const nodeId = `bitmap-${field.key}`;
            const node = getGraphNode(nodeId);

            if (node && !connectedNodeIds.has(nodeId)) {
                values.shader_graph.nodes = values.shader_graph.nodes.filter(item => item.id !== nodeId);
            }
        });
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

        if (node.type === "principled" && socket === "bsdf" && direction === "output") {
            return "shader";
        }

        if (node.type === "output" && socket === "surface" && direction === "input") {
            return "shader";
        }

        return "";
    };

    const canConnectSockets = (from, to) => {
        const fromType = getSocketType(from.node, from.socket, "output");
        const toType = getSocketType(to.node, to.socket, "input");

        if (!fromType || !toType) {
            return true;
        }

        if (to.node === "material-output" && to.socket === "surface") {
            return fromType === "shader" && toType === "shader";
        }

        if (to.node === "principled-bsdf") {
            if (to.socket === "surface") {
                return fromType === "shader";
            }

            if (["color", "image"].includes(fromType) && ["color", "float"].includes(toType)) {
                return true;
            }

            if (["float", "value"].includes(fromType) && ["float", "color"].includes(toType)) {
                return true;
            }
        }

        if (fromType === toType) {
            return true;
        }

        return ["color", "image", "float", "value", "vector"].includes(fromType) &&
            ["color", "image", "float", "value", "vector"].includes(toType);
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
            if (node.id === "principled-bsdf" || node.type === "principled") {
                const base = createPrincipledNode();

                return {
                    ...base,
                    ...node,
                    id: "principled-bsdf",
                    type: "principled",
                    locked: node.locked === true,
                    position: getNodePosition(node, base.position),
                    inputs: base.inputs,
                    outputs: base.outputs,
                    settings: {
                        ...base.settings,
                        ...(node.settings || {}),
                    },
                };
            }

            if (node.id === "material-output" || node.type === "output") {
                const base = createOutputNode();

                return {
                    ...base,
                    ...node,
                    id: "material-output",
                    type: "output",

                    // Wichtig: Output bleibt bewegbar.
                    locked: node.locked === true ? true : false,

                    position: getNodePosition(node, base.position),
                    inputs: base.inputs,
                    outputs: {},
                    settings: {
                        ...base.settings,
                        ...(node.settings || {}),
                    },
                };
            }

            return {
                ...node,
                locked: node.locked === true,
                position: getNodePosition(node, node.position || { x: 280, y: 140 }),
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
        }

        applyRememberedNodePositions();
    };

    const getNodeDescriptor = nodeType => {
        if (typeof nodeType === "object" && nodeType) {
            return nodeType;
        }

        return NODE_TYPES.find(item => item.type === nodeType) || { type: nodeType, label: "Shader Node" };
    };

    const createShaderNodeIO = label => {
        const lowerLabel = String(label || "").toLowerCase();

        if (lowerLabel === "combine xyz") {
            return {
                inputs: { x: { type: "float" }, y: { type: "float" }, z: { type: "float" } },
                outputs: { vector: { type: "vector" }, value: { type: "float" } },
            };
        }

        if (lowerLabel === "separate xyz") {
            return {
                inputs: { vector: { type: "vector" } },
                outputs: { x: { type: "float" }, y: { type: "float" }, z: { type: "float" } },
            };
        }

        if (lowerLabel === "combine color") {
            return {
                inputs: { red: { type: "float" }, green: { type: "float" }, blue: { type: "float" }, alpha: { type: "float" } },
                outputs: { color: { type: "color" }, value: { type: "float" } },
            };
        }

        if (lowerLabel === "separate color") {
            return {
                inputs: { color: { type: "color" } },
                outputs: { red: { type: "float" }, green: { type: "float" }, blue: { type: "float" }, alpha: { type: "float" } },
            };
        }

        if (lowerLabel === "mapping") {
            return {
                inputs: { vector: { type: "vector" } },
                outputs: { vector: { type: "vector" }, image: { type: "image" } },
            };
        }

        if (["blackbody", "rgb to bw"].includes(lowerLabel)) {
            return {
                inputs: lowerLabel === "blackbody" ? { temperature: { type: "float" } } : { bitmap: { type: "image" } },
                outputs: { color: { type: "color" }, value: { type: "float" } },
            };
        }

        return {
            inputs: {
                image: { type: "image" },
                value: { type: "float" },
                factor: { type: "float" },
            },
            outputs: {
                image: { type: "image" },
                value: { type: "float" },
                color: { type: "color" },
            },
        };
    };

    const addShaderNode = nodeType => {
        const descriptor = getNodeDescriptor(nodeType);
        const type = descriptor.type;

        if (type === "principled") {
            if (!getGraphNode("principled-bsdf")) {
                values.shader_graph.nodes.push(createPrincipledNode());
            }

            activeShaderNodeId.value = "principled-bsdf";
            reconcileShaderGraph();
            requestPreviewDebounced();
            return;
        }

        if (type === "output") {
            let node = getGraphNode("material-output");

            if (!node) {
                node = createOutputNode();
                node.locked = false;
                values.shader_graph.nodes.push(node);
            } else {
                node.locked = false;
                node.position = getNodePosition(node, node.position || createOutputNode().position);
            }

            activeShaderNodeId.value = "material-output";
            reconcileShaderGraph();
            requestPreviewDebounced();
            return;
        }

        ensureCoreNodes();

        const id = uuid('shader-node');
        const nodeIO = createShaderNodeIO(descriptor.label);

        const node = {
            id,
            type,
            label: descriptor.label || "Shader Node",
            locked: false,
            position: {
                x: 280,
                y: 120 + values.shader_graph.nodes.length * 30,
            },
            inputs: nodeIO.inputs,
            outputs: nodeIO.outputs,
            settings: {
                node_name: descriptor.label || type,
                group: descriptor.group || "",
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

        if (!node) {
            return;
        }

        if (node.id === "material-output" || node.type === "output" || node.locked) {
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

    const insertNodeBetweenSurfaceSlot = (slotKey, type = "modifier") => {
        const sourceEdge = values.shader_graph.edges.find(edge => (
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        if (!sourceEdge) {
            return;
        }

        const id = uuid('shader-node');

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
            id: uuid('shader-node'),
            from: sourceEdge.from,
            to: {
                node: id,
                socket: Array.isArray(values.surface[slotKey]) ? "image" : "value",
            },
        });

        values.shader_graph.edges.push({
            id: uuid('shader-node'),
            from: {
                node: id,
                socket: Array.isArray(values.surface[slotKey]) ? "color" : "value",
            },
            to: sourceEdge.to,
        });

        activeShaderNodeId.value = id;
        reconcileShaderGraph();
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
        values.light = {
            ...createLight(),
            ...(cloneData(source.light || source.settings?.light || source.shader?.light || {})),
        };
        values.bitmap_maps = mergeBitmapMaps(cloneData(source.bitmap_maps || source.material?.bitmap_maps || {}));
        values.uv = {
            ...createUv(),
            ...(cloneData(source.uv || {})),
            faces: {
                ...createUv().faces,
                ...(cloneData(source.uv?.faces || {})),
            },
        };
        values.shader_graph = {
            ...createShaderGraph(),
            ...(cloneData(source.shader_graph || source.shader?.graph || {})),
        };
        rememberAllNodePositions();
        values.cube_size = Number(source.settings?.cube_size || values.cube_size || 256);
        values.texture_size = normalizeTextureSize(
            source?.settings?.texture_size ??
            source?.texture_size ??
            source?.material?.material_settings?.texture_size ??
            "Original"
        );
        values.texture_preload = TEXTURE_SIZE_OPTIONS;
        values.rotate_preview = source.preview?.rotate ?? source.preview?.idle_rotation?.enabled ?? values.rotate_preview;
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

        if (node.type === "bitmap") {
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

        if (node.type === "multitexture") {
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
            "color",
            "value",
            "factor",
            "uv",
            "surface",
            "texture",
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

    const prepareMaterialValues = () => {
        pauseAutoSync.value = true;

        try {
            ensureCoreNodes();

            // Wichtig: Source-Layer als echte BaseColor-Map in den Contract schreiben.
            ensureBaseColorSourceTexture();

            // UV zuerst in bitmap_maps schreiben.
            syncUvToActiveSlots();

            // Danach UV-Nodes aus aktuellen bitmap_maps / uv erzeugen.
            syncUvCubeMapToShaderGraph();

            // Graph bereinigen und Slot-Zustände ableiten.
            reconcileShaderGraph();
            syncAllSurfaceSlotsFromShaderGraph();
            syncSurfaceOffsetsFromNodes();

            pruneDisconnectedAutoBitmapNodes();

            return normalizeValues();
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

        const faces = values.uv.faces || {};
        const groups = new Map();
        const mappedFaces = [];

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
            id: uuid('shader-node'),
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
        const targetSlots = getUvTargetSlots();
        const primarySlotKey = targetSlots[0] || "baseColor";
        const primarySlot = values.bitmap_maps[primarySlotKey] || {};
        const primaryTextureSettings = mergeTextureSettingsForSlot(primarySlotKey, primarySlot);
        rememberAllNodePositions();
        const preservedUvNodePositions = getGeneratedUvNodePositions();

        removeGeneratedUvShaderNodes();
        syncUvToActiveSlots();

        if (!mappedFaces.length || textureMode === "none") {
            return;
        }

        targetSlots.forEach(removeAutoBitmapNode);

        const uvNodeId = "uv-cubemap-layout";

        const uvNode = {
            id: uvNodeId,
            type: "uv-map",
            label: "CubeMap UV Coordinates",
            locked: false,
            generated: true,
            system: "uv-cubemap",
            position: getPreservedNodePosition(
                preservedUvNodePositions,
                uvNodeId,
                getNodePosition(
                    getGraphNode(uvNodeId),
                    { x: 70, y: 430 }
                ),
            ),
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
                target_slot: primarySlotKey,
                target_slots: cloneData(targetSlots),
                texture_mode: textureMode,
                faces: cloneData(values.uv.faces),
                mapped_faces: cloneData(mappedFaces),
                texture_groups: cloneData(textureGroups.map(group => ({
                    url: group.url,
                    name: group.bitmap?.name || group.bitmap?.layer_id || "Texture",
                    layer_id: group.bitmap?.layer_id || "",
                    filename: group.bitmap?.filename || "",
                    cached: group.bitmap?.cached === true,
                    ...mergeTextureSettingsForSlot(primarySlotKey, primaryTextureSettings, group.bitmap),
                    faces: group.faces,
                }))),
            },
        };

        values.shader_graph.nodes.push(uvNode);

        const connectGeneratedOutputToSlots = sourceNodeId => {
            values.shader_graph.edges = values.shader_graph.edges.filter(edge => !(
                edge.to.node === "principled-bsdf" &&
                targetSlots.includes(edge.to.socket)
            ));

            targetSlots.forEach(slotKey => {
                connectEdgeUnique(
                    {
                        node: sourceNodeId,
                        socket: "color",
                    },
                    {
                        node: "principled-bsdf",
                        socket: slotKey,
                    },
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
                type: "bitmap",
                label: bitmap.name || "Cube SingleTexture",
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
                inputs: {
                    uv: { type: "uv" },
                },
                outputs: {
                    color: { type: "color" },
                    alpha: { type: "float" },
                },
                settings: {
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

            connectGeneratedOutputToSlots(bitmapNodeId);
            reconcileShaderGraph();
            return;
        }

        const multiTextureNodeId = "uv-cubemap-multitexture";

        const multiTextureNode = {
            id: multiTextureNodeId,
            type: "multitexture",
            label: "Cube MultiTexture",
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
            settings: {
                mode: "cubemap-url-group-composite",
                slot: primarySlotKey,
                target_slot: primarySlotKey,
                target_slots: cloneData(targetSlots),
                ...primaryTextureSettings,
                atlas: values.uv.atlas,
                faces: cloneData(values.uv.faces),
                mapped_faces: cloneData(mappedFaces),
                texture_groups: cloneData(textureGroups.map((group, index) => ({
                    slot: `texture_${index + 1}`,
                    url: group.url,
                    name: group.bitmap?.name || group.bitmap?.layer_id || `Texture ${index + 1}`,
                    layer_id: group.bitmap?.layer_id || "",
                    filename: group.bitmap?.filename || "",
                    cached: group.bitmap?.cached === true,
                    ...mergeTextureSettingsForSlot(primarySlotKey, primaryTextureSettings, group.bitmap),
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
                position: getPreservedNodePosition(
                    preservedUvNodePositions,
                    bitmapNodeId,
                    getNodePosition(
                        getGraphNode(bitmapNodeId),
                        { x: 350, y: 350 + index * 92 }
                    ),
                ),
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
        connectGeneratedOutputToSlots(multiTextureNodeId);
        reconcileShaderGraph();
        applyRememberedNodePositions();
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
            values: prepareMaterialValues(),
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
        light: values.light,
        bitmap_maps: values.bitmap_maps,
        uv: values.uv,
        shader_graph: values.shader_graph,
        cube_size: values.cube_size,
        rotate_preview: values.rotate_preview,
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
            ui.activeTab,
            values.uv.view_mode,
            values.uv.active_face,
            JSON.stringify(values.uv.faces),
        ].join("|"),
        async () => {
            if (pauseAutoSync.value) {
                return;
            }

            if (ui.activeTab === "uv") {
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
        surfaceGroups: PRINCIPLED_SURFACE_GROUPS,
        nodeTypes: NODE_TYPES,
        textureChannelOptions: TEXTURE_CHANNEL_OPTIONS,
        textureColorModeOptions: TEXTURE_COLOR_MODE_OPTIONS,
        textureSizeOptions: TEXTURE_SIZE_OPTIONS,

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
    materialPreview: {
        type: Object,
        required: false,
        default: null,
    },
};
