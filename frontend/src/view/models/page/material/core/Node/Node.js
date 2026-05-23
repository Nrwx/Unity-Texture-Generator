import { uuid } from "@/utils/uuid";
import {applyMathOperation, clamp, clone, mixNumbers, toFiniteNumber, toVector3} from "@/utils/tools";
import {kelvinToColor, luminanceFromColor, mixColors, normalizeColorValue} from "@/utils/color";

export class Node {
    static TYPE_ORDER = ["Shader", "Texture", "UV", "Math", "Vector", "Color", "Output"];

    static TEXTURE_SETTING_DEFAULTS = Object.freeze({
        channel: "rgba",
        color_mode: "color",
    });

    static socket(type, label = "") {
        return { type, label };
    }

    static getGraphNode(graph, nodeId) {
        return (graph?.nodes || []).find(node => node.id === nodeId) || null;
    }

    static getIncomingEdge(graph, nodeId, socket) {
        return (graph?.edges || []).find(edge => (
            edge.to.node === nodeId &&
            edge.to.socket === socket
        )) || null;
    }

    static resolveInputValue(graph, nodeId, socket, seen = new Set()) {
        const edge = Node.getIncomingEdge(graph, nodeId, socket);

        if (!edge) {
            return null;
        }

        return Node.resolveOutputValue(graph, edge.from.node, edge.from.socket, seen);
    }

    static clampSurfaceValue(slotKey, value, context = {}) {
        const field = context.surfaceFieldMap?.[slotKey];
        const defaults = context.surfaceDefaults || {};
        const fallback = toFiniteNumber(defaults[slotKey], 0);
        const number = toFiniteNumber(value, fallback);

        if (!field || field.type !== "number") {
            return number;
        }

        return clamp(number, field.min ?? 0, field.max ?? 1);
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
            key: "shader.volume",
            type: "Shader",
            label: "Geometry Volume",
            icon: "mdi-cube-scan",
            fields: ["mode", "resolution", "density", "shell_thickness", "falloff", "sample"],
            inputs: {
                density: Node.socket("float", "Density"),
                bounds: Node.socket("vector", "Bounds"),
            },
            outputs: {
                density: Node.socket("float", "Density"),
                volume: Node.socket("shader", "Volume"),
                mask: Node.socket("float", "Mask"),
            },
            defaults: {
                mode: "mesh",
                resolution: 32,
                density: 1,
                shell_thickness: 0.08,
                falloff: "smooth",
                sample: "inside",
            },
        }),

        Node.define({
            key: "shader.fluid",
            type: "Shader",
            label: "Fluid Dynamics",
            icon: "mdi-waves",
            fields: ["type", "solver", "viscosity", "buoyancy", "vorticity", "turbulence", "diffusion", "particle_coupling", "surface_flow", "mesh_collision", "particle_collision"],
            inputs: {
                volume: Node.socket("shader", "Volume"),
                velocity: Node.socket("vector", "Velocity"),
            },
            outputs: {
                volume: Node.socket("shader", "Fluid Volume"),
                velocity: Node.socket("vector", "Velocity"),
                density: Node.socket("float", "Density"),
            },
            defaults: {
                type: "smoke",
                solver: "stable",
                viscosity: 0.12,
                buoyancy: 0.35,
                vorticity: 0.28,
                turbulence: 0.22,
                diffusion: 0.08,
                particle_coupling: 0.65,
                surface_flow: 0.45,
                mesh_collision: true,
                particle_collision: true,
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
                uv_map: "Unwrap",
                mode: "unwrap",
            },
        }),

        Node.define({
            key: "uv.cubemap",
            type: "UV",
            label: "UV-CubeMap",
            icon: "mdi-cube-scan",
            outputs: {
                uv: Node.socket("vector", "Cube UV"),
            },
            defaults: {
                uv_map: "CubeMap",
                mode: "cubemap",
                atlas: "cross",
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

    static coerceSocketValue(value, socketType = "float", slotKey = "", context = {}) {
        if (value === null || value === undefined) {
            return null;
        }

        if (socketType === "color" || socketType === "image") {
            return normalizeColorValue(value);
        }

        if (socketType === "vector") {
            return toVector3(value);
        }

        if (Array.isArray(value)) {
            return Node.clampSurfaceValue(slotKey, value[0], context);
        }

        return Node.clampSurfaceValue(slotKey, value, context);
    }

    static resolveOutputValue(graph, nodeId, socket = "", seen = new Set()) {
        if (!nodeId || seen.has(nodeId)) {
            return null;
        }

        seen.add(nodeId);

        const node = Node.getGraphNode(graph, nodeId);

        if (!node) {
            return null;
        }

        const settings = Node.normalizeSettings(node);
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
            const a = Node.resolveInputValue(graph, node.id, "a", new Set(seen)) ?? settings.a ?? settings.value ?? 0;
            const b = Node.resolveInputValue(graph, node.id, "b", new Set(seen)) ?? settings.b ?? settings.factor ?? 0;
            const result = applyMathOperation(settings.mode || settings.operation, a, b);

            return settings.clamp === true ? clamp(result, 0, 1) : result;
        }

        if (nodeKey === "math.mix") {
            const factor = Node.resolveInputValue(graph, node.id, "factor", new Set(seen)) ?? settings.factor ?? 0.5;
            const a = Node.resolveInputValue(graph, node.id, "a", new Set(seen)) ?? settings.a ?? 0;
            const b = Node.resolveInputValue(graph, node.id, "b", new Set(seen)) ?? settings.b ?? 1;
            const result = mixNumbers(a, b, factor);

            return settings.clamp === false ? result : clamp(result, 0, 1);
        }

        if (nodeKey === "vector.mix") {
            const factor = Node.resolveInputValue(graph, node.id, "factor", new Set(seen)) ?? settings.factor ?? 0.5;
            const a = Node.resolveInputValue(graph, node.id, "a", new Set(seen)) ?? settings.a ?? [0, 0, 0];
            const b = Node.resolveInputValue(graph, node.id, "b", new Set(seen)) ?? settings.b ?? [1, 1, 1];
            const amount = clamp(toFiniteNumber(factor, 0.5), 0, 1);

            const left = toVector3(a, [0, 0, 0]);
            const right = toVector3(b, [1, 1, 1]);

            const result = [
                mixNumbers(left[0], right[0], amount),
                mixNumbers(left[1], right[1], amount),
                mixNumbers(left[2], right[2], amount),
            ];

            return settings.clamp === false
                ? result
                : result.map(value => clamp(value, 0, 1));
        }

        if (nodeKey === "color.mix") {
            const factor = Node.resolveInputValue(graph, node.id, "factor", new Set(seen)) ?? settings.factor ?? 0.5;
            const a = Node.resolveInputValue(graph, node.id, "a", new Set(seen)) ?? settings.a ?? [0, 0, 0, 1];
            const b = Node.resolveInputValue(graph, node.id, "b", new Set(seen)) ?? settings.b ?? [1, 1, 1, 1];

            return mixColors(a, b, factor, settings.clamp !== false);
        }

        if (nodeKey === "math.clamp") {
            const value = Node.resolveInputValue(graph, node.id, "value", new Set(seen)) ?? settings.value ?? 0;
            const min = Node.resolveInputValue(graph, node.id, "min", new Set(seen)) ?? settings.min ?? 0;
            const max = Node.resolveInputValue(graph, node.id, "max", new Set(seen)) ?? settings.max ?? 1;

            return clamp(
                toFiniteNumber(value, 0),
                toFiniteNumber(min, 0),
                toFiniteNumber(max, 1)
            );
        }

        if (nodeKey === "math.floatCurve") {
            return Node.resolveInputValue(graph, node.id, "value", new Set(seen)) ??
                settings.value ??
                settings.factor ??
                0;
        }

        if (nodeKey === "color.blackbody") {
            const temperature =
                Node.resolveInputValue(graph, node.id, "temperature", new Set(seen)) ??
                settings.temperature ??
                6500;

            return socket === "color"
                ? kelvinToColor(temperature)
                : temperature;
        }

        if (nodeKey === "texture.gradient") {
            const factor =
                Node.resolveInputValue(graph, node.id, "vector", new Set(seen)) ??
                settings.factor ??
                0.5;

            return socket === "color"
                ? normalizeColorValue(factor, [0.5, 0.5, 0.5, 1])
                : clamp(toFiniteNumber(Array.isArray(factor) ? factor[0] : factor, 0.5), 0, 1);
        }

        if (nodeKey === "texture.noise" || nodeKey === "texture.wave") {
            const scale =
                Node.resolveInputValue(graph, node.id, "scale", new Set(seen)) ??
                settings.scale ??
                0.5;

            const factor = clamp(toFiniteNumber(scale, 0.5), 0, 1);

            return socket === "color"
                ? [factor, factor, factor, 1]
                : factor;
        }

        if (nodeKey === "color.colorRamp") {
            const factor =
                Node.resolveInputValue(graph, node.id, "factor", new Set(seen)) ??
                settings.factor ??
                settings.position ??
                0.5;

            return socket === "alpha"
                ? clamp(toFiniteNumber(factor, 1), 0, 1)
                : normalizeColorValue(settings.color ?? factor);
        }

        if (nodeKey === "color.brightnessContrast") {
            const source =
                Node.resolveInputValue(graph, node.id, "bitmap", new Set(seen)) ??
                settings.bitmap ??
                0.5;

            const brightness =
                Node.resolveInputValue(graph, node.id, "brightness", new Set(seen)) ??
                settings.brightness ??
                0;

            const contrast =
                Node.resolveInputValue(graph, node.id, "contrast", new Set(seen)) ??
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
                Node.resolveInputValue(graph, node.id, "color", new Set(seen)) ??
                settings.color ??
                [1, 1, 1, 1];

            const gamma = Math.max(
                0.001,
                toFiniteNumber(
                    Node.resolveInputValue(graph, node.id, "gamma", new Set(seen)) ?? settings.gamma,
                    1
                )
            );

            return normalizeColorValue(color).map((channel, index) => (
                index === 3 ? channel : clamp(Math.pow(channel, gamma), 0, 1)
            ));
        }

        if (nodeKey === "color.hsv") {
            const source =
                Node.resolveInputValue(graph, node.id, "bitmap", new Set(seen)) ??
                settings.bitmap ??
                [1, 1, 1, 1];

            const amount = toFiniteNumber(
                Node.resolveInputValue(graph, node.id, "value", new Set(seen)) ?? settings.value,
                1
            );

            return normalizeColorValue(source).map((channel, index) => (
                index === 3 ? channel : clamp(channel * amount, 0, 1)
            ));
        }

        if (nodeKey === "color.invert") {
            const color =
                Node.resolveInputValue(graph, node.id, "color", new Set(seen)) ??
                settings.color ??
                [1, 1, 1, 1];

            const factor = clamp(
                toFiniteNumber(
                    Node.resolveInputValue(graph, node.id, "factor", new Set(seen)) ?? settings.factor,
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
                Node.resolveInputValue(graph, node.id, "bitmap", new Set(seen)) ??
                settings.bitmap ??
                [1, 1, 1, 1];

            return luminanceFromColor(source);
        }

        if (nodeKey === "color.combine") {
            return [
                clamp(toFiniteNumber(Node.resolveInputValue(graph, node.id, "red", new Set(seen)) ?? settings.red, 0), 0, 1),
                clamp(toFiniteNumber(Node.resolveInputValue(graph, node.id, "green", new Set(seen)) ?? settings.green, 0), 0, 1),
                clamp(toFiniteNumber(Node.resolveInputValue(graph, node.id, "blue", new Set(seen)) ?? settings.blue, 0), 0, 1),
                clamp(toFiniteNumber(Node.resolveInputValue(graph, node.id, "alpha", new Set(seen)) ?? settings.alpha, 1), 0, 1),
            ];
        }

        if (nodeKey === "color.separate") {
            const color = normalizeColorValue(
                Node.resolveInputValue(graph, node.id, "color", new Set(seen)) ?? settings.color
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
                toFiniteNumber(Node.resolveInputValue(graph, node.id, "x", new Set(seen)) ?? settings.x, 0),
                toFiniteNumber(Node.resolveInputValue(graph, node.id, "y", new Set(seen)) ?? settings.y, 0),
                toFiniteNumber(Node.resolveInputValue(graph, node.id, "z", new Set(seen)) ?? settings.z, 0),
            ];
        }

        if (nodeKey === "vector.separateXYZ") {
            const vector =
                Node.resolveInputValue(graph, node.id, "vector", new Set(seen)) ??
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
                Node.resolveInputValue(graph, node.id, "vector", new Set(seen)) ??
                settings.vector ??
                [0, 0, 0];

            return toVector3(vector);
        }

        if (socket && settings[socket] !== undefined) {
            return settings[socket];
        }

        const primaryInput = Object.keys(node.inputs || {}).find(input => (
            ["value", "factor", "a", "b", "brightness", "contrast", "color", "bitmap", "vector"].includes(input)
        ));

        if (primaryInput) {
            const incoming = Node.resolveInputValue(graph, node.id, primaryInput, new Set(seen));

            if (incoming !== null && incoming !== undefined) {
                return incoming;
            }
        }

        return settings.value ?? settings.factor ?? settings.strength ?? null;
    }

    static interpolateValue(value, settings = {}) {
        const strength = toFiniteNumber(settings.strength ?? settings.factor ?? 1, 1);
        const offset = toFiniteNumber(settings.offset ?? 0, 0);
        const shouldClamp = settings.clamp !== false;

        const input = strength < 0
            ? 1 - clamp(toFiniteNumber(value ?? 0, 0), 0, 1)
            : toFiniteNumber(value ?? 0, 0);

        const result = input * Math.abs(strength) + offset;

        return shouldClamp ? clamp(result, 0, 1) : result;
    }

    static interpolateColor(color, settings = {}) {
        const source = Array.isArray(color) ? color : [1, 1, 1, 1];
        const strength = toFiniteNumber(settings.strength ?? settings.factor ?? 1, 1);
        const offset = toFiniteNumber(settings.offset ?? 0, 0);
        const shouldClamp = settings.clamp !== false;

        return source.map((channel, index) => {
            if (index === 3) {
                return channel;
            }

            const input = strength < 0
                ? 1 - clamp(toFiniteNumber(channel ?? 0, 0), 0, 1)
                : toFiniteNumber(channel ?? 0, 0);

            const result = input * Math.abs(strength) + offset;

            return shouldClamp ? clamp(result, 0, 1) : result;
        });
    }

    static resolveDisplayValue(node) {
        if (!node) {
            return null;
        }

        const settings = Node.normalizeSettings(node);
        const nodeKey = settings.node_key || "";

        if (nodeKey === "texture.bitmap") {
            return {
                type: "color",
                label: settings.name || settings.url || "Bitmap",
                url: settings.url || "",
                value: Node.interpolateColor([1, 1, 1, 1], settings),
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
            value: Node.interpolateValue(1, settings),
            settings,
        };
    }

    static getResolvedValueText(node) {
        const resolved = Node.resolveDisplayValue(node);

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
    }

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

    static getFieldType(node, fieldKey) {
        const options = Node.getFieldOptions(node, fieldKey);

        if (options.length) {
            return "select";
        }

        const settings = Node.normalizeSettings(node);
        const value = settings[fieldKey];

        if (typeof value === "boolean") {
            return "boolean";
        }

        if (Array.isArray(value)) {
            if (value.length === 4) {
                return "color";
            }

            if (value.length === 3) {
                return "vector3";
            }

            return "vector";
        }

        if (typeof value === "number") {
            return "number";
        }

        return "text";
    }

    static getFieldRange(node, fieldKey) {
        const settings = Node.normalizeSettings(node);
        const value = settings[fieldKey];

        if (typeof value !== "number") {
            return {};
        }

        if (["factor", "strength", "roughness", "lacunarity", "distortion", "density", "scale"].includes(fieldKey)) {
            return { min: 0, max: 1, step: 0.001 };
        }

        if (["detail", "resolution"].includes(fieldKey)) {
            return { min: 0, max: 64, step: 1 };
        }

        if (["temperature"].includes(fieldKey)) {
            return { min: 1000, max: 40000, step: 100 };
        }

        return { step: 0.001 };
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
        ])).map(fieldKey => {
            const type = Node.getFieldType(node, fieldKey);
            const options = Node.getFieldOptions(node, fieldKey);

            return {
                key: fieldKey,
                label: fieldKey === "a" ? "A" : fieldKey === "b" ? "B" : fieldKey.replace(/_/g, " "),
                type,
                items: options,
                ...Node.getFieldRange(node, fieldKey),
            };
        });
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

        if (nodeKey === "shader.volume" && fieldKey === "mode") {
            return ["mesh", "bounds", "shell"];
        }

        if (nodeKey === "shader.volume" && fieldKey === "falloff") {
            return ["linear", "smooth", "exponential"];
        }

        if (nodeKey === "shader.volume" && fieldKey === "sample") {
            return ["inside", "surface", "shell"];
        }

        if (nodeKey === "shader.fluid" && fieldKey === "type") {
            return ["smoke", "fire", "mist", "liquid", "plasma"];
        }

        if (nodeKey === "shader.fluid" && fieldKey === "solver") {
            return ["stable", "flip", "vortex"];
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

        if (nodeKey === "color.colorRamp" && fieldKey === "color_mode") {
            return ["RGB", "HSV", "HSL"];
        }

        if (nodeKey === "color.colorRamp" && fieldKey === "color_interpolation") {
            return ["Linear", "Ease", "Constant", "B-Spline", "Cardinal"];
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
