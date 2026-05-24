import { uuid } from "@/utils/uuid";
import { clone } from "@/utils/tools";

export class Node {
    static TYPE_ORDER = ["Shader", "Texture", "UV", "Math", "Vector", "Color", "Output"];

    static TEXTURE_SETTING_DEFAULTS = Object.freeze({
        channel: "rgba",
        color_mode: "color",
    });

    static socket(type, label = "") {
        return { type, label };
    }

    static define({
                      key,
                      type,
                      label,
                      icon,
                      fields = [],
                      inputs = {},
                      outputs = {},
                      defaults = {},
                  }) {
        return Object.freeze({
            key,
            type,
            group: type,
            label,
            icon,
            fields,
            inputs,
            outputs,
            defaults: Object.freeze(defaults),
        });
    }

    static DEFINITIONS = Object.freeze([
        Node.define({
            key: "shader.principled",
            type: "Shader",
            label: "Principled BSDF",
            icon: "mdi-material-design",
        }),

        Node.define({
            key: "shader.displacement",
            type: "Shader",
            label: "Displacement",
            icon: "mdi-terrain",
            fields: ["space", "height", "midlevel", "scale"],
            inputs: {
                height: Node.socket("float", "Height"),
                midlevel: Node.socket("float", "Midlevel"),
                scale: Node.socket("float", "Scale"),
                normal: Node.socket("vector", "Normal"),
            },
            outputs: {
                displacement: Node.socket("vector", "Displacement"),
            },
            defaults: {
                space: "Object Space",
                height: 0,
                midlevel: 0.5,
                scale: 1,
                normal: [0, 0, 1],
            },
        }),

        Node.define({
            key: "texture.bitmap",
            type: "Texture",
            label: "Bitmap/Image",
            icon: "mdi-image",
            fields: ["bitmap", "interpolation", "projection", "extension"],
            inputs: {
                uv: Node.socket("vector"),
            },
            outputs: {
                color: Node.socket("color"),
                alpha: Node.socket("float"),
            },
            defaults: {
                ...Node.TEXTURE_SETTING_DEFAULTS,
                strength: 1,
                offset: 0,
                invert: false,
                blend: "replace",
                bitmap: "",
            },
        }),

        Node.define({
            key: "texture.multitexture",
            type: "Texture",
            label: "Multi Texture",
            icon: "mdi-image-multiple",
            fields: ["bitmap", "interpolation", "projection", "extension"],
            inputs: {
                uv: Node.socket("vector"),
            },
            outputs: {
                color: Node.socket("color"),
                alpha: Node.socket("float"),
            },
            defaults: {
                mode: "cubemap-url-group-composite",
                ...Node.TEXTURE_SETTING_DEFAULTS,
                strength: 1,
                offset: 0,
                blend: "replace",
            },
        }),

        Node.define({
            key: "texture.gradient",
            type: "Texture",
            label: "Gradient",
            icon: "mdi-gradient-horizontal",
            fields: ["type"],
            inputs: {
                vector: Node.socket("vector"),
            },
            outputs: {
                color: Node.socket("color"),
                factor: Node.socket("float"),
            },
            defaults: {
                type: "Linear",
                strength: 1,
                offset: 0,
                clamp: true,
            },
        }),

        Node.define({
            key: "texture.noise",
            type: "Texture",
            label: "Noise",
            icon: "mdi-blur",
            fields: ["dimensions", "normalize", "type"],
            inputs: {
                vector: Node.socket("vector"),
                scale: Node.socket("float"),
                detail: Node.socket("float"),
                roughness: Node.socket("float"),
                lacunarity: Node.socket("float"),
                distortion: Node.socket("float"),
            },
            outputs: {
                factor: Node.socket("float"),
                color: Node.socket("color"),
            },
            defaults: {
                dimensions: "3D",
                normalize: true,
                type: "fBM",
                scale: 0.5,
                detail: 2,
                roughness: 0.5,
                lacunarity: 2,
                distortion: 0,
                clamp: true,
            },
        }),

        Node.define({
            key: "texture.wave",
            type: "Texture",
            label: "Wave",
            icon: "mdi-sine-wave",
            fields: ["type", "direction", "wave"],
            inputs: {
                vector: Node.socket("vector"),
                scale: Node.socket("float"),
                distortion: Node.socket("float"),
                detail: Node.socket("float"),
                "detail scale": Node.socket("float"),
                "detail roughness": Node.socket("float"),
                Phase: Node.socket("float"),
            },
            outputs: {
                color: Node.socket("color"),
                factor: Node.socket("float"),
            },
            defaults: {
                type: "Bands",
                direction: "X",
                wave: "Sine",
                scale: 0.5,
                distortion: 0,
                detail: 2,
                clamp: true,
            },
        }),

        Node.define({
            key: "uv.map",
            type: "UV",
            label: "UV-Map",
            icon: "mdi-vector-square",
            outputs: {
                uv: Node.socket("vector", "UV"),
            },
            defaults: {
                uv_map: "",
            },
        }),

        Node.define({
            key: "math.clamp",
            type: "Math",
            label: "Clamp",
            icon: "mdi-lock-outline",
            fields: ["type", "value", "min", "max"],
            inputs: {
                value: Node.socket("float"),
                min: Node.socket("float"),
                max: Node.socket("float"),
            },
            outputs: {
                result: Node.socket("float"),
            },
            defaults: {
                type: "Min Max",
                value: 0,
                min: 0,
                max: 1,
            },
        }),

        Node.define({
            key: "math.floatCurve",
            type: "Math",
            label: "Float Curve",
            icon: "mdi-chart-bell-curve-cumulative",
            fields: ["curve", "factor", "value"],
            inputs: {
                factor: Node.socket("float"),
                value: Node.socket("float"),
            },
            outputs: {
                value: Node.socket("float"),
            },
            defaults: {
                curve: null,
                factor: 1,
                value: 0,
            },
        }),

        Node.define({
            key: "math.operation",
            type: "Math",
            label: "Math",
            icon: "mdi-function",
            fields: ["mode", "clamp", "a", "b"],
            inputs: {
                a: Node.socket("float", "value"),
                b: Node.socket("float", "value"),
            },
            outputs: {
                value: Node.socket("float"),
            },
            defaults: {
                mode: "Add",
                clamp: true,
                a: 0,
                b: 0,
                value: 0,
                factor: 1,
            },
        }),

        Node.define({
            key: "math.mix",
            type: "Math",
            label: "Mix",
            icon: "mdi-blender-software",
            fields: ["type", "clamp", "factor", "a", "b"],
            inputs: {
                factor: Node.socket("float"),
                a: Node.socket("float"),
                b: Node.socket("float"),
            },
            outputs: {
                result: Node.socket("float"),
            },
            defaults: {
                type: "Float",
                clamp: true,
                factor: 1,
                a: 0,
                b: 1,
            },
        }),

        Node.define({
            key: "math.value",
            type: "Math",
            label: "Value",
            icon: "mdi-numeric",
            fields: ["value"],
            outputs: {
                value: Node.socket("float"),
            },
            defaults: {
                value: 0,
            },
        }),

        Node.define({
            key: "vector.combineXYZ",
            type: "Vector",
            label: "Combine XYZ",
            icon: "mdi-vector-polyline",
            fields: ["x", "y", "z"],
            inputs: {
                x: Node.socket("float"),
                y: Node.socket("float"),
                z: Node.socket("float"),
            },
            outputs: {
                vector: Node.socket("vector"),
            },
            defaults: {
                x: 0,
                y: 0,
                z: 0,
            },
        }),

        Node.define({
            key: "vector.mix",
            type: "Vector",
            label: "Mix",
            icon: "mdi-vector-combine",
            fields: ["type", "clamp", "factor", "a", "b", "x", "y", "z"],
            inputs: {
                factor: Node.socket("float"),
                a: Node.socket("vector"),
                b: Node.socket("vector"),
            },
            outputs: {
                vector: Node.socket("vector"),
            },
            defaults: {
                type: "Vector",
                clamp: true,
                factor: 1,
                a: [0, 0, 0],
                b: [1, 1, 1],
                x: 0,
                y: 0,
                z: 0,
            },
        }),

        Node.define({
            key: "vector.separateXYZ",
            type: "Vector",
            label: "Separate XYZ",
            icon: "mdi-vector-difference",
            fields: ["x", "y", "z"],
            inputs: {
                vector: Node.socket("vector"),
            },
            outputs: {
                x: Node.socket("float"),
                y: Node.socket("float"),
                z: Node.socket("float"),
            },
            defaults: {
                x: 0,
                y: 0,
                z: 0,
            },
        }),

        Node.define({
            key: "vector.mapping",
            type: "Vector",
            label: "Mapping",
            icon: "mdi-vector-square",
            fields: ["type", "vector", "location", "rotation", "scale"],
            inputs: {
                vector: Node.socket("vector"),
                location: Node.socket("vector"),
                rotation: Node.socket("vector"),
                scale: Node.socket("vector"),
            },
            outputs: {
                vector: Node.socket("vector"),
            },
            defaults: {
                type: "Point",
                vector: [0, 0, 0],
                location: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
            },
        }),

        Node.define({
            key: "color.blackbody",
            type: "Color",
            label: "Blackbody",
            icon: "mdi-thermometer",
            fields: ["temperature"],
            inputs: {
                temperature: Node.socket("float", "Temperature (K)"),
            },
            outputs: {
                color: Node.socket("color"),
            },
            defaults: {
                temperature: 6500,
            },
        }),

        Node.define({
            key: "color.brightnessContrast",
            type: "Color",
            label: "Brightness/Contrast",
            icon: "mdi-brightness-6",
            fields: ["bitmap", "brightness", "contrast"],
            inputs: {
                bitmap: Node.socket("image"),
                brightness: Node.socket("float"),
                contrast: Node.socket("float"),
            },
            outputs: {
                bitmap: Node.socket("image"),
            },
            defaults: {
                bitmap: null,
                brightness: 0,
                contrast: 0,
            },
        }),

        Node.define({
            key: "color.colorRamp",
            type: "Color",
            label: "Color Ramp",
            icon: "mdi-gradient-horizontal",
            fields: ["color_mode", "color_interpolation", "active_color_stop", "position", "color", "factor"],
            inputs: {
                factor: Node.socket("float"),
            },
            outputs: {
                bitmap: Node.socket("image"),
                alpha: Node.socket("float"),
            },
            defaults: {
                color_mode: "RGB",
                color_interpolation: "Linear",
                active_color_stop: 0,
                position: 0.5,
                color: [1, 1, 1, 1],
                factor: 0.5,
            },
        }),

        Node.define({
            key: "color.gamma",
            type: "Color",
            label: "Gamma",
            icon: "mdi-chart-bell-curve",
            fields: ["color", "gamma"],
            inputs: {
                color: Node.socket("color"),
                gamma: Node.socket("float"),
            },
            outputs: {
                color: Node.socket("color"),
            },
            defaults: {
                color: [1, 1, 1, 1],
                gamma: 1,
            },
        }),

        Node.define({
            key: "color.hsv",
            type: "Color",
            label: "Hue/Saturation/Value",
            icon: "mdi-palette",
            fields: ["bitmap", "hue", "saturation", "value", "factor"],
            inputs: {
                bitmap: Node.socket("image"),
                hue: Node.socket("float"),
                saturation: Node.socket("float"),
                value: Node.socket("float"),
                factor: Node.socket("float"),
            },
            outputs: {
                bitmap: Node.socket("image"),
            },
            defaults: {
                bitmap: null,
                hue: 0.5,
                saturation: 1,
                value: 1,
                factor: 1,
            },
        }),

        Node.define({
            key: "color.invert",
            type: "Color",
            label: "Invert Color",
            icon: "mdi-invert-colors",
            fields: ["factor", "color"],
            inputs: {
                factor: Node.socket("float"),
                color: Node.socket("color"),
            },
            outputs: {
                color: Node.socket("color"),
            },
            defaults: {
                factor: 1,
                color: [1, 1, 1, 1],
            },
        }),

        Node.define({
            key: "color.mix",
            type: "Color",
            label: "Mix",
            icon: "mdi-blender-software",
            fields: ["type", "clamp", "factor", "a", "b"],
            inputs: {
                factor: Node.socket("float"),
                a: Node.socket("color"),
                b: Node.socket("color"),
            },
            outputs: {
                color: Node.socket("color"),
            },
            defaults: {
                type: "Color",
                clamp: true,
                factor: 1,
                a: [0, 0, 0, 1],
                b: [1, 1, 1, 1],
            },
        }),

        Node.define({
            key: "color.combine",
            type: "Color",
            label: "Combine Color",
            icon: "mdi-format-color-fill",
            fields: ["mode", "red", "green", "blue", "alpha"],
            inputs: {
                red: Node.socket("float"),
                green: Node.socket("float"),
                blue: Node.socket("float"),
                alpha: Node.socket("float"),
            },
            outputs: {
                color: Node.socket("color"),
            },
            defaults: {
                mode: "RGB",
                red: 0,
                green: 0,
                blue: 0,
                alpha: 1,
            },
        }),

        Node.define({
            key: "color.separate",
            type: "Color",
            label: "Separate Color",
            icon: "mdi-format-color-highlight",
            fields: ["mode", "red", "green", "blue", "alpha"],
            inputs: {
                color: Node.socket("color"),
            },
            outputs: {
                red: Node.socket("float"),
                green: Node.socket("float"),
                blue: Node.socket("float"),
                alpha: Node.socket("float"),
            },
            defaults: {
                mode: "RGB",
                color: [1, 1, 1, 1],
            },
        }),

        Node.define({
            key: "color.rgbToBw",
            type: "Color",
            label: "RGB to BW",
            icon: "mdi-circle-half-full",
            fields: ["bitmap"],
            inputs: {
                bitmap: Node.socket("image"),
            },
            outputs: {
                value: Node.socket("float"),
            },
            defaults: {
                bitmap: null,
            },
        }),

        Node.define({
            key: "output.material",
            type: "Output",
            label: "Output",
            icon: "mdi-export",
        }),
    ]);

    static DEFINITION_MAP = Object.freeze(
        Node.DEFINITIONS.reduce((acc, definition) => {
            acc[definition.key] = definition;
            return acc;
        }, {})
    );

    static TYPES = Object.freeze(
        Node.DEFINITIONS.map(({ key, type, group, label, icon }) => ({
            key,
            type,
            group,
            label,
            icon,
        }))
    );

    static VALUE_DEFAULTS = Object.freeze(
        Node.DEFINITIONS.reduce((acc, definition) => {
            acc[definition.key] = definition.defaults || {};
            return acc;
        }, {})
    );

    static get(nodeKey) {
        if (typeof nodeKey === "object" && nodeKey?.key) {
            return Node.DEFINITION_MAP[nodeKey.key] || null;
        }

        return Node.DEFINITION_MAP[nodeKey] || null;
    }

    static has(nodeKey) {
        return Boolean(Node.get(nodeKey));
    }

    static getKey(node) {
        return node?.settings?.node_key || "";
    }

    static getName(node) {
        const definition = Node.get(Node.getKey(node));

        return definition?.label || node?.settings?.node_name || node?.label || "";
    }

    static getGroup(node) {
        const definition = Node.get(Node.getKey(node));

        return definition?.group || node?.settings?.group || node?.type || "";
    }

    static getIcon(node) {
        return Node.get(Node.getKey(node))?.icon || "mdi-function";
    }

    static getDefinition(node) {
        return Node.get(Node.getKey(node));
    }

    static getSockets(nodeKey) {
        const definition = Node.get(nodeKey);

        return {
            inputs: clone(definition?.inputs || {}),
            outputs: clone(definition?.outputs || {}),
        };
    }

    static getFields(node) {
        return Node.getDefinition(node)?.fields || [];
    }

    static getDefaults(nodeKey) {
        return clone(Node.get(nodeKey)?.defaults || {});
    }

    static normalizeSettings(node) {
        if (!node) {
            return {};
        }

        const nodeKey = Node.getKey(node);
        const definition = Node.get(nodeKey);

        if (!definition) {
            return {
                ...(node.settings || {}),
            };
        }

        return {
            ...Node.getDefaults(nodeKey),
            ...(node.settings || {}),
            node_key: definition.key,
            node_name: definition.label,
            group: definition.group,
        };
    }

    static isEditableInput(socket) {
        return Boolean(
            socket &&
            typeof socket === "object" &&
            ["float", "value", "color", "vector"].includes(socket.type)
        );
    }

    static create(nodeKey, position = { x: 280, y: 140 }, options = {}) {
        const definition = Node.get(nodeKey);

        if (!definition) {
            return null;
        }

        return {
            id: options.id || uuid("shader-node"),
            type: definition.type,
            label: options.label || definition.label,
            locked: options.locked === true,
            generated: options.generated === true,
            system: options.system || undefined,
            position,
            ...Node.getSockets(definition.key),
            settings: {
                ...Node.getDefaults(definition.key),
                ...(options.settings || {}),
                node_key: definition.key,
                node_name: definition.label,
                group: definition.group,
            },
        };
    }

    static createPrincipled({
                                surfaceFieldMap,
                                principledNodeInputKeys,
                                principledSurfaceGroups,
                                createSurface,
                            }) {
        return {
            id: "principled-bsdf",
            type: "Shader",
            label: "Principled BSDF",
            locked: false,
            position: { x: 620, y: 130 },
            inputs: principledNodeInputKeys.reduce((acc, key) => {
                const field = surfaceFieldMap[key];

                acc[field.key] = {
                    type: Array.isArray(createSurface()[field.key]) ? "color" : "float",
                    relation: principledSurfaceGroups.find(group => group.key === key)?.relation || "",
                };

                return acc;
            }, {}),
            outputs: {
                bsdf: { type: "shader" },
            },
            settings: {
                source: "surface",
                node_key: "shader.principled",
                node_name: "Principled BSDF",
                group: "Shader",
            },
        };
    }

    static createOutput() {
        return {
            id: "material-output",
            type: "Output",
            label: "Material Output",
            locked: false,
            position: { x: 940, y: 220 },
            inputs: {
                surface: { type: "shader" },
                volume: { type: "shader" },
                displacement: { type: "vector" },
            },
            outputs: {},
            settings: {
                node_key: "output.material",
                node_name: "Output",
                group: "Output",
            },
        };
    }

    static createGraph({ createPrincipled, createOutput = Node.createOutput }) {
        return {
            version: 1,
            nodes: [
                createPrincipled(),
                createOutput(),
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
        };
    }

    static getFieldItems(node) {
        const definition = Node.getDefinition(node);

        if (!definition) {
            return [];
        }

        const inputFields = Object.entries(definition.inputs || {})
            .filter(([, socket]) => Node.isEditableInput(socket))
            .map(([key]) => key);

        return Array.from(new Set([
            ...definition.fields,
            ...inputFields,
        ])).map(field => ({
            key: field,
            label: field === "a" ? "A" : field === "b" ? "B" : field.replace(/_/g, " "),
        }));
    }

    static getFieldOptions(node, fieldKey) {
        const settings = Node.normalizeSettings(node);
        const nodeKey = settings.node_key || "";

        if (fieldKey === "interpolation") {
            return ["Linear", "Cubic", "Closest", "Smart"];
        }

        if (nodeKey === "shader.displacement" && fieldKey === "space") {
            return ["Object Space", "World Space"];
        }

        if (fieldKey === "projection") {
            return ["Flat", "Box", "Sphere", "Tube"];
        }

        if (fieldKey === "extension") {
            return ["Repeat", "Extend", "Clip"];
        }

        if (nodeKey === "texture.gradient" && fieldKey === "type") {
            return ["Linear", "Quadratic", "Easing", "Diagonal", "Spherical", "Sphere", "Radial"];
        }

        if (nodeKey === "texture.noise" && fieldKey === "dimensions") {
            return ["1D", "2D", "3D", "4D"];
        }

        if (nodeKey === "texture.noise" && fieldKey === "type") {
            return ["fBM", "Multifractal", "Hybrid Multifractal", "Ridged Multifractal", "Hetero Terrain"];
        }

        if (nodeKey === "texture.wave" && fieldKey === "type") {
            return ["Bands", "Rings"];
        }

        if (nodeKey === "texture.wave" && fieldKey === "direction") {
            return ["X", "Y", "Z", "Diagonal", "Spherical"];
        }

        if (nodeKey === "texture.wave" && fieldKey === "wave") {
            return ["Sine", "Saw", "Triangle", "Rings"];
        }

        if (nodeKey === "math.operation" && fieldKey === "mode") {
            return ["Add", "Subtract", "Multiply", "Divide", "Min", "Max", "Power", "Mix"];
        }

        if (nodeKey === "math.clamp" && fieldKey === "type") {
            return ["Min Max", "Range"];
        }

        if (nodeKey === "math.mix" && fieldKey === "type") {
            return ["Float"];
        }

        if (nodeKey === "vector.mix" && fieldKey === "type") {
            return ["Vector"];
        }

        if (nodeKey === "color.mix" && fieldKey === "type") {
            return ["Color"];
        }

        if (nodeKey === "vector.mapping" && fieldKey === "type") {
            return ["Point", "Texture", "Vector", "Normal"];
        }

        if (
            (nodeKey === "color.combine" || nodeKey === "color.separate") &&
            fieldKey === "mode"
        ) {
            return ["RGB", "HSV", "HSL"];
        }

        return [];
    }

    static isTextureSource(node) {
        const nodeKey = Node.getKey(node);

        return (
            nodeKey === "texture.bitmap" ||
            nodeKey === "texture.multitexture"
        );
    }
}