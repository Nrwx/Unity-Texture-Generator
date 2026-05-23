import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { clamp, clone } from "@/utils/tools";
import { uuid } from "@/utils/uuid";
import { Node } from "@/view/models/page/material/core/Node/Node";
import {
    createBitmapMaps,
    createOutputNode,
    createPrincipledNode,
    createShaderGraph,
    createShaderNode,
    createSurface,
    SURFACE_FIELD_MAP,
    SURFACE_FIELDS,
    TEXTURE_CHANNEL_OPTIONS,
    TEXTURE_COLOR_MODE_OPTIONS,
    getTextureSettingDefaults,
} from "@/dataLayer/webgl";

const normalizeNodeSettings = node => Node.normalizeSettings(node);
const getShaderNodeFieldItems = node => Node.getFieldItems(node);
const getShaderNodeFieldOptions = (node, fieldKey) => Node.getFieldOptions(node, fieldKey);
const getNodeCategoryChip = node => Node.getGroup(node);
const getShaderNodeIcon = node => Node.getIcon(node);

const cloneData = value => clone(value, "json");

const normalizeTextureSettings = (settings = {}) => {
    const slotKey = settings.slot || settings.target_slot;
    const defaults = getTextureSettingDefaults(slotKey);

    const rawStrength = Number.isFinite(Number(settings.strength))
        ? Number(settings.strength)
        : 1;

    const strength = settings.invert === true && rawStrength > 0
        ? -rawStrength
        : rawStrength;

    return {
        channel: TEXTURE_CHANNEL_OPTIONS.includes(settings.channel)
            ? settings.channel
            : defaults.channel,
        color_mode: TEXTURE_COLOR_MODE_OPTIONS.includes(settings.color_mode)
            ? settings.color_mode
            : defaults.color_mode,
        strength,
        offset: Number.isFinite(Number(settings.offset)) ? Number(settings.offset) : 0,
        invert: false,
        blend: settings.blend || "replace",
    };
};

const mergeTextureSettings = (...sources) => normalizeTextureSettings(
    sources.reduce((acc, source) => ({
        ...acc,
        ...(source || {}),
    }), {})
);

const mergeTextureSettingsForSlot = (slotKey, ...sources) => mergeTextureSettings(
    getTextureSettingDefaults(slotKey),
    { slot: slotKey },
    ...sources,
);

export const shaderModelProps = {
    shaderGraph: {
        type: Object,
        required: false,
        default: () => createShaderGraph(),
    },
    surface: {
        type: Object,
        required: false,
        default: () => createSurface(),
    },
    bitmapMaps: {
        type: Object,
        required: false,
        default: () => createBitmapMaps(),
    },
    uv: {
        type: Object,
        required: false,
        default: () => ({}),
    },
    textureLayers: {
        type: Array,
        required: false,
        default: () => [],
    },
    selectedSourceLayer: {
        type: Object,
        required: false,
        default: null,
    },
    layer: {
        type: Object,
        required: false,
        default: null,
    },
};

export function shaderModel(props, emit) {
    const nodeCanvasRef = ref(null);
    const activeConnection = ref(null);
    const pointerPosition = ref({ x: 0, y: 0 });
    const draggingNode = ref(null);
    const activeShaderNodeId = ref("principled-bsdf");
    const activeSnapEdgeId = ref("");
    const draggingSourceLayerId = ref("");

    const SNAP_EDGE_DISTANCE = 34;

    const nodePositionMemory = reactive({});
    const collapsedNodeIds = reactive({});
    const nodeLayoutVersion = ref(0);
    const socketOffsetMemory = {};

    const nodeCanvas = reactive({
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
    });

    const ui = reactive({
        activeNodeCategory: "",
        nodeContextMenu: {
            open: false,
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            category: "Math",
        },
    });

    /**
     * Template-Kompatibilität:
     * Dein 1:1 kopiertes Template nutzt values.shader_graph.nodes.
     * Deshalb wird hier derselbe Zugriff bereitgestellt, aber auf Props gemappt.
     */
    const values = {
        get shader_graph() {
            return props.shaderGraph;
        },
        get surface() {
            return props.surface;
        },
        get bitmap_maps() {
            return props.bitmapMaps;
        },
        get uv() {
            return props.uv;
        },
    };

    const emitShaderGraph = () => {
        emit("update:shaderGraph", cloneData(props.shaderGraph));
    };

    const emitSurface = () => {
        emit("update:surface", cloneData(props.surface));
    };

    const emitBitmapMaps = () => {
        emit("update:bitmapMaps", cloneData(props.bitmapMaps));
    };

    const emitUv = () => {
        emit("update:uv", cloneData(props.uv));
    };

    const emitChange = () => {
        emit("change", {
            shader_graph: cloneData(props.shaderGraph),
            surface: cloneData(props.surface),
            bitmap_maps: cloneData(props.bitmapMaps),
            uv: cloneData(props.uv),
        });
    };

    const emitPreview = () => {
        emit("request-preview");
    };

    const emitAll = () => {
        emitShaderGraph();
        emitSurface();
        emitBitmapMaps();
        emitUv();
        emitChange();
        emitPreview();
    };

    const emitSyncRequest = (event, payload = {}) => {
        emit(event, {
            ...payload,
            shader_graph: cloneData(props.shaderGraph),
            surface: cloneData(props.surface),
            bitmap_maps: cloneData(props.bitmapMaps),
            uv: cloneData(props.uv),
        });
    };

    const nodeWorldStyle = computed(() => ({
        transform: `translate(${nodeCanvas.panX}px, ${nodeCanvas.panY}px) scale(${nodeCanvas.zoom})`,
        transformOrigin: "0 0",
    }));

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

    const materialConnected = computed(() => (
        props.shaderGraph.edges.some(edge => (
            edge.from.node === "principled-bsdf" &&
            edge.from.socket === "bsdf" &&
            edge.to.node === "material-output" &&
            edge.to.socket === "surface"
        ))
    ));

    const activeShaderNode = computed(() => (
        getGraphNode(activeShaderNodeId.value)
    ));

    const getGraphNode = id => (
        props.shaderGraph.nodes.find(node => node.id === id)
    );

    const getNodeEdgesIn = nodeId => (
        props.shaderGraph.edges.filter(edge => edge.to.node === nodeId)
    );

    const getNodeEdgesOut = nodeId => (
        props.shaderGraph.edges.filter(edge => edge.from.node === nodeId)
    );

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
        props.shaderGraph.nodes.forEach(node => {
            rememberNodePosition(node);
        });
    };

    const applyRememberedNodePositions = () => {
        props.shaderGraph.nodes.forEach(node => {
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

    const isUsableTextureLayer = layer => {
        if (!layer || layer.hidden === 1) {
            return false;
        }

        return [0, 2].includes(Number(layer.type));
    };

    const getSocketDefinition = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);
        const sockets = direction === "input"
            ? node?.inputs || {}
            : node?.outputs || {};

        return sockets[socket] || null;
    };

    const getNodeSocketLabel = (nodeId, socket, direction) => {
        const node = getGraphNode(nodeId);
        const sockets = direction === "input"
            ? node?.inputs || {}
            : node?.outputs || {};
        const definition = sockets[socket];

        return definition?.label || socket;
    };

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

        if (
            node.settings?.node_key === "shader.principled" &&
            socket === "bsdf" &&
            direction === "output"
        ) {
            return "shader";
        }

        if (
            node.settings?.node_key === "output.material" &&
            socket === "surface" &&
            direction === "input"
        ) {
            return "shader";
        }

        return "";
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

    const nodeValueContext = () => ({
        surfaceFieldMap: SURFACE_FIELD_MAP,
        surfaceDefaults: createSurface(),
    });

    const coerceSocketValue = (value, socketType = "float", slotKey = "") => (
        Node.coerceSocketValue(value, socketType, slotKey, nodeValueContext())
    );

    const resolveNodeDisplayValue = node => Node.resolveDisplayValue(node);
    const getNodeResolvedValueText = node => Node.getResolvedValueText(node);

    const resolveNodeOutputValue = (nodeId, socket = "", seen = new Set()) => (
        Node.resolveOutputValue(props.shaderGraph, nodeId, socket, seen)
    );

    const ensureNodeSettings = node => {
        if (!node) {
            return {};
        }

        node.settings = normalizeNodeSettings(node);

        return node.settings;
    };

    const getNodeTargetSlotFromSettings = node => {
        const settings = node?.settings || {};
        const candidates = [
            settings.slot,
            settings.target_slot,
            ...(Array.isArray(settings.target_slots) ? settings.target_slots : []),
        ];

        return candidates.find(slotKey => Boolean(props.bitmapMaps[slotKey])) || "";
    };

    const getDirectSurfaceSlotForNode = nodeId => {
        const edge = props.shaderGraph.edges.find(item => (
            item.from.node === nodeId &&
            item.to.node === "principled-bsdf" &&
            props.bitmapMaps[item.to.socket]
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

        const outgoingEdges = props.shaderGraph.edges.filter(edge => edge.from.node === nodeId);

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
        if (!slotKey || !props.bitmapMaps[slotKey] || !props.uv?.faces) {
            emitSyncRequest("update:texture-settings-to-uv-faces", {
                slotKey,
                settings: cloneData(settings),
            });
            return;
        }

        const nextSettings = mergeTextureSettingsForSlot(slotKey, props.bitmapMaps[slotKey], settings);

        Object.values(props.uv.faces || {}).forEach(face => {
            if (!face?.bitmap?.url && !face?.bitmap?.layer_id) {
                return;
            }

            face.bitmap = {
                ...face.bitmap,
                ...mergeTextureSettingsForSlot(slotKey, face.bitmap, nextSettings),
            };
        });

        emitUv();
    };

    const syncTextureGroupSettingsToUvFaces = (slotKey, group = {}, settings = {}) => {
        if (!slotKey || !props.bitmapMaps[slotKey] || !props.uv?.faces) {
            emitSyncRequest("update:texture-group-settings-to-uv-faces", {
                slotKey,
                group: cloneData(group),
                settings: cloneData(settings),
            });
            return;
        }

        const affectedFaces = Array.isArray(group.faces) ? group.faces : [];
        const nextSettings = mergeTextureSettingsForSlot(slotKey, props.bitmapMaps[slotKey], group, settings);

        Object.entries(props.uv.faces || {}).forEach(([faceName, face]) => {
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

        emitUv();
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

        props.surface[slotKey] = coerced;

        props.bitmapMaps[slotKey] = {
            ...props.bitmapMaps[slotKey],
            enabled: true,
            source_type: "shader",
            node_id: sourceNode?.id || props.bitmapMaps[slotKey]?.node_id || "",
            name: sourceNode?.label || props.bitmapMaps[slotKey]?.name || "Shader Value",
            url: props.bitmapMaps[slotKey]?.url || "",
            layer_id: props.bitmapMaps[slotKey]?.layer_id || "",
            ...mergeTextureSettingsForSlot(slotKey, props.bitmapMaps[slotKey], sourceNode?.settings || {}),
        };
    };

    const getIncomingShaderEdge = (nodeId, preferredSockets = []) => {
        const incoming = props.shaderGraph.edges.filter(edge => edge.to.node === nodeId);

        if (!incoming.length) {
            return null;
        }

        return incoming.find(edge => preferredSockets.includes(edge.to.socket)) || incoming[0];
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
        const nodeKey = settings.node_key || "";

        if (nodeKey === "texture.bitmap") {
            return {
                source_type: "single",
                enabled: true,
                node_id: node.id,
                layer_id: settings.layer_id || "",
                url: settings.url || "",
                name: settings.name || settings.bitmap || node.label || "",
                filename: settings.filename || "",
                cached: settings.cached === true,
                ...mergeTextureSettingsForSlot(getSurfaceSlotForNode(node.id), settings),
                strength: settings.strength ?? 1,
                offset: settings.offset ?? 0,
                invert: settings.invert === true,
                blend: settings.blend || "replace",
            };
        }

        if (nodeKey === "texture.multitexture") {
            const configuredGroups = Array.isArray(settings.texture_groups)
                ? settings.texture_groups
                : [];

            const textureGroups = configuredGroups
                .map(group => {
                    const merged = {
                        ...group,
                        ...mergeTextureSettingsForSlot(
                            settings.slot || settings.target_slot || getSurfaceSlotForNode(node.id),
                            settings,
                            group
                        ),
                    };

                    if (!merged.url && !merged.layer_id) {
                        return null;
                    }

                    return {
                        ...merged,
                        source_type: "single",
                        enabled: true,
                        layer_id: merged.layer_id || "",
                        url: merged.url || "",
                        name: merged.name || merged.slot || "Texture",
                        filename: merged.filename || "",
                        cached: merged.cached === true,
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

        props.shaderGraph.edges
            .filter(edge => edge.from.node === nodeId)
            .forEach(edge => {
                applyResolvedValueToNodeInput(edge.from, edge.to);
                propagateNodeOutputValues(edge.to.node, new Set(seen));
            });
    };

    const syncConnectedSurfaceValuesFromGraph = () => {
        props.shaderGraph.edges
            .filter(edge => edge.to.node === "principled-bsdf")
            .forEach(edge => applyResolvedValueToNodeInput(edge.from, edge.to));
    };

    const syncSurfaceOffsetsFromNodes = () => {
        emitSyncRequest("update:surface-offsets");
    };

    const syncSurfaceSlotFromUvCubeMap = slotKey => {
        emitSyncRequest("update:surface-slot-from-uv-cubemap", { slotKey });
    };

    const syncSurfaceSlotFromShaderGraph = slotKey => {
        const edge = props.shaderGraph.edges.find(item => (
            item.to.node === "principled-bsdf" &&
            item.to.socket === slotKey
        ));

        if (!edge) {
            if (props.bitmapMaps[slotKey]?.source_type === "shader") {
                props.bitmapMaps[slotKey] = {
                    ...props.bitmapMaps[slotKey],
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

        props.bitmapMaps[slotKey] = {
            ...props.bitmapMaps[slotKey],
            enabled: true,
            source_type: resolved.source_type,
            node_id: sourceNode.id,
            uv_node_id: "",
            name: resolved.name || sourceNode.label || sourceNode.id,
            url: resolved.url || "",
            layer_id: resolved.layer_id || "",
            filename: resolved.filename || "",
            cached: resolved.cached === true,
            faces: resolved.faces || props.bitmapMaps[slotKey]?.faces || {},
            mapped_faces: resolved.mapped_faces || props.bitmapMaps[slotKey]?.mapped_faces || [],
            texture_groups: resolved.texture_groups || [],
            ...mergeTextureSettingsForSlot(slotKey, props.bitmapMaps[slotKey], resolved),
            strength: resolved.strength ?? props.bitmapMaps[slotKey]?.strength ?? 1,
            offset: resolved.offset ?? props.bitmapMaps[slotKey]?.offset ?? 0,
            invert: resolved.invert === true,
            blend: resolved.blend || props.bitmapMaps[slotKey]?.blend || "replace",
        };
    };

    const syncAllSurfaceSlotsFromShaderGraph = () => {
        SURFACE_FIELDS.forEach(field => {
            syncSurfaceSlotFromShaderGraph(field.key);
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

        props.bitmapMaps[slotKey] = {
            ...props.bitmapMaps[slotKey],
            enabled: true,
            source_type: node.generated && node.system === "uv-cubemap"
                ? props.bitmapMaps[slotKey].source_type
                : "shader",

            node_id: node.id,
            name: node.label || node.id,

            url: settings.url || props.bitmapMaps[slotKey].url || "",
            layer_id: settings.layer_id || props.bitmapMaps[slotKey].layer_id || "",

            faces: settings.faces || props.bitmapMaps[slotKey].faces || {},
            mapped_faces: settings.mapped_faces || props.bitmapMaps[slotKey].mapped_faces || [],
            texture_groups: settings.texture_groups || props.bitmapMaps[slotKey].texture_groups || [],
            ...mergeTextureSettingsForSlot(slotKey, props.bitmapMaps[slotKey], settings),
            strength: settings.strength ?? props.bitmapMaps[slotKey].strength ?? 1,
            offset: settings.offset ?? props.bitmapMaps[slotKey].offset ?? 0,
            invert: settings.invert === true,
            blend: settings.blend || props.bitmapMaps[slotKey].blend || "replace",
        };

        syncTextureSettingsToUvFaces(slotKey, settings);
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

        emitAll();
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

        emitAll();
    };

    const ensureCoreNodes = () => {
        if (!getGraphNode("principled-bsdf")) {
            props.shaderGraph.nodes.push(createPrincipledNode());
        }

        if (!getGraphNode("material-output")) {
            props.shaderGraph.nodes.push(createOutputNode());
        }
    };

    const isMaterialOutputEdge = edge => (
        edge?.from?.node === "principled-bsdf" &&
        edge?.from?.socket === "bsdf" &&
        edge?.to?.node === "material-output" &&
        edge?.to?.socket === "surface"
    );

    const isCoreEdge = edge => isMaterialOutputEdge(edge);

    const reconcileShaderGraph = () => {
        rememberAllNodePositions();

        if (!getGraphNode("principled-bsdf")) {
            props.shaderGraph.nodes.push(createPrincipledNode());
        }

        if (!getGraphNode("material-output")) {
            props.shaderGraph.nodes.push(createOutputNode());
        }

        props.shaderGraph.nodes = props.shaderGraph.nodes.map(node => {
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

        props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => {
            const key = `${edge.from.node}:${edge.from.socket}->${edge.to.node}:${edge.to.socket}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });

        const nodeIds = new Set(props.shaderGraph.nodes.map(node => node.id));

        props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => (
            nodeIds.has(edge.from.node) &&
            nodeIds.has(edge.to.node)
        ));

        props.shaderGraph.edges = props.shaderGraph.edges.map(edge => ({
            ...edge,
            core: isMaterialOutputEdge(edge),
        }));

        syncAllSurfaceSlotsFromShaderGraph();
        syncConnectedSurfaceValuesFromGraph();
        applyRememberedNodePositions();

        requestAnimationFrame(() => {
            nodeLayoutVersion.value += 1;
        });
    };

    const hasShaderNodeDefinition = node => Boolean(Node.getDefinition(node));

    const hasUvShaderNode = () => props.shaderGraph.nodes.some(node => (
        node?.settings?.node_key === "uv.map" ||
        node?.settings?.node_key === "uv.cubemap"
    ));

    const getFirstUvShaderNode = () => props.shaderGraph.nodes.find(node => (
        node?.settings?.node_key === "uv.map" ||
        node?.settings?.node_key === "uv.cubemap"
    )) || null;

    const connectEdgeUnique = (from, to, extra = {}) => {
        const exists = props.shaderGraph.edges.some(edge => (
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
            props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => !(
                edge.to.node === to.node &&
                edge.to.socket === to.socket
            ));
        }

        props.shaderGraph.edges.push({
            id: uuid("shader-node"),
            from,
            to,
            ...Object.fromEntries(
                Object.entries(extra).filter(([key]) => key !== "replaceInput")
            ),
        });
    };

    const isSocketOccupied = to => props.shaderGraph.edges.some(edge => (
        edge.to.node === to.node &&
        edge.to.socket === to.socket
    ));

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
            }
        );
    };

    const connectMaterialSlotBitmapNodesToUvNode = uvNode => {
        if (!uvNode) {
            return;
        }

        Object.entries(props.bitmapMaps || {}).forEach(([slotKey, slot]) => {
            if (!slot?.node_id) {
                console.log(slotKey)
                return;
            }

            const node = getGraphNode(slot.node_id);

            if (!node || node.settings?.node_key !== "texture.bitmap") {
                return;
            }

            connectUvNodeToBitmapNode(node.id, uvNode);
        });
    };

    const addShaderNode = (nodeType, position = null) => {
        const descriptor = Node.get(nodeType);

        if (!descriptor) {
            return;
        }

        if (descriptor.key === "shader.principled") {
            if (!getGraphNode("principled-bsdf")) {
                props.shaderGraph.nodes.push(createPrincipledNode());
            }

            activeShaderNodeId.value = "principled-bsdf";
            reconcileShaderGraph();
            emitAll();
            return;
        }

        if (descriptor.key === "output.material") {
            let node = getGraphNode("material-output");

            if (!node) {
                node = createOutputNode();
                node.locked = false;
                props.shaderGraph.nodes.push(node);
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
            emitAll();
            return;
        }

        ensureCoreNodes();

        const hadUvShaderNode = hasUvShaderNode();

        const node = createShaderNode(descriptor.key, position || {
            x: 280,
            y: 120 + props.shaderGraph.nodes.length * 30,
        });

        if (!node) {
            return;
        }

        props.shaderGraph.nodes.push(node);

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
        emitAll();
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
            props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => (
                edge.from.node !== id &&
                edge.to.node !== id
            ));

            reconcileShaderGraph();
            emitAll();
            return;
        }

        props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => (
            edge.from.node !== id &&
            edge.to.node !== id
        ));

        props.shaderGraph.nodes = props.shaderGraph.nodes.filter(item => item.id !== id);

        activeShaderNodeId.value = "principled-bsdf";
        reconcileShaderGraph();
        emitAll();
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
        if (
            event.target.closest(".mem-shader-graph-node") ||
            event.target.closest("[data-socket]") ||
            event.target.closest(".mem-node-context-menu")
        ) {
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
        nodeLayoutVersion.value += 1;
    };

    const stopCanvasPan = () => {
        nodeCanvas.isPanning = false;

        window.removeEventListener("pointermove", moveCanvasPan);
        window.removeEventListener("pointerup", stopCanvasPan);
    };

    const handleCanvasWheel = event => {
        const rect = nodeCanvasRef.value?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        const oldZoom = nodeCanvas.zoom;
        const delta = event.deltaY > 0 ? -0.08 : 0.08;
        const nextZoom = clamp(oldZoom + delta, 0.35, 1.8);

        const mouseX = event.clientX - rect.left + nodeCanvasRef.value.scrollLeft;
        const mouseY = event.clientY - rect.top + nodeCanvasRef.value.scrollTop;

        const worldX = (mouseX - nodeCanvas.panX) / oldZoom;
        const worldY = (mouseY - nodeCanvas.panY) / oldZoom;

        nodeCanvas.zoom = nextZoom;
        nodeCanvas.panX = mouseX - worldX * nextZoom;
        nodeCanvas.panY = mouseY - worldY * nextZoom;

        nodeLayoutVersion.value += 1;
    };

    const closeNodeContextMenu = () => {
        ui.nodeContextMenu.open = false;
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

        ui.activeNodeCategory = "";
        ui.nodeContextMenu.open = true;
        ui.nodeContextMenu.x = point.x;
        ui.nodeContextMenu.y = point.y;
        ui.nodeContextMenu.worldX = point.x;
        ui.nodeContextMenu.worldY = point.y;
        ui.nodeContextMenu.category = ui.nodeContextMenu.category || "Math";
    };

    const addShaderNodeFromContext = nodeType => {
        addShaderNode(nodeType, {
            x: ui.nodeContextMenu.worldX,
            y: ui.nodeContextMenu.worldY,
        });

        closeNodeContextMenu();
    };

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

            const x = (
                dotRect.left + dotRect.width / 2
                - canvasRect.left
                - nodeCanvas.panX
                + nodeCanvasRef.value.scrollLeft
            ) / nodeCanvas.zoom;

            const y = (
                dotRect.top + dotRect.height / 2
                - canvasRect.top
                - nodeCanvas.panY
                + nodeCanvasRef.value.scrollTop
            ) / nodeCanvas.zoom;

            socketOffsetMemory[cacheKey] = {
                x: x - (node.position?.x || 0),
                y: y - (node.position?.y || 0),
            };

            return { x, y };
        }

        const nodeX = node.position?.x || 0;
        const nodeY = node.position?.y || 0;

        const sockets = direction === "input"
            ? Object.keys(node.inputs || {})
            : Object.keys(node.outputs || {});

        const index = Math.max(0, sockets.indexOf(socket));
        const nodeWidth = getNodeWidth(node);

        return {
            x: direction === "input" ? nodeX : nodeX + nodeWidth,
            y: nodeY + 58 + index * 24,
        };
    };

    const graphEdges = computed(() => {
        nodeLayoutVersion.value;

        return props.shaderGraph.edges.map(edge => {
            const from = getNodeSocketPosition(edge.from.node, edge.from.socket, "output");
            const to = getNodeSocketPosition(edge.to.node, edge.to.socket, "input");
            const dx = Math.max(60, Math.abs(to.x - from.x) * 0.45);

            return {
                ...edge,
                path: `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`,
            };
        });
    });

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
            1
        );

        const projection = {
            x: start.x + t * dx,
            y: start.y + t * dy,
        };

        return Math.hypot(point.x - projection.x, point.y - projection.y);
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

        props.shaderGraph.edges.forEach(edge => {
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

    const insertNodeIntoEdge = (nodeId, edgeId) => {
        const node = getGraphNode(nodeId);
        const edge = props.shaderGraph.edges.find(item => item.id === edgeId);

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

        props.shaderGraph.edges = props.shaderGraph.edges.filter(item => item.id !== edge.id);

        props.shaderGraph.edges.push({
            id: uuid("shader-node"),
            from: edge.from,
            to: {
                node: node.id,
                socket: inputSocket,
            },
        });

        props.shaderGraph.edges.push({
            id: uuid("shader-node"),
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
        emitAll();
    };

    const startMoveNode = (event, node) => {
        if (event.target.closest("[data-socket]")) {
            return;
        }

        if (node.locked === true) {
            return;
        }

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
            applyRememberedNodePositions();
            emitAll();
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

        props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => !(
            edge.to.node === to.node &&
            edge.to.socket === to.socket
        ));

        props.shaderGraph.edges.push({
            id: uuid("shader-node"),
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
            props.bitmapMaps[to.socket]
        ) {
            syncSurfaceSlotFromShaderGraph(to.socket);
            syncNodeValuesToSurface(getGraphNode(from.node));
        }

        cancelConnection();
        reconcileShaderGraph();
        syncConnectedSurfaceValuesFromGraph();

        emitAll();
    };

    const disconnectEdge = edgeId => {
        const edge = props.shaderGraph.edges.find(item => item.id === edgeId);

        props.shaderGraph.edges = props.shaderGraph.edges.filter(item => item.id !== edgeId);

        if (
            edge?.to?.node === "principled-bsdf" &&
            props.bitmapMaps[edge.to.socket]
        ) {
            syncSurfaceSlotFromShaderGraph(edge.to.socket);
        }

        reconcileShaderGraph();
        emitAll();
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

            ...mergeTextureSettingsForSlot("baseColor", props.bitmapMaps.baseColor),
            strength: props.bitmapMaps.baseColor?.strength ?? 1,
            offset: props.bitmapMaps.baseColor?.offset ?? 0,
            invert: props.bitmapMaps.baseColor?.invert === true,
            blend: props.bitmapMaps.baseColor?.blend || "replace",
        };
    };

    const ensureBaseColorSourceTexture = () => {
        const baseSlot = props.bitmapMaps.baseColor;

        if (
            baseSlot?.url ||
            baseSlot?.layer_id ||
            (
                Array.isArray(baseSlot?.texture_groups) &&
                baseSlot.texture_groups.some(group => group?.url || group?.layer_id)
            )
        ) {
            return;
        }

        const layer = props.selectedSourceLayer || props.layer;
        const bitmap = createLayerBitmapPayload(layer);

        if (!bitmap) {
            return;
        }

        props.bitmapMaps.baseColor = {
            ...baseSlot,
            ...bitmap,
        };

        ensureBitmapNodeForSlot("baseColor");
    };

    const ensureBitmapNodeForSlot = slotKey => {
        ensureCoreNodes();

        const nodeId = `bitmap-${slotKey}`;
        const slot = props.bitmapMaps[slotKey];

        if (!slot) {
            return null;
        }

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

            props.shaderGraph.nodes.push(node);
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

        const uvNode = getFirstUvShaderNode();

        if (uvNode) {
            connectUvNodeToBitmapNode(nodeId, uvNode);
        } else if (hasUvShaderNode()) {
            connectUvNodeToBitmapNode(nodeId);
        }

        const outputSocket = slotKey === "alpha" ? "alpha" : "color";

        const exists = props.shaderGraph.edges.some(edge => (
            edge.from.node === nodeId &&
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        const inputOccupied = props.shaderGraph.edges.some(edge => (
            edge.to.node === "principled-bsdf" &&
            edge.to.socket === slotKey
        ));

        if (!exists && !inputOccupied) {
            props.shaderGraph.edges.push({
                id: uuid("shader-node"),
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

        return node;
    };

    const removeAutoBitmapNode = slotKey => {
        const nodeId = `bitmap-${slotKey}`;

        props.shaderGraph.edges = props.shaderGraph.edges.filter(edge => (
            edge.from.node !== nodeId &&
            edge.to.node !== nodeId
        ));

        props.shaderGraph.nodes = props.shaderGraph.nodes.filter(node => (
            node.id !== nodeId
        ));
    };

    const clearMapSlot = key => {
        props.bitmapMaps[key] = {
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

        if (Array.isArray(props.uv.target_slots)) {
            props.uv.target_slots = props.uv.target_slots.filter(slotKey => slotKey !== key);
        }

        if (props.uv.target_slot === key) {
            props.uv.target_slot = props.uv.target_slots?.[0] || "baseColor";
        }

        emitAll();
    };

    const assignLayerToMap = (key, layer) => {
        if (!isUsableTextureLayer(layer)) {
            return;
        }

        const url = resolveLayerTextureUrl(layer);

        props.bitmapMaps[key] = {
            ...props.bitmapMaps[key],
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
            ...mergeTextureSettingsForSlot(key, props.bitmapMaps[key]),
        };

        ensureBitmapNodeForSlot(key);
        emitAll();
    };

    const handleLayerDragStart = (event, layer) => {
        draggingSourceLayerId.value = layer.id;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-layer-id", layer.id);
        event.dataTransfer.setData("text/plain", layer.id);

        emit("layer-drag-start", layer);
    };

    const handleMapDrop = (event, key) => {
        event.preventDefault();

        const id =
            event.dataTransfer.getData("application/x-layer-id") ||
            event.dataTransfer.getData("text/plain") ||
            draggingSourceLayerId.value;

        const layer = props.textureLayers.find(item => item.id === id);

        if (layer) {
            assignLayerToMap(key, layer);
        }

        draggingSourceLayerId.value = "";
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

    onBeforeUnmount(() => {
        window.removeEventListener("pointermove", moveNode);
        window.removeEventListener("pointerup", stopMoveNode);
        window.removeEventListener("pointermove", moveConnection);
        window.removeEventListener("pointerup", cancelConnection);
        window.removeEventListener("pointermove", moveCanvasPan);
        window.removeEventListener("pointerup", stopCanvasPan);
    });

    return {
        values,
        ui,

        nodeCanvas,
        nodeCanvasRef,
        nodeWorldStyle,

        nodeTypeGroups,
        graphEdges,

        activeConnection,
        activeConnectionPath,
        activeShaderNode,
        activeShaderNodeId,
        activeSnapEdgeId,
        materialConnected,

        textureLayers: computed(() => props.textureLayers),
        textureChannelOptions: TEXTURE_CHANNEL_OPTIONS,
        textureColorModeOptions: TEXTURE_COLOR_MODE_OPTIONS,

        normalizeNodeSettings,
        ensureNodeSettings,
        updateNodeSetting,
        updateNodeTextureGroupSetting,

        syncNodeValuesToSurface,
        syncSurfaceSlotFromShaderGraph,
        syncAllSurfaceSlotsFromShaderGraph,
        syncSurfaceOffsetsFromNodes,

        getSurfaceSlotForNode,
        getNodeEdgesIn,
        getNodeEdgesOut,

        getShaderNodeIcon,
        getNodeCategoryChip,
        getNodeDisplayTitle,
        getNodeValueSummary,
        getNodeConnectionSummary,
        getNodeBadge,
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

        startCanvasPan,
        handleCanvasWheel,
        openNodeContextMenu,
        closeNodeContextMenu,

        addShaderNode,
        addShaderNodeFromContext,
        removeShaderNode,

        startMoveNode,
        startConnection,
        completeConnection,
        disconnectEdge,
        isCoreEdge,

        handleLayerDragStart,
        handleMapDrop,
        assignLayerToMap,
        clearMapSlot,
        ensureBitmapNodeForSlot,
        ensureBaseColorSourceTexture,

        emitShaderGraph,
    };
}