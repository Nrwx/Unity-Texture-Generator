import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { Quaternion } from "@/view/models/page/material/core/Math/Quaternion/Quaternion";
import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { EPSILON, isFiniteNumber, number } from "@/utils/math";

export class CoordinateSystem {

    static object(value, fallback = { x: 0, y: 0, z: 0 }) {
        const src =
            value instanceof Vector
                ? value.toObject()
                : Array.isArray(value) || ArrayBuffer.isView(value)
                    ? { x: value[0], y: value[1], z: value[2] }
                    : value && typeof value === "object"
                        ? (value.data && typeof value.data === "object" ? value.data : value)
                        : null;

        if (!src) {
            return {
                x: number(fallback?.x, 0),
                y: number(fallback?.y, 0),
                z: number(fallback?.z, 0),
            };
        }

        return {
            x: number(src.x ?? src[0], number(fallback?.x, 0)),
            y: number(src.y ?? src[1], number(fallback?.y, 0)),
            z: number(src.z ?? src[2], number(fallback?.z, 0)),
        };
    }

    static vector(value, fallback = [0, 0, 0]) {
        const o = CoordinateSystem.object(
            value,
            { x: fallback[0], y: fallback[1], z: fallback[2] }
        );

        return [o.x, o.y, o.z];
    }

    /**
     * Explicit legacy conversion helper. Engine-space itself is Z-up and does not
     * implicitly swap axes anymore; only call this at a real external Y-up boundary.
     */
    static swapYZ(value, fallback = [0, 0, 0]) {
        const v = CoordinateSystem.vector(value, fallback);
        return [v[0], v[2], v[1]];
    }

    static sceneToRendererVector(value, fallback = [0, 0, 0]) {
        return CoordinateSystem.vector(value, fallback);
    }

    static rendererToSceneVector(value, fallback = [0, 0, 0]) {
        return CoordinateSystem.vector(value, fallback);
    }

    static geometry(geometry = {}, defaults = {}) {
        const g = geometry || {};

        return {
            ...g,

            position_x: number(g.position_x, number(defaults.position_x, 0)),
            position_y: number(g.position_y, number(defaults.position_y, 0)),
            position_z: number(g.position_z, number(defaults.position_z, 0)),

            pivot_x: number(g.pivot_x, number(defaults.pivot_x, 0)),
            pivot_y: number(g.pivot_y, number(defaults.pivot_y, 0)),
            pivot_z: number(g.pivot_z, number(defaults.pivot_z, 0)),

            rotation_x: number(g.rotation_x, number(defaults.rotation_x, 0)),
            rotation_y: number(g.rotation_y, number(defaults.rotation_y, 0)),
            rotation_z: number(g.rotation_z, number(defaults.rotation_z, 0)),

            scale_x: number(g.scale_x, number(defaults.scale_x, 1)),
            scale_y: number(g.scale_y, number(defaults.scale_y, 1)),
            scale_z: number(g.scale_z, number(defaults.scale_z, 1)),
        };
    }

    static sceneToRendererGeometry(g = {}, d = {}) {
        return CoordinateSystem.geometry(g, d);
    }

    static rendererToSceneGeometry(g = {}, d = {}) {
        return CoordinateSystem.geometry(g, d);
    }

    static originFromGeometry(g = {}) {
        return [
            number(g.position_x, 0) + number(g.pivot_x, 0),
            number(g.position_y, 0) + number(g.pivot_y, 0),
            number(g.position_z, 0) + number(g.pivot_z, 0),
        ];
    }

    static pivotFromGeometry(g = {}) {
        return CoordinateSystem.object({
            x: number(g.position_x, 0) + number(g.pivot_x, 0),
            y: number(g.position_y, 0) + number(g.pivot_y, 0),
            z: number(g.position_z, 0) + number(g.pivot_z, 0),
        });
    }

    static sizeFromGeometry(g = {}, fallback = 0.85) {
        const sx = Math.abs(number(g.width, 1) * number(g.scale_x, 1));
        const sy = Math.abs(number(g.height, 1) * number(g.scale_y, 1));
        const sz = Math.abs(number(g.depth, 1) * number(g.scale_z, 1));

        const max = Math.max(sx, sy, sz, 0.25);

        return Math.max(0.18, Math.min(0.92, max * 0.48 || fallback));
    }

    static visualSizeFromGeometry(g = {}, { min = 0.22, max = 1.25, factor = 0.62 } = {}) {
        const sx = Math.abs(number(g.width, 1) * number(g.scale_x, 1));
        const sy = Math.abs(number(g.height, 1) * number(g.scale_y, 1));
        const sz = Math.abs(number(g.depth, 1) * number(g.scale_z, 1));

        const maxDim = Math.max(sx, sy, sz, 0.25);

        return Math.max(min, Math.min(max, maxDim * factor));
    }

    static camera(c = {}) {
        return {
            ...c,
            position: CoordinateSystem.sceneToRendererVector(c.position, [-1.7236637240151509, 1.7236637240151513, 3.901021242319559]),
            target: CoordinateSystem.sceneToRendererVector(c.target, [0, 0, 0]),
            up: Vector.normalize(
                CoordinateSystem.sceneToRendererVector(c.up, [0, 0, 1]),
                [0, 0, 1]
            ).toArray(),
        };
    }

    static sceneToRendererCamera(c = {}) {
        return CoordinateSystem.camera(c);
    }

    static rendererToSceneCamera(c = {}) {
        return CoordinateSystem.camera(c);
    }

    static buildViewProjectionMatrix(cameraPayload = {}, viewport = { width: 1, height: 1 }) {
        const aspect = Math.max(
            0.0001,
            number(viewport.width, 1) / Math.max(1, number(viewport.height, 1))
        );

        const projection = String(cameraPayload.projection || "perspective").toLowerCase();

        const position = CoordinateSystem.sceneToRendererVector(
            cameraPayload.position,
            [-1.7236637240151509, 1.7236637240151513, 3.901021242319559]
        );

        const target = CoordinateSystem.sceneToRendererVector(
            cameraPayload.target,
            [0, 0, 0]
        );

        const up = Vector.normalize(
            CoordinateSystem.sceneToRendererVector(cameraPayload.up, [0, 0, 1]),
            [0, 0, 1]
        ).toArray();

        const view = Matrix.lookAt(position, target, up);

        const projectionMatrix =
            projection === "orthographic" || projection === "ortho"
                ? (() => {
                    const half = Math.max(
                        0.0001,
                        number(cameraPayload.orthographic_scale ?? cameraPayload.orthographicScale, 5)
                    ) * 0.5;

                    return Matrix.orthographic(
                        -half * aspect,
                        half * aspect,
                        -half,
                        half,
                        Math.max(0.0001, number(cameraPayload.near, 0.01)),
                        Math.max(0.01, number(cameraPayload.far, 1000))
                    );
                })()
                : Matrix.perspective(
                    number(cameraPayload.fov, 50) * Math.PI / 180,
                    aspect,
                    Math.max(0.0001, number(cameraPayload.near, 0.01)),
                    Math.max(0.01, number(cameraPayload.far, 1000))
                );

        return projectionMatrix.clone().multiply(view);
    }

    static projectPoint(point, cameraPayload = {}, viewport = { width: 1, height: 1 }, options = {}) {
        const matrix =
            options.matrix instanceof Matrix
                ? options.matrix
                : CoordinateSystem.buildViewProjectionMatrix(cameraPayload, viewport);

        if (!matrix) return null;

        const source =
            options.rendererSpace === true
                ? CoordinateSystem.vector(point, [0, 0, 0])
                : CoordinateSystem.sceneToRendererVector(point, [0, 0, 0]);

        const p = matrix.transformPoint(source, 1);
        if (!p) return null;

        const w = Math.abs(number(p.w, 1)) > EPSILON ? number(p.w, 1) : 1;
        const ndcX = number(p.x, 0) / w;
        const ndcY = number(p.y, 0) / w;

        if (!isFiniteNumber(ndcX) || !isFiniteNumber(ndcY)) return null;

        return {
            x: (ndcX * 0.5 + 0.5) * Math.max(1, number(viewport.width, 1)),
            y: (1 - (ndcY * 0.5 + 0.5)) * Math.max(1, number(viewport.height, 1)),
            z: number(p.z, 0) / w,
        };
    }

    static rayPlaneIntersection(rayLike, point, normal) {
        return Intersection.rayPlane(rayLike, {
            point: CoordinateSystem.vector(point, [0, 0, 0]),
            normal: CoordinateSystem.vector(normal, [0, 0, 1]),
        });
    }

    static localDeltaFromWorldDelta(worldDelta, geometry = {}) {
        const sx = Math.max(EPSILON, Math.abs(number(geometry.width, 1) * number(geometry.scale_x, 1)));
        const sy = Math.max(EPSILON, Math.abs(number(geometry.height, 1) * number(geometry.scale_y, 1)));
        const sz = Math.max(EPSILON, Math.abs(number(geometry.depth, 1) * number(geometry.scale_z, 1)));

        const rotation = Quaternion.fromEuler(
            number(geometry.rotation_x, 0) * Math.PI / 180,
            number(geometry.rotation_y, 0) * Math.PI / 180,
            number(geometry.rotation_z, 0) * Math.PI / 180,
            "XYZ"
        );

        const transform =
            Matrix.compose([0, 0, 0], rotation, [sx, sy, sz]).inverted();

        const local = transform.transformDirection(
            CoordinateSystem.vector(worldDelta, [0, 0, 0])
        );

        return [local.x, local.y, local.z];
    }
}