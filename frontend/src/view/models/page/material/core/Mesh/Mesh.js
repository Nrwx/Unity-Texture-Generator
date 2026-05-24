import { uuid } from "@/utils/uuid";
import { clone } from "@/utils/tools";
import { isFiniteNumber } from "@/utils/math";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { Quaternion } from "@/view/models/page/material/core/Math/Quaternion/Quaternion";
import { CoordinateSystem } from "@/models/layer/3D/core/coordinate/model";

export class Mesh {
    static PRIMITIVE_ORDER = [
        "cube",
        "box",
        "plane",
        "sphere",
        "cylinder",
    ];

    static ATTRIBUTE_LAYOUT = Object.freeze({
        position: {
            location: 0,
            size: 3,
            offset: 0,
        },
        normal: {
            location: 1,
            size: 3,
            offset: 3,
        },
        uv: {
            location: 2,
            size: 2,
            offset: 6,
        },
        tangent: {
            location: 3,
            size: 3,
            offset: 8,
        },
    });

    static POSITION_OFFSET = Mesh.ATTRIBUTE_LAYOUT.position.offset;
    static NORMAL_OFFSET = Mesh.ATTRIBUTE_LAYOUT.normal.offset;
    static UV_OFFSET = Mesh.ATTRIBUTE_LAYOUT.uv.offset;
    static TANGENT_OFFSET = Mesh.ATTRIBUTE_LAYOUT.tangent.offset;
    static STRIDE = 11;

    static FACE_DEFS = Object.freeze({
    front: {
        normal: [0, -1, 0],
        tangent: [1, 0, 0],
        origin: [-0.5, -0.5, -0.5],
        u: [1, 0, 0],
        v: [0, 0, 1],
    },
    back: {
        normal: [0, 1, 0],
        tangent: [-1, 0, 0],
        origin: [0.5, 0.5, -0.5],
        u: [-1, 0, 0],
        v: [0, 0, 1],
    },
    left: {
        normal: [-1, 0, 0],
        tangent: [0, -1, 0],
        origin: [-0.5, 0.5, -0.5],
        u: [0, -1, 0],
        v: [0, 0, 1],
    },
    right: {
        normal: [1, 0, 0],
        tangent: [0, 1, 0],
        origin: [0.5, -0.5, -0.5],
        u: [0, 1, 0],
        v: [0, 0, 1],
    },
    top: {
        normal: [0, 0, 1],
        tangent: [1, 0, 0],
        origin: [-0.5, -0.5, 0.5],
        u: [1, 0, 0],
        v: [0, 1, 0],
    },
    bottom: {
        normal: [0, 0, -1],
        tangent: [1, 0, 0],
        origin: [-0.5, 0.5, -0.5],
        u: [1, 0, 0],
        v: [0, -1, 0],
    },
});
    static COMMON_TRANSFORM_FIELDS = Object.freeze([
        "pivot_x",
        "pivot_y",
        "pivot_z",
        "rotation_x",
        "rotation_y",
        "rotation_z",
        "scale_x",
        "scale_y",
        "scale_z",
    ]);

    static COMMON_SHAPE_FIELDS = Object.freeze([
        "width",
        "height",
        "depth",
    ]);

    static define({
                      key,
                      label,
                      icon,
                      fields = [],
                      defaults = {},
                      builder,
                  }) {
        return Object.freeze({
            key,
            label,
            icon,
            fields,
            defaults: Object.freeze(defaults),
            builder,
        });
    }

    static DEFAULTS = Object.freeze({
        primitive: "cube",

        width: 1,
        height: 1,
        depth: 1,

        bevel: 0,
        bevel_segments: 1,

        subdivision: 0,
        subdivision_type: "simple",
        shade_smooth: true,

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

    static DEFINITIONS = Object.freeze([
        Mesh.define({
            key: "cube",
            label: "Cube",
            icon: "mdi-cube-outline",
            fields: [
                ...Mesh.COMMON_SHAPE_FIELDS,
                "bevel",
                "bevel_segments",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                ...Mesh.COMMON_TRANSFORM_FIELDS,
            ],
            defaults: {
                primitive: "cube",
            },
            builder: settings => Mesh.buildBox(settings, "cube"),
        }),

        Mesh.define({
            key: "box",
            label: "Box",
            icon: "mdi-cube",
            fields: [
                ...Mesh.COMMON_SHAPE_FIELDS,
                "bevel",
                "bevel_segments",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                ...Mesh.COMMON_TRANSFORM_FIELDS,
            ],
            defaults: {
                primitive: "box",
            },
            builder: settings => Mesh.buildBox(settings, "box"),
        }),

        Mesh.define({
            key: "plane",
            label: "Plane",
            icon: "mdi-vector-square",
            fields: [
                "width",
                "height",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                ...Mesh.COMMON_TRANSFORM_FIELDS,
            ],
            defaults: {
                primitive: "plane",
                depth: 0,
            },
            builder: settings => Mesh.buildPlane(settings),
        }),

        Mesh.define({
            key: "sphere",
            label: "Sphere",
            icon: "mdi-sphere",
            fields: [
                ...Mesh.COMMON_SHAPE_FIELDS,
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                ...Mesh.COMMON_TRANSFORM_FIELDS,
            ],
            defaults: {
                primitive: "sphere",
                shade_smooth: true,
            },
            builder: settings => Mesh.buildSphere(settings),
        }),

        Mesh.define({
            key: "cylinder",
            label: "Cylinder",
            icon: "mdi-cylinder",
            fields: [
                ...Mesh.COMMON_SHAPE_FIELDS,
                "bevel",
                "bevel_segments",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                ...Mesh.COMMON_TRANSFORM_FIELDS,
            ],
            defaults: {
                primitive: "cylinder",
            },
            builder: settings => Mesh.buildCylinder(settings),
        }),
    ]);

    static DEFINITION_MAP = Object.freeze(
        Mesh.DEFINITIONS.reduce((acc, definition) => {
            acc[definition.key] = definition;
            return acc;
        }, {})
    );

    static TYPES = Object.freeze(
        Mesh.DEFINITIONS.map(({ key, label, icon }) => ({
            key,
            label,
            icon,
        }))
    );

    static toArray(value) {
        if (ArrayBuffer.isView(value)) {
            return Array.from(value);
        }

        if (Array.isArray(value)) {
            return value.slice();
        }

        if (value && typeof value === "object") {
            return Object.keys(value)
                .sort((a, b) => Number(a) - Number(b))
                .map(key => value[key]);
        }

        return [];
    }

    static read2(vertices, stride, index, offset = Mesh.UV_OFFSET) {
        const base = index * stride + offset;

        return [
            Mesh.toNumber(vertices[base], 0),
            Mesh.toNumber(vertices[base + 1], 0),
        ];
    }

    static write3(vertices, stride, index, value, offset = Mesh.POSITION_OFFSET) {
        const base = index * stride + offset;

        vertices[base] = Mesh.toNumber(value?.[0], 0);
        vertices[base + 1] = Mesh.toNumber(value?.[1], 0);
        vertices[base + 2] = Mesh.toNumber(value?.[2], 0);
    }

    static read3(vertices, stride, index, offset = Mesh.POSITION_OFFSET) {
        const base = index * stride + offset;

        return [
            Mesh.toNumber(vertices[base], 0),
            Mesh.toNumber(vertices[base + 1], 0),
            Mesh.toNumber(vertices[base + 2], 0),
        ];
    }

    static sanitizeTriangleIndices(indices = [], vertexCount = 0, vertices = null, stride = Mesh.STRIDE) {
        const source = Mesh.toIndexArray(indices);
        const next = [];
        const max = Math.max(0, Math.trunc(Mesh.toNumber(vertexCount, 0)));
        const hasGeometry = Array.isArray(vertices) || ArrayBuffer.isView(vertices);
        const safeStride = Math.max(3, Math.trunc(Mesh.toNumber(stride, Mesh.STRIDE)));

        for (let offset = 0; offset + 2 < source.length; offset += 3) {
            const a = source[offset];
            const b = source[offset + 1];
            const c = source[offset + 2];

            if (![a, b, c].every(index => index >= 0 && index < max)) {
                continue;
            }

            if (a === b || b === c || c === a) {
                continue;
            }

            if (hasGeometry) {
                const pa = Mesh.read3(vertices, safeStride, a);
                const pb = Mesh.read3(vertices, safeStride, b);
                const pc = Mesh.read3(vertices, safeStride, c);
                const cross = Mesh.cross3(Mesh.sub3(pb, pa), Mesh.sub3(pc, pa));
                const area2 = Math.hypot(cross[0], cross[1], cross[2]);

                if (!Number.isFinite(area2) || area2 <= 0.00000001) {
                    continue;
                }
            }

            next.push(a, b, c);
        }

        return next;
    }

    static toPlainArray(value = []) {
        if (value instanceof Float32Array || value instanceof Uint32Array || value instanceof Uint16Array) {
            return Array.from(value);
        }

        if (Array.isArray(value)) {
            return value.slice();
        }

        if (value && typeof value === "object" && Number.isInteger(Number(value.length))) {
            return Array.from(value);
        }

        if (value && typeof value === "object") {
            return Object.keys(value)
                .filter(key => /^\d+$/.test(key))
                .sort((a, b) => Number(a) - Number(b))
                .map(key => value[key]);
        }

        return [];
    }

    static createIndexArray(indices, preferredType = "") {
        const maxIndex = indices.reduce((max, item) => Math.max(max, item), 0);

        return preferredType === "uint32" || maxIndex > 65535
            ? new Uint32Array(indices)
            : new Uint16Array(indices);
    }

    static createIndexTypedArray(indices, preferredType = "") {
        return Mesh.createIndexArray(indices, preferredType);
    }

    static finalizeMesh(mesh, { vertices, indices, stride, source = "edit", meta = {} } = {}) {
        const safeStride = Math.max(Mesh.STRIDE, Math.trunc(Mesh.toNumber(stride, Mesh.STRIDE)));
        const sourceVertices = Mesh.upgradeVertexLayout(vertices || [], safeStride);
        const sourceIndices = Mesh.sanitizeTriangleIndices(indices || [], Mesh.vertexCount(sourceVertices, safeStride), sourceVertices, safeStride);
        const nextMesh = {
            ...(mesh || {}),
            stride: safeStride,
            meta: {
                ...(mesh?.meta || {}),
                ...meta,
                source,
                editRevision: Math.trunc(Mesh.toNumber(mesh?.meta?.editRevision, 0)) + 1,
                renderCacheKey: `${mesh?.id || "mesh"}:${source}:${Date.now()}:${sourceVertices.length}:${sourceIndices.length}`,
            },
        };

        Mesh.recomputeNormalsAndBounds(nextMesh, sourceVertices, sourceIndices, safeStride);
        const typedIndices = Mesh.createIndexArray(sourceIndices, mesh?.indexType);

        nextMesh.vertices = new Float32Array(sourceVertices);
        nextMesh.indices = typedIndices;
        nextMesh.indexType = typedIndices instanceof Uint32Array ? "uint32" : "uint16";
        nextMesh.count = typedIndices.length;
        nextMesh.meta.vertexLayout = "position-normal-uv-tangent";

        return nextMesh;
    }

    static recomputeNormalsAndBounds(mesh, vertices, indices, stride) {
        const count = Mesh.vertexCount(vertices, stride);
        const normals = Array.from({ length: count }, () => [0, 0, 0]);
        const bounds = {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
        };

        for (let offset = 0; offset < indices.length; offset += 3) {
            const aIndex = indices[offset];
            const bIndex = indices[offset + 1];
            const cIndex = indices[offset + 2];

            if (![aIndex, bIndex, cIndex].every(index => index >= 0 && index < count)) {
                continue;
            }

            const normal = Mesh.triangleNormal(
                Mesh.read3(vertices, stride, aIndex),
                Mesh.read3(vertices, stride, bIndex),
                Mesh.read3(vertices, stride, cIndex),
            );

            normals[aIndex] = Mesh.add3(normals[aIndex], normal);
            normals[bIndex] = Mesh.add3(normals[bIndex], normal);
            normals[cIndex] = Mesh.add3(normals[cIndex], normal);
        }

        for (let index = 0; index < count; index += 1) {
            const point = Mesh.read3(vertices, stride, index);
            const normal = Mesh.normalize3(normals[index], Mesh.read3(vertices, stride, index, Mesh.NORMAL_OFFSET));

            Mesh.write3(vertices, stride, index, normal, Mesh.NORMAL_OFFSET);

            bounds.min[0] = Math.min(bounds.min[0], point[0]);
            bounds.min[1] = Math.min(bounds.min[1], point[1]);
            bounds.min[2] = Math.min(bounds.min[2], point[2]);
            bounds.max[0] = Math.max(bounds.max[0], point[0]);
            bounds.max[1] = Math.max(bounds.max[1], point[1]);
            bounds.max[2] = Math.max(bounds.max[2], point[2]);
        }

        if (bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)) {
            mesh.bounds = bounds;
        }

        return mesh;
    }

    static addVertex(vertices, stride, point = [0, 0, 0], sourceIndex = 0) {
        const baseIndex = Mesh.vertexCount(vertices, stride) > 0
            ? Math.max(0, Math.min(Mesh.vertexCount(vertices, stride) - 1, Number(sourceIndex) | 0))
            : 0;

        const template = Mesh.vertexCount(vertices, stride) > 0
            ? Mesh.cloneVertex(vertices, stride, baseIndex)
            : new Array(stride).fill(0);

        const position = point;

        const normal = [
            template[Mesh.NORMAL_OFFSET] || 0,
            template[Mesh.NORMAL_OFFSET + 1] || 0,
            template[Mesh.NORMAL_OFFSET + 2] || 1,
        ];

        const uv = [
            template[Mesh.UV_OFFSET] || 0,
            template[Mesh.UV_OFFSET + 1] || 0,
        ];

        const tangent = [
            template[Mesh.TANGENT_OFFSET] || 1,
            template[Mesh.TANGENT_OFFSET + 1] || 0,
            template[Mesh.TANGENT_OFFSET + 2] || 0,
        ];

        Mesh.pushVertex(vertices, position, normal, uv, tangent);

        return vertices.length / stride - 1;
    }

    static averageFaceNormal(vertices, indices, stride, faceIndices = []) {
        const total = [0, 0, 0];
        let count = 0;

        faceIndices.forEach(faceIndex => {
            const offset = Math.trunc(Number(faceIndex) || 0) * 3;

            if (offset + 2 >= indices.length) {
                return;
            }

            const normal = Mesh.triangleNormal(
                Mesh.read3(vertices, stride, indices[offset]),
                Mesh.read3(vertices, stride, indices[offset + 1]),
                Mesh.read3(vertices, stride, indices[offset + 2]),
            );

            total[0] += normal[0];
            total[1] += normal[1];
            total[2] += normal[2];
            count += 1;
        });

        return count > 0 ? Mesh.normalize3(total) : [0, 0, 1];
    }

    static resetUv(mesh) {
        if (!mesh?.vertices || !mesh?.stride) {
            return mesh;
        }

        const vertices = Mesh.toArray(mesh.vertices);
        const stride = Math.max(3, Math.trunc(Number(mesh.stride) || Mesh.STRIDE));
        const count = Mesh.vertexCount(vertices, stride);

        if (stride <= Mesh.UV_OFFSET + 1) {
            return mesh;
        }

        const bounds = mesh.bounds || { min: [0, 0, 0], max: [1, 1, 1] };
        const spanX = Math.max(0.000001, Mesh.toNumber(bounds.max?.[0], 1) - Mesh.toNumber(bounds.min?.[0], 0));
        const spanY = Math.max(0.000001, Mesh.toNumber(bounds.max?.[1], 1) - Mesh.toNumber(bounds.min?.[1], 0));

        for (let index = 0; index < count; index += 1) {
            const point = Mesh.read3(vertices, stride, index);
            const base = index * stride + Mesh.UV_OFFSET;
            vertices[base] = (point[0] - Mesh.toNumber(bounds.min?.[0], 0)) / spanX;
            vertices[base + 1] = (point[1] - Mesh.toNumber(bounds.min?.[1], 0)) / spanY;
        }

        mesh.vertices = new Float32Array(vertices);
        mesh.meta = {
            ...(mesh.meta || {}),
            uvReset: true,
            uvRevision: Math.trunc(Mesh.toNumber(mesh.meta?.uvRevision, 0)) + 1,
        };

        return mesh;
    }

    static toIndexArray(value) {
        return Mesh.toArray(value)
            .map(item => Math.max(0, Math.trunc(Number(item) || 0)));
    }

    static edgeKey(a, b) {
        const left = Math.max(0, Math.trunc(Number(a) || 0));
        const right = Math.max(0, Math.trunc(Number(b) || 0));

        return left < right ? `${left}:${right}` : `${right}:${left}`;
    }

    static parseEdgeKey(key) {
        return String(key || "")
            .split(":")
            .map(value => Math.max(0, Math.trunc(Number(value) || 0)));
    }

    static unique(values = []) {
        return Array.from(new Set(values));
    }

    static vertexCount(vertices, stride = Mesh.STRIDE) {
        return Math.floor((vertices?.length || 0) / Math.max(1, stride));
    }

    static get(primitive) {
        if (typeof primitive === "object" && primitive?.primitive) {
            return Mesh.DEFINITION_MAP[primitive.primitive] || Mesh.DEFINITION_MAP.cube;
        }

        return Mesh.DEFINITION_MAP[primitive] || Mesh.DEFINITION_MAP.cube;
    }

    static has(primitive) {
        return Boolean(Mesh.DEFINITION_MAP[primitive]);
    }

    static getDefaults(primitive = "cube") {
        const definition = Mesh.get(primitive);

        return {
            ...clone(Mesh.DEFAULTS),
            ...clone(definition?.defaults || {}),
        };
    }

    static normalizeSettings(settings = {}) {
        const primitive = String(settings?.primitive || "cube").toLowerCase();
        const definition = Mesh.get(primitive);
        const defaults = Mesh.getDefaults(definition.key);

        return {
            ...defaults,
            ...(settings || {}),
            primitive: definition.key,

            width: Mesh.toNumber(settings.width ?? defaults.width, defaults.width),
            height: Mesh.toNumber(settings.height ?? defaults.height, defaults.height),
            depth: Mesh.toNumber(settings.depth ?? defaults.depth, defaults.depth),

            bevel: Mesh.clampNumber(settings.bevel ?? defaults.bevel, 0, 0.5, defaults.bevel),
            bevel_segments: Mesh.clampInt(settings.bevel_segments ?? defaults.bevel_segments, 1, 32, defaults.bevel_segments),

            subdivision: Mesh.clampInt(settings.subdivision ?? defaults.subdivision, 0, 6, defaults.subdivision),
            subdivision_type: ["simple", "catmull-clark"].includes(settings.subdivision_type)
                ? settings.subdivision_type
                : defaults.subdivision_type,
            shade_smooth: settings.shade_smooth === true,

            uv_fit: ["stretch", "contain", "cover", "tile", "world"].includes(settings.uv_fit)
                ? settings.uv_fit
                : defaults.uv_fit,
            uv_density: Mesh.clampNumber(settings.uv_density ?? defaults.uv_density, 0.001, 100, defaults.uv_density),

            pivot_x: Mesh.toNumber(settings.pivot_x ?? defaults.pivot_x, defaults.pivot_x),
            pivot_y: Mesh.toNumber(settings.pivot_y ?? defaults.pivot_y, defaults.pivot_y),
            pivot_z: Mesh.toNumber(settings.pivot_z ?? defaults.pivot_z, defaults.pivot_z),

            rotation_x: Mesh.toNumber(settings.rotation_x ?? defaults.rotation_x, defaults.rotation_x),
            rotation_y: Mesh.toNumber(settings.rotation_y ?? defaults.rotation_y, defaults.rotation_y),
            rotation_z: Mesh.toNumber(settings.rotation_z ?? defaults.rotation_z, defaults.rotation_z),

            scale_x: Mesh.toNumber(settings.scale_x ?? defaults.scale_x, defaults.scale_x),
            scale_y: Mesh.toNumber(settings.scale_y ?? defaults.scale_y, defaults.scale_y),
            scale_z: Mesh.toNumber(settings.scale_z ?? defaults.scale_z, defaults.scale_z),
        };
    }

    static create(settings = {}, options = {}) {
        const normalized = Mesh.normalizeSettings(settings);
        const definition = Mesh.get(normalized.primitive);
        const built = definition.builder(normalized);

        return {
            id: options.id || uuid("mesh"),
            primitive: normalized.primitive,
            label: options.label || definition.label,
            icon: definition.icon,
            settings: normalized,

            stride: Mesh.STRIDE,
            vertices: built.vertices,
            indices: built.indices,
            indexType: built.indexType,
            count: built.count,
            parts: built.parts,

            bounds: Mesh.computeBounds(built.vertices),
            meta: {
                rootKey: options.rootKey || "",
                generated: true,
                source: options.source || "geometry",
                context: options.context || null,

                cacheKey: Mesh.getCacheKey(normalized),
                renderCacheKey: Mesh.getRenderCacheKey(normalized),

                vertexCount: built.vertices.length / Mesh.STRIDE,
                indexCount: built.indices.length,
                triangleCount: built.indices.length / 3,
                partCount: built.parts.length,
                hasBevel: normalized.bevel > 0,
                bevelApplied: false,
                subdivision: normalized.subdivision,
                subdivisionType: normalized.subdivision_type,
                shadeSmooth: normalized.shade_smooth,
            },
        };
    }

    static toPlain(mesh = null) {
        if (!mesh) {
            return null;
        }

        const sourceStride = Math.max(3, Math.trunc(Mesh.toNumber(mesh.stride, Mesh.STRIDE)));
        const vertices = Mesh.upgradeVertexLayout(Mesh.toPlainArray(mesh.vertices), sourceStride)
            .map(value => Mesh.toNumber(value, 0));

        const indices = Mesh.sanitizeTriangleIndices(
            Mesh.toPlainArray(mesh.indices),
            Mesh.vertexCount(vertices, Mesh.STRIDE),
        );

        const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
        const settings = Mesh.normalizeSettings(mesh.settings || mesh);

        return {
            id: mesh.id || "",
            primitive: mesh.primitive || settings.primitive,
            label: mesh.label || Mesh.get(settings.primitive).label,
            icon: mesh.icon || Mesh.get(settings.primitive).icon,
            vertices,
            indices,
            stride: Mesh.STRIDE,
            indexType: mesh.indexType || (maxIndex > 65535 ? "uint32" : "uint16"),
            count: indices.length,
            parts: JSON.parse(JSON.stringify(mesh.parts || [])),
            bounds: JSON.parse(JSON.stringify(mesh.bounds || {})),
            settings,
            meta: JSON.parse(JSON.stringify(mesh.meta || {})),
        };
    }

    static fromPlain(mesh = null, fallbackSettings = {}) {
        if (!mesh || !mesh.vertices || !mesh.indices) {
            return Mesh.create(fallbackSettings);
        }

        const sourceStride = Math.max(3, Math.trunc(Mesh.toNumber(mesh.stride, Mesh.STRIDE)));
        const vertexArray = Mesh.upgradeVertexLayout(Mesh.toPlainArray(mesh.vertices), sourceStride);
        const indexArray = Mesh.sanitizeTriangleIndices(
            Mesh.toPlainArray(mesh.indices),
            Mesh.vertexCount(vertexArray, Mesh.STRIDE),
        );
        const maxIndex = indexArray.reduce((max, index) => Math.max(max, Number(index) || 0), 0);
        const indices = (mesh.indexType === "uint32" || maxIndex > 65535)
            ? new Uint32Array(indexArray)
            : new Uint16Array(indexArray);
        const vertices = new Float32Array(vertexArray);
        const settings = Mesh.normalizeSettings(mesh.settings || fallbackSettings);

        return {
            ...mesh,
            primitive: mesh.primitive || settings.primitive,
            label: mesh.label || Mesh.get(settings.primitive).label,
            icon: mesh.icon || Mesh.get(settings.primitive).icon,
            settings,
            stride: Mesh.STRIDE,
            vertices,
            indices,
            indexType: indices instanceof Uint32Array ? "uint32" : "uint16",
            count: indices.length,
            parts: clone(mesh.parts || []),
            bounds: mesh.bounds || Mesh.computeBounds(vertices),
            meta: {
                ...clone(mesh.meta || {}),
                vertexLayout: "position-normal-uv-tangent",
            },
        };
    }

    static reset(meshOrSettings = {}, options = {}) {
        const settings = meshOrSettings?.settings || meshOrSettings || {};

        return Mesh.create(settings, {
            id: meshOrSettings?.id || options.id,
            ...options,
        });
    }

    static update(parameters, patch = {}, options = {}) {
        if (!parameters) {
            return null;
        }

        parameters.geometry = {
            ...(parameters.geometry || {}),
            ...(patch.geometry || patch || {}),
        };

        parameters.mesh = Mesh.reset(parameters.geometry, {
            id: parameters.mesh?.id,
            ...options,
        });

        return parameters.mesh;
    }

    static createOverlay(mesh) {
        const linePositions = [];
        const pointPositions = [];
        const facePositions = [];
        const seenEdges = new Set();
        const seenPoints = new Set();

        const addEdge = (from, to) => {
            const a = Math.min(from, to);
            const b = Math.max(from, to);
            const key = `${a}:${b}`;

            if (seenEdges.has(key)) {
                return;
            }

            seenEdges.add(key);

            linePositions.push(
                ...Mesh.getPosition(mesh, from),
                ...Mesh.getPosition(mesh, to)
            );
        };

        for (let i = 0; i < mesh.indices.length; i += 3) {
            const a = mesh.indices[i];
            const b = mesh.indices[i + 1];
            const c = mesh.indices[i + 2];

            addEdge(a, b);
            addEdge(b, c);
            addEdge(c, a);

            facePositions.push(
                ...Mesh.getPosition(mesh, a),
                ...Mesh.getPosition(mesh, b),
                ...Mesh.getPosition(mesh, c)
            );

            [a, b, c].forEach(index => {
                if (seenPoints.has(index)) {
                    return;
                }

                seenPoints.add(index);
                pointPositions.push(...Mesh.getPosition(mesh, index));
            });
        }

        return {
            linePositions: new Float32Array(linePositions),
            pointPositions: new Float32Array(pointPositions),
            facePositions: new Float32Array(facePositions),

            lineCount: linePositions.length / 3,
            pointCount: pointPositions.length / 3,
            faceCount: facePositions.length / 3,

            edgeCount: seenEdges.size,
            vertexCount: seenPoints.size,
        };
    }

    static getPosition(mesh, index) {
        const offset = index * mesh.stride;

        return [
            mesh.vertices[offset],
            mesh.vertices[offset + 1],
            mesh.vertices[offset + 2],
        ];
    }

    static getFields(meshOrPrimitive) {
        const definition = typeof meshOrPrimitive === "object"
            ? Mesh.get(meshOrPrimitive.primitive || meshOrPrimitive.settings?.primitive)
            : Mesh.get(meshOrPrimitive);

        return definition?.fields || [];
    }

    static getTypes() {
        return Mesh.TYPES;
    }

    static getCacheKey(settings = {}) {
        const normalized = Mesh.normalizeSettings(settings);

        return JSON.stringify({
            primitive: normalized.primitive,

            bevel: normalized.bevel,
            bevel_segments: normalized.bevel_segments,

            subdivision: normalized.subdivision,
            subdivision_type: normalized.subdivision_type,
            shade_smooth: normalized.shade_smooth,

            uv_fit: normalized.uv_fit,
            uv_density: normalized.uv_density,
        });
    }

    static getRenderCacheKey(settings = {}) {
        const normalized = Mesh.normalizeSettings(settings);

        return JSON.stringify({
            primitive: normalized.primitive,
            subdivision: normalized.subdivision,
            subdivision_type: normalized.subdivision_type,
            shade_smooth: normalized.shade_smooth,
            uv_fit: normalized.uv_fit,
            uv_density: normalized.uv_density,
            bevel: normalized.bevel,
            bevel_segments: normalized.bevel_segments,
        });
    }

    static buildBox(settings, primitive = "box") {
        const divisions = Mesh.resolveDivisions(settings);
        const vertices = [];
        const indices = [];
        const parts = [];

        Object.entries(Mesh.FACE_DEFS).forEach(([faceName, def]) => {
            parts.push(Mesh.buildPlanePart({
                faceName,
                origin: def.origin,
                uAxis: def.u,
                vAxis: def.v,
                normal: def.normal,
                tangent: def.tangent,
                divisions,
                vertices,
                indices,
            }));
        });

        return Mesh.finalizeBuild({
            primitive,
            vertices,
            indices,
            parts,
        });
    }

    static buildPlane(settings) {
        const divisions = Mesh.resolveDivisions(settings);
        const vertices = [];
        const indices = [];

        const part = Mesh.buildPlanePart({
            faceName: "front",
            origin: [-0.5, -0.5, 0],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0],
            normal: [0, 0, 1],
            tangent: [1, 0, 0],
            divisions,
            vertices,
            indices,
        });

        return Mesh.finalizeBuild({
            primitive: "plane",
            vertices,
            indices,
            parts: [part],
        });
    }

    static buildSphere(settings) {
        const { segments, rings } = Mesh.resolveSphereResolution(settings);
        const vertices = [];
        const indices = [];

        const parts = [{
            name: "sphere",
            faceName: "front",
            start: 0,
            count: 0,
            materialSlot: "front",
        }];

        /**
         * Echte Pole-Sphere:
         *
         * - Top-Pol: 1 Vertex
         * - Bottom-Pol: 1 Vertex
         * - Zwischenringe: rings - 1
         * - Pro Zwischenring segments + 1 Vertices wegen UV-Seam
         *
         * Dadurch vermeiden wir:
         * - duplizierte Pole
         * - degenerierte Pol-Dreiecke
         * - unnötige Indices
         */

        const radius = 0.5;
        const ringCount = Math.max(1, rings - 1);

        const sinPhi = new Array(segments + 1);
        const cosPhi = new Array(segments + 1);

        for (let x = 0; x <= segments; x += 1) {
            const u = x / segments;
            const phi = u * Math.PI * 2;

            sinPhi[x] = Math.sin(phi);
            cosPhi[x] = Math.cos(phi);
        }

        const pushRawVertex = (
            px, py, pz,
            nx, ny, nz,
            u, v,
            tx, ty, tz
        ) => {
            vertices.push(
                px, py, pz,
                nx, ny, nz,
                u, v,
                tx, ty, tz
            );
        };

        // Top pole (Z-up engine space).
        const topIndex = 0;

        pushRawVertex(
            0, 0, radius,
            0, 0, 1,
            0.5, 1,
            1, 0, 0
        );

        const firstRingIndex = vertices.length / Mesh.STRIDE;

        // Intermediate rings, excluding poles.
        for (let y = 1; y < rings; y += 1) {
            const v = y / rings;
            const theta = v * Math.PI;
            const st = Math.sin(theta);
            const ct = Math.cos(theta);

            for (let x = 0; x <= segments; x += 1) {
                const u = x / segments;

                const sp = sinPhi[x];
                const cp = cosPhi[x];

                const nx = cp * st;
                const ny = sp * st;
                const nz = ct;

                // Lat-long tangent around the Z-up vertical axis.
                const tx = -sp;
                const ty = cp;
                const tz = 0;

                pushRawVertex(
                    nx * radius,
                    ny * radius,
                    nz * radius,

                    nx,
                    ny,
                    nz,

                    u,
                    1 - v,

                    tx,
                    ty,
                    tz
                );
            }
        }

        const bottomIndex = vertices.length / Mesh.STRIDE;

        // Bottom pole (Z-up engine space).
        pushRawVertex(
            0, 0, -radius,
            0, 0, -1,
            0.5, 0,
            1, 0, 0
        );

        const row = segments + 1;

        const ringVertexIndex = (ring, x) => {
            // ring is 0-based for intermediate rings.
            return firstRingIndex + ring * row + x;
        };

        // Top cap
        if (ringCount > 0) {
            for (let x = 0; x < segments; x += 1) {
                const current = ringVertexIndex(0, x);
                const next = ringVertexIndex(0, x + 1);

                // Winding chosen for outward normals.
                indices.push(topIndex, next, current);
            }
        }

        // Body quads between intermediate rings
        for (let y = 0; y < ringCount - 1; y += 1) {
            for (let x = 0; x < segments; x += 1) {
                const a = ringVertexIndex(y, x);
                const b = ringVertexIndex(y, x + 1);
                const c = ringVertexIndex(y + 1, x);
                const d = ringVertexIndex(y + 1, x + 1);

                indices.push(
                    a, b, c,
                    b, d, c
                );
            }
        }

        // Bottom cap
        if (ringCount > 0) {
            const lastRing = ringCount - 1;

            for (let x = 0; x < segments; x += 1) {
                const current = ringVertexIndex(lastRing, x);
                const next = ringVertexIndex(lastRing, x + 1);

                // Winding chosen for outward normals.
                indices.push(bottomIndex, current, next);
            }
        }

        parts[0].count = indices.length;

        return Mesh.finalizeBuild({
            primitive: "sphere",
            vertices,
            indices,
            parts,
        });
    }

    static buildCylinder(settings) {
        const { radial, height } = Mesh.resolveCylinderResolution(settings);
        const vertices = [];
        const indices = [];
        const parts = [];

        const sideStart = indices.length;
        const row = radial + 1;

        for (let y = 0; y <= height; y += 1) {
            const v = y / height;
            const pz = -0.5 + v;

            for (let x = 0; x <= radial; x += 1) {
                const u = x / radial;
                const angle = u * Math.PI * 2;
                const cx = Math.cos(angle);
                const sy = Math.sin(angle);

                const position = [cx * 0.5, sy * 0.5, pz];
                const normal = [cx, sy, 0];
                const tangent = Mesh.normalize3([-sy, cx, 0]);

                Mesh.pushVertex(vertices, position, normal, [u, 1 - v], tangent);
            }
        }

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < radial; x += 1) {
                const a = y * row + x;
                const b = a + 1;
                const c = a + row;
                const d = c + 1;

                indices.push(a, b, d, a, d, c);
            }
        }

        parts.push({
            name: "side",
            faceName: "front",
            start: sideStart,
            count: indices.length - sideStart,
            materialSlot: "front",
        });

        Mesh.buildCylinderCap({
            faceName: "top",
            axisValue: 0.5,
            normal: [0, 0, 1],
            radial,
            vertices,
            indices,
            parts,
            flip: false,
        });

        Mesh.buildCylinderCap({
            faceName: "bottom",
            axisValue: -0.5,
            normal: [0, 0, -1],
            radial,
            vertices,
            indices,
            parts,
            flip: true,
        });

        return Mesh.finalizeBuild({
            primitive: "cylinder",
            vertices,
            indices,
            parts,
        });
    }

    static buildPlanePart({
                              faceName,
                              origin,
                              uAxis,
                              vAxis,
                              normal,
                              tangent,
                              divisions,
                              vertices,
                              indices,
                          }) {
        const startIndex = vertices.length / Mesh.STRIDE;
        const startElement = indices.length;
        const row = divisions + 1;

        for (let y = 0; y <= divisions; y += 1) {
            for (let x = 0; x <= divisions; x += 1) {
                const u = x / divisions;
                const v = y / divisions;

                const position = [
                    origin[0] + uAxis[0] * u + vAxis[0] * v,
                    origin[1] + uAxis[1] * u + vAxis[1] * v,
                    origin[2] + uAxis[2] * u + vAxis[2] * v,
                ];

                Mesh.pushVertex(
                    vertices,
                    position,
                    normal,
                    [u, 1 - v],
                    tangent
                );
            }
        }

        for (let y = 0; y < divisions; y += 1) {
            for (let x = 0; x < divisions; x += 1) {
                const a = startIndex + y * row + x;
                const b = a + 1;
                const c = a + row;
                const d = c + 1;

                indices.push(a, b, d, a, d, c);
            }
        }

        return {
            name: faceName,
            faceName,
            start: startElement,
            count: indices.length - startElement,
            materialSlot: faceName,
        };
    }

    static buildCylinderCap({
                                faceName,
                                axisValue,
                                normal,
                                radial,
                                vertices,
                                indices,
                                parts,
                                flip = false,
                            }) {
        const start = indices.length;
        const centerIndex = vertices.length / Mesh.STRIDE;

        Mesh.pushVertex(
            vertices,
            [0, 0, axisValue],
            normal,
            [0.5, 0.5],
            [1, 0, 0]
        );

        for (let x = 0; x <= radial; x += 1) {
            const u = x / radial;
            const angle = u * Math.PI * 2;
            const cx = Math.cos(angle);
            const sy = Math.sin(angle);

            Mesh.pushVertex(
                vertices,
                [cx * 0.5, sy * 0.5, axisValue],
                normal,
                [cx * 0.5 + 0.5, sy * 0.5 + 0.5],
                [1, 0, 0]
            );
        }

        for (let x = 0; x < radial; x += 1) {
            const a = centerIndex;
            const b = centerIndex + x + 1;
            const c = centerIndex + x + 2;

            if (flip) {
                indices.push(a, c, b);
            } else {
                indices.push(a, b, c);
            }
        }

        parts.push({
            name: faceName,
            faceName,
            start,
            count: indices.length - start,
            materialSlot: faceName,
        });
    }

    static finalizeBuild({
                             primitive,
                             vertices,
                             indices,
                             parts,
                         }) {
        const typedIndices = Mesh.createIndexArray(indices);

        return {
            primitive,
            stride: Mesh.STRIDE,
            vertices: new Float32Array(vertices),
            indices: typedIndices,
            indexType: typedIndices instanceof Uint32Array ? "uint32" : "uint16",
            count: typedIndices.length,
            parts,
        };
    }

    static resolveDivisions(settings = {}) {
        const subdivision = Mesh.clampInt(settings.subdivision, 0, 6, 0);

        return Math.max(1, Math.min(64, 2 ** subdivision));
    }

    static resolveSphereResolution(settings = {}) {
        const subdivision = Mesh.clampInt(settings.subdivision, 0, 6, 0);

        const presets = [
            { segments: 16, rings: 8 },
            { segments: 24, rings: 12 },
            { segments: 32, rings: 16 },
            { segments: 48, rings: 24 },
            { segments: 64, rings: 32 },
            { segments: 72, rings: 36 },
            { segments: 96, rings: 48 },
        ];

        return presets[subdivision] || presets[0];
    }

    static resolveCylinderResolution(settings = {}) {
        const subdivision = Mesh.clampInt(settings.subdivision, 0, 6, 0);

        return {
            radial: Math.min(128, Math.max(12, 12 + subdivision * 10)),
            height: Math.max(1, Math.min(64, 1 + subdivision * 2)),
        };
    }

    static cloneVertex(vertices, stride, index) {
        return vertices.slice(index * stride, index * stride + stride);
    }

    static pushClonedVertex(vertices, stride, index, position = null) {
        const template = Mesh.cloneVertex(vertices, stride, index);
        const next = Mesh.upgradeVertexLayout(template, Math.max(3, Math.trunc(Mesh.toNumber(stride, Mesh.STRIDE))));

        if (Array.isArray(position)) {
            next[Mesh.POSITION_OFFSET] = Mesh.toNumber(position[0], 0);
            next[Mesh.POSITION_OFFSET + 1] = Mesh.toNumber(position[1], 0);
            next[Mesh.POSITION_OFFSET + 2] = Mesh.toNumber(position[2], 0);
        }

        Mesh.pushVertexArray(vertices, Mesh.STRIDE, next);
        return Mesh.vertexCount(vertices, Mesh.STRIDE) - 1;
    }

    static pushVertex(vertices, position, normal, uv, tangent) {
        vertices.push(
            position[0], position[1], position[2],
            normal[0], normal[1], normal[2],
            uv[0], uv[1],
            tangent[0], tangent[1], tangent[2]
        );
    }

    static pushVertexArray(vertices, stride, template) {
        const safeStride = Math.max(Mesh.STRIDE, Math.trunc(Number(stride) || Mesh.STRIDE));
        const source = Array.isArray(template) ? template : Array.from(template || []);
        const next = new Array(safeStride).fill(0);

        for (let index = 0; index < Math.min(source.length, safeStride); index += 1) {
            next[index] = Mesh.toNumber(source[index], 0);
        }

        if (safeStride >= Mesh.NORMAL_OFFSET + 3) {
            next[Mesh.NORMAL_OFFSET] = Mesh.toNumber(next[Mesh.NORMAL_OFFSET], 0);
            next[Mesh.NORMAL_OFFSET + 1] = Mesh.toNumber(next[Mesh.NORMAL_OFFSET + 1], 0);
            next[Mesh.NORMAL_OFFSET + 2] = Mesh.toNumber(next[Mesh.NORMAL_OFFSET + 2], 1);
        }

        if (safeStride >= Mesh.TANGENT_OFFSET + 3) {
            next[Mesh.TANGENT_OFFSET] = Mesh.toNumber(next[Mesh.TANGENT_OFFSET], 1);
            next[Mesh.TANGENT_OFFSET + 1] = Mesh.toNumber(next[Mesh.TANGENT_OFFSET + 1], 0);
            next[Mesh.TANGENT_OFFSET + 2] = Mesh.toNumber(next[Mesh.TANGENT_OFFSET + 2], 0);
        }

        vertices.push(...next);
    }

    static normalize3(vector, fallback = [0, 0, 1]) {
        const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

        if (!isFiniteNumber(length) || length <= 0) {
            return fallback.slice();
        }

        return [
            vector[0] / length,
            vector[1] / length,
            vector[2] / length,
        ];
    }

    static midpointVertex(vertices, stride, a, b) {
        const pa = Mesh.read3(vertices, stride, a, Mesh.POSITION_OFFSET);
        const pb = Mesh.read3(vertices, stride, b, Mesh.POSITION_OFFSET);

        const na = Mesh.read3(vertices, stride, a, Mesh.NORMAL_OFFSET);
        const nb = Mesh.read3(vertices, stride, b, Mesh.NORMAL_OFFSET);

        const ta = Mesh.read3(vertices, stride, a, Mesh.TANGENT_OFFSET);
        const tb = Mesh.read3(vertices, stride, b, Mesh.TANGENT_OFFSET);

        const uva = Mesh.read2(vertices, stride, a, Mesh.UV_OFFSET);
        const uvb = Mesh.read2(vertices, stride, b, Mesh.UV_OFFSET);

        const pos = [
            (pa[0] + pb[0]) * 0.5,
            (pa[1] + pb[1]) * 0.5,
            (pa[2] + pb[2]) * 0.5,
        ];

        const normal = [
            (na[0] + nb[0]) * 0.5,
            (na[1] + nb[1]) * 0.5,
            (na[2] + nb[2]) * 0.5,
        ];

        const tangent = [
            (ta[0] + tb[0]) * 0.5,
            (ta[1] + tb[1]) * 0.5,
            (ta[2] + tb[2]) * 0.5,
        ];

        const uv = [
            (uva[0] + uvb[0]) * 0.5,
            (uva[1] + uvb[1]) * 0.5,
        ];

        return Mesh.packVertex(pos, normal, uv, tangent);
    }

    static packVertex(position, normal, uv, tangent) {
        return [
            position[0], position[1], position[2],
            normal[0], normal[1], normal[2],
            uv[0], uv[1],
            tangent[0], tangent[1], tangent[2],
        ];
    }

    static add3(a, b) {
        return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    }

    static sub3(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }

    static cross3(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
    }

    static triangleNormal(a, b, c) {
        return Mesh.normalize3(Mesh.cross3(Mesh.sub3(b, a), Mesh.sub3(c, a)));
    }

    static upgradeVertexLayout(vertices, stride) {
        const sourceStride = Math.max(3, Math.trunc(Mesh.toNumber(stride, Mesh.STRIDE)));
        const source = Mesh.toArray(vertices).map(value => Mesh.toNumber(value, 0));
        const count = Mesh.vertexCount(source, sourceStride);

        if (sourceStride >= Mesh.STRIDE) {
            return source;
        }

        const bounds = Mesh.computeBoundsForStride(source, sourceStride);
        const spanX = Math.max(0.000001, bounds.max[0] - bounds.min[0]);
        const spanY = Math.max(0.000001, bounds.max[1] - bounds.min[1]);
        const next = [];

        for (let index = 0; index < count; index += 1) {
            const base = index * sourceStride;
            const position = [
                Mesh.toNumber(source[base], 0),
                Mesh.toNumber(source[base + 1], 0),
                Mesh.toNumber(source[base + 2], 0),
            ];
            const normal = sourceStride >= Mesh.NORMAL_OFFSET + 3
                ? [
                    Mesh.toNumber(source[base + Mesh.NORMAL_OFFSET], 0),
                    Mesh.toNumber(source[base + Mesh.NORMAL_OFFSET + 1], 0),
                    Mesh.toNumber(source[base + Mesh.NORMAL_OFFSET + 2], 1),
                ]
                : [0, 0, 1];
            const uv = sourceStride >= Mesh.UV_OFFSET + 2
                ? [
                    Mesh.toNumber(source[base + Mesh.UV_OFFSET], 0),
                    Mesh.toNumber(source[base + Mesh.UV_OFFSET + 1], 0),
                ]
                : [
                    (position[0] - bounds.min[0]) / spanX,
                    (position[1] - bounds.min[1]) / spanY,
                ];
            const tangent = sourceStride >= Mesh.TANGENT_OFFSET + 3
                ? [
                    Mesh.toNumber(source[base + Mesh.TANGENT_OFFSET], 1),
                    Mesh.toNumber(source[base + Mesh.TANGENT_OFFSET + 1], 0),
                    Mesh.toNumber(source[base + Mesh.TANGENT_OFFSET + 2], 0),
                ]
                : [1, 0, 0];

            Mesh.pushVertex(next, position, normal, uv, tangent);
        }

        return next;
    }

    static computeBoundsForStride(vertices, stride = Mesh.STRIDE) {
        const sourceStride = Math.max(3, Math.trunc(Mesh.toNumber(stride, Mesh.STRIDE)));
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        for (let i = 0; i + 2 < vertices.length; i += sourceStride) {
            min[0] = Math.min(min[0], Mesh.toNumber(vertices[i], 0));
            min[1] = Math.min(min[1], Mesh.toNumber(vertices[i + 1], 0));
            min[2] = Math.min(min[2], Mesh.toNumber(vertices[i + 2], 0));
            max[0] = Math.max(max[0], Mesh.toNumber(vertices[i], 0));
            max[1] = Math.max(max[1], Mesh.toNumber(vertices[i + 1], 0));
            max[2] = Math.max(max[2], Mesh.toNumber(vertices[i + 2], 0));
        }

        if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) {
            return { min: [0, 0, 0], max: [1, 1, 1] };
        }

        return { min, max };
    }

    static normalizeEditableMesh(mesh) {
        if (!mesh?.vertices || !mesh?.indices) {
            return null;
        }

        const sourceStride = Math.max(3, Math.trunc(Mesh.toNumber(mesh.stride, Mesh.STRIDE)));
        const vertices = Mesh.upgradeVertexLayout(Mesh.toPlainArray(mesh.vertices), sourceStride);
        const stride = Mesh.STRIDE;
        const indices = Mesh.sanitizeTriangleIndices(Mesh.toPlainArray(mesh.indices), Mesh.vertexCount(vertices, stride));
        const vertexCount = Mesh.vertexCount(vertices, stride);

        if (vertexCount <= 0 || indices.length < 3) {
            return null;
        }

        return { stride, vertices, indices, vertexCount };
    }

    static buildNeighbors(indices, vertices, stride) {
        const neighbors = new Map();
        const addNeighbor = (from, to) => {
            if (!neighbors.has(from)) {
                neighbors.set(from, []);
            }
            neighbors.get(from).push(Mesh.read3(vertices, stride, to));
        };

        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i];
            const b = indices[i + 1];
            const c = indices[i + 2];

            addNeighbor(a, b);
            addNeighbor(a, c);
            addNeighbor(b, a);
            addNeighbor(b, c);
            addNeighbor(c, a);
            addNeighbor(c, b);
        }

        return neighbors;
    }

    static applyMeshToLayer(layer, mesh, edit, options = {}) {
        const nextMesh = Mesh.finalizeMesh(mesh, edit, options);

        layer.mesh = nextMesh;
        layer.geometry = {
            ...(layer.geometry || {}),
            ...(nextMesh.settings || {}),
        };
        layer.material = {
            ...(layer.material || {}),
            mesh: nextMesh,
        };
        layer.shader = {
            ...(layer.shader || {}),
            mesh: nextMesh,
        };

        return nextMesh;
    }

    static makeTransformMatrix(geometry = {}) {
        return Mesh.buildTransformMatrix(geometry, false);
    }

    static makeRendererTransformMatrix(geometry = {}) {
        return Mesh.buildTransformMatrix(geometry, true);
    }

    static buildTransformMatrix(geometry = {}, renderer = false) {
        const g = renderer
            ? CoordinateSystem.sceneToRendererGeometry(geometry || {})
            : (geometry || {});

        const position = Matrix.translation(
            Mesh.toNumber(g.position_x, 0),
            Mesh.toNumber(g.position_y, 0),
            Mesh.toNumber(g.position_z, 0),
        );

        const pivot = Matrix.translation(
            Mesh.toNumber(g.pivot_x, 0),
            Mesh.toNumber(g.pivot_y, 0),
            Mesh.toNumber(g.pivot_z, 0),
        );

        const inversePivot = Matrix.translation(
            -Mesh.toNumber(g.pivot_x, 0),
            -Mesh.toNumber(g.pivot_y, 0),
            -Mesh.toNumber(g.pivot_z, 0),
        );

        const scale = Matrix.scale(
            Mesh.toNumber(g.width, 1) * Mesh.toNumber(g.scale_x, 1),
            Mesh.toNumber(g.height, 1) * Mesh.toNumber(g.scale_y, 1),
            Mesh.toNumber(g.depth, 1) * Mesh.toNumber(g.scale_z, 1),
        );

        const rx = Matrix.fromQuaternion(
            Quaternion.fromAxisAngle(
                [1, 0, 0],
                Mesh.toNumber(g.rotation_x, 0) * Math.PI / 180,
            )
        );

        const ry = Matrix.fromQuaternion(
            Quaternion.fromAxisAngle(
                [0, 1, 0],
                Mesh.toNumber(g.rotation_y, 0) * Math.PI / 180,
            )
        );

        const rz = Matrix.fromQuaternion(
            Quaternion.fromAxisAngle(
                [0, 0, 1],
                Mesh.toNumber(g.rotation_z, 0) * Math.PI / 180,
            )
        );

        return position
            .multiply(pivot)
            .multiply(rz)
            .multiply(ry)
            .multiply(rx)
            .multiply(scale)
            .multiply(inversePivot);
    }

    static transformLocalPointToScene(geometry = {}, point = [0, 0, 0]) {
        return Mesh.transformPoint(
            Mesh.makeTransformMatrix(geometry),
            point,
        );
    }

    static transformPoint(matrix, point) {
        const out = matrix.transformPoint(point, 1);
        const w = Math.abs(Number(out.w || 1)) > 0.000001 ? Number(out.w || 1) : 1;

        return [out.x / w, out.y / w, out.z / w];
    }

    static buildTopology(mesh, geometry = {}) {
        const normalized = Mesh.normalizeEditableMesh(mesh);

        if (!normalized) {
            return { vertices: [], edges: [], faces: [] };
        }

        const edgeMap = new Map();
        const vertices = [];
        const faces = [];

        for (let index = 0; index < normalized.vertexCount; index += 1) {
            vertices.push({
                index,
                point: Mesh.transformLocalPointToScene(
                    geometry,
                    Mesh.read3(normalized.vertices, normalized.stride, index),
                ),
            });
        }

        const addEdge = (a, b) => {
            const key = Mesh.edgeKey(a, b);

            if (!edgeMap.has(key)) {
                edgeMap.set(key, { key, indices: Mesh.parseEdgeKey(key) });
            }
        };

        for (let offset = 0; offset < normalized.indices.length; offset += 3) {
            const a = normalized.indices[offset];
            const b = normalized.indices[offset + 1];
            const c = normalized.indices[offset + 2];

            if (![a, b, c].every(index => index >= 0 && index < normalized.vertexCount)) {
                continue;
            }

            addEdge(a, b);
            addEdge(b, c);
            addEdge(c, a);
            faces.push({
                index: offset / 3,
                indices: [a, b, c],
                points: [vertices[a].point, vertices[b].point, vertices[c].point],
            });
        }

        (Array.isArray(mesh?.meta?.editEdges) ? mesh.meta.editEdges : []).forEach(edge => {
            const [a, b] = Array.isArray(edge) ? edge : Mesh.parseEdgeKey(edge);

            if (a !== b && a >= 0 && b >= 0 && a < normalized.vertexCount && b < normalized.vertexCount) {
                addEdge(a, b);
            }
        });

        const edges = Array.from(edgeMap.values()).map(edge => ({
            ...edge,
            points: [vertices[edge.indices[0]]?.point, vertices[edge.indices[1]]?.point].filter(Boolean),
        }));

        return { vertices, edges, faces };
    }

    static computeBounds(vertices) {
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];

        for (let i = 0; i < vertices.length; i += Mesh.STRIDE) {
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

    static toNumber(value, fallback = 0) {
        const number = Number(value);

        return isFiniteNumber(number) ? number : fallback;
    }

    static clampNumber(value, min, max, fallback = min) {
        const number = Mesh.toNumber(value, fallback);

        return Math.min(Math.max(number, min), max);
    }

    static clampInt(value, min, max, fallback = min) {
        const number = Math.trunc(Number(value));

        if (!isFiniteNumber(number)) {
            return fallback;
        }

        return Math.min(Math.max(number, min), max);
    }
}