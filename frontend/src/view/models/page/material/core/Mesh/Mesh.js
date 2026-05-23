import { uuid } from "@/utils/uuid";
import { clone } from "@/utils/tools";

export class Mesh {
    static PRIMITIVE_ORDER = [
        "cube",
        "box",
        "plane",
        "sphere",
        "cylinder",
    ];

    static STRIDE = 11;

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

    static FACE_DEFS = Object.freeze({
        front: {
            normal: [0, 0, 1],
            tangent: [1, 0, 0],
            origin: [-0.5, -0.5, 0.5],
            u: [1, 0, 0],
            v: [0, 1, 0],
        },
        back: {
            normal: [0, 0, -1],
            tangent: [-1, 0, 0],
            origin: [0.5, -0.5, -0.5],
            u: [-1, 0, 0],
            v: [0, 1, 0],
        },
        left: {
            normal: [-1, 0, 0],
            tangent: [0, 0, 1],
            origin: [-0.5, -0.5, -0.5],
            u: [0, 0, 1],
            v: [0, 1, 0],
        },
        right: {
            normal: [1, 0, 0],
            tangent: [0, 0, -1],
            origin: [0.5, -0.5, 0.5],
            u: [0, 0, -1],
            v: [0, 1, 0],
        },
        top: {
            normal: [0, 1, 0],
            tangent: [1, 0, 0],
            origin: [-0.5, 0.5, 0.5],
            u: [1, 0, 0],
            v: [0, 0, -1],
        },
        bottom: {
            normal: [0, -1, 0],
            tangent: [1, 0, 0],
            origin: [-0.5, -0.5, -0.5],
            u: [1, 0, 0],
            v: [0, 0, 1],
        },
    });

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
                "width",
                "height",
                "depth",
                "bevel",
                "bevel_segments",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                "pivot_x",
                "pivot_y",
                "pivot_z",
                "rotation_x",
                "rotation_y",
                "rotation_z",
                "scale_x",
                "scale_y",
                "scale_z",
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
                "width",
                "height",
                "depth",
                "bevel",
                "bevel_segments",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                "pivot_x",
                "pivot_y",
                "pivot_z",
                "rotation_x",
                "rotation_y",
                "rotation_z",
                "scale_x",
                "scale_y",
                "scale_z",
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
                "pivot_x",
                "pivot_y",
                "pivot_z",
                "rotation_x",
                "rotation_y",
                "rotation_z",
                "scale_x",
                "scale_y",
                "scale_z",
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
                "width",
                "height",
                "depth",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                "pivot_x",
                "pivot_y",
                "pivot_z",
                "rotation_x",
                "rotation_y",
                "rotation_z",
                "scale_x",
                "scale_y",
                "scale_z",
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
                "width",
                "height",
                "depth",
                "bevel",
                "bevel_segments",
                "subdivision",
                "subdivision_type",
                "shade_smooth",
                "uv_fit",
                "uv_density",
                "pivot_x",
                "pivot_y",
                "pivot_z",
                "rotation_x",
                "rotation_y",
                "rotation_z",
                "scale_x",
                "scale_y",
                "scale_z",
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
                shadeSmooth: normalized.shade_smooth
            },
        };
    }

    static toPlain(mesh = null) {
        if (!mesh) {
            return null;
        }

        const vertices = mesh.vertices instanceof Float32Array
            ? Array.from(mesh.vertices)
            : Array.isArray(mesh.vertices)
                ? mesh.vertices.map(value => Number(value) || 0)
                : [];

        const indices = mesh.indices instanceof Uint32Array || mesh.indices instanceof Uint16Array
            ? Array.from(mesh.indices)
            : Array.isArray(mesh.indices)
                ? mesh.indices.map(value => Math.max(0, Math.trunc(Number(value) || 0)))
                : [];

        const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
        const settings = Mesh.normalizeSettings(mesh.settings || mesh);

        return {
            id: mesh.id || "",
            primitive: mesh.primitive || settings.primitive,
            label: mesh.label || Mesh.get(settings.primitive).label,
            icon: mesh.icon || Mesh.get(settings.primitive).icon,
            vertices,
            indices,
            stride: Number(mesh.stride || Mesh.STRIDE),
            indexType: mesh.indexType || (maxIndex > 65535 ? "uint32" : "uint16"),
            count: Number(mesh.count || indices.length),
            parts: JSON.parse(JSON.stringify(mesh.parts || [])),
            bounds: JSON.parse(JSON.stringify(mesh.bounds || {})),
            settings,
            meta: JSON.parse(JSON.stringify(mesh.meta || {})),
        };
    }

    static fromPlain(mesh = null, fallbackSettings = {}) {
        if (!mesh || !Array.isArray(mesh.vertices) || !Array.isArray(mesh.indices)) {
            return Mesh.create(fallbackSettings);
        }

        const maxIndex = mesh.indices.reduce((max, index) => Math.max(max, Number(index) || 0), 0);
        const indices = (mesh.indexType === "uint32" || maxIndex > 65535)
            ? new Uint32Array(mesh.indices)
            : new Uint16Array(mesh.indices);
        const vertices = new Float32Array(mesh.vertices);
        const settings = Mesh.normalizeSettings(mesh.settings || fallbackSettings);

        return {
            ...mesh,
            primitive: mesh.primitive || settings.primitive,
            label: mesh.label || Mesh.get(settings.primitive).label,
            icon: mesh.icon || Mesh.get(settings.primitive).icon,
            settings,
            stride: Number(mesh.stride || Mesh.STRIDE),
            vertices,
            indices,
            indexType: indices instanceof Uint32Array ? "uint32" : "uint16",
            count: Number(mesh.count || indices.length),
            parts: clone(mesh.parts || []),
            bounds: mesh.bounds || Mesh.computeBounds(vertices),
            meta: clone(mesh.meta || {}),
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

        // Top pole
        const topIndex = 0;

        pushRawVertex(
            0, radius, 0,
            0, 1, 0,
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
                const ny = ct;
                const nz = sp * st;

                // Lat-long tangent. Already normalized.
                const tx = -sp;
                const ty = 0;
                const tz = cp;

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

        // Bottom pole
        pushRawVertex(
            0, -radius, 0,
            0, -1, 0,
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
            const py = -0.5 + v;

            for (let x = 0; x <= radial; x += 1) {
                const u = x / radial;
                const angle = u * Math.PI * 2;
                const cx = Math.cos(angle);
                const sz = Math.sin(angle);

                const position = [cx * 0.5, py, sz * 0.5];
                const normal = [cx, 0, sz];
                const tangent = Mesh.normalize3([-sz, 0, cx]);

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
            yValue: 0.5,
            normal: [0, 1, 0],
            radial,
            vertices,
            indices,
            parts,
            flip: false,
        });

        Mesh.buildCylinderCap({
            faceName: "bottom",
            yValue: -0.5,
            normal: [0, -1, 0],
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
                                yValue,
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
            [0, yValue, 0],
            normal,
            [0.5, 0.5],
            [1, 0, 0]
        );

        for (let x = 0; x <= radial; x += 1) {
            const u = x / radial;
            const angle = u * Math.PI * 2;
            const cx = Math.cos(angle);
            const sz = Math.sin(angle);

            Mesh.pushVertex(
                vertices,
                [cx * 0.5, yValue, sz * 0.5],
                normal,
                [cx * 0.5 + 0.5, sz * 0.5 + 0.5],
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

    static createIndexArray(indices) {
        const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);

        return maxIndex > 65535
            ? new Uint32Array(indices)
            : new Uint16Array(indices);
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

    static pushVertex(vertices, position, normal, uv, tangent) {
        vertices.push(
            position[0], position[1], position[2],
            normal[0], normal[1], normal[2],
            uv[0], uv[1],
            tangent[0], tangent[1], tangent[2]
        );
    }

    static normalize3(vector) {
        const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

        return [
            vector[0] / length,
            vector[1] / length,
            vector[2] / length,
        ];
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

        return Number.isFinite(number) ? number : fallback;
    }

    static clampNumber(value, min, max, fallback = min) {
        const number = Mesh.toNumber(value, fallback);

        return Math.min(Math.max(number, min), max);
    }

    static clampInt(value, min, max, fallback = min) {
        const number = Math.trunc(Number(value));

        if (!Number.isFinite(number)) {
            return fallback;
        }

        return Math.min(Math.max(number, min), max);
    }
}
