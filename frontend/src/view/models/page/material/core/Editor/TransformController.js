import {Intersection} from "@/view/models/page/material/core/Ray/Intersection";
import {Ray} from "@/view/models/page/material/core/Ray/Ray";
import {Matrix} from "@/view/models/page/material/core/Math/Matrix/Matrix";
import {Quaternion} from "@/view/models/page/material/core/Math/Quaternion/Quaternion";
import {Vector} from "@/view/models/page/material/core/Math/Vector/Vector";
import {CoordinateSystem} from "@/models/layer/3D/core/coordinate/model";
import {clamp, clone} from "@/utils/tools";
import {AXIS_PLANES, AXIS_VECTORS, EPSILON, number, toDeg} from "@/utils/math";

/* ---------------------------
 * helpers (deduped / unified)
 * -------------------------- */

const originFromGeometry = (g = {}) =>
    CoordinateSystem.originFromGeometry(g);

const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizeDegrees = value => {
    const n = finite(value, 0);
    const normalized = ((n + 180) % 360 + 360) % 360 - 180;

    return normalized === -180 ? 180 : normalized;
};

const normalizeRadians = value => {
    const n = finite(value, 0);
    const tau = Math.PI * 2;
    const normalized = ((n + Math.PI) % tau + tau) % tau - Math.PI;

    return normalized === -Math.PI ? Math.PI : normalized;
};

const clampDelta = (value, limit = 4096) => clamp(finite(value, 0), -limit, limit);
const clampScale = value => clamp(finite(value, 1), 0.001, 100000);
const clampWorldDelta = value => clamp(finite(value, 0), -1000000, 1000000);

const axisMask = (axis) => {
    if (axis === "free") return [1, 1, 1];
    if (AXIS_VECTORS[axis]) return AXIS_VECTORS[axis];
    if (axis === "xy" || axis === "yx") return [1, 1, 0];
    if (axis === "xz" || axis === "zx") return [1, 0, 1];
    if (axis === "yz" || axis === "zy") return [0, 1, 1];
    return [1, 1, 1];
};

const dominantPlaneNormal = (axis, camera) => {
    if (AXIS_PLANES[axis]) return AXIS_PLANES[axis];

    const forward = Vector.normalize(
        camera?.orbit?.forward || camera?.forward,
        [0, 1, 0],
    ).toArray();

    if (!AXIS_VECTORS[axis]) return forward;

    const axisDir = AXIS_VECTORS[axis];
    const tangent = Vector.normalize(
        Vector.cross(forward, axisDir),
        [0, 0, 1],
    ).toArray();

    return Vector.normalize(
        Vector.cross(axisDir, tangent),
        forward,
    ).toArray();
};

const rotateAroundAxis = (point, origin, axis, angleRad) => {
    const m = Matrix.fromQuaternion(
        Quaternion.fromAxisAngle(axis, angleRad),
    );

    const local = Vector.sub(point, origin);
    const rotated = Matrix.transformDirection(m, local);

    return Vector.add(origin, rotated).toArray();
};

/* Pivot compensation (kept but simplified math path) */
const pivotCompensationDelta = (geometry, delta) => {
    const rx = Quaternion.fromAxisAngle(
        [1, 0, 0],
        number(geometry?.rotation_x, 0) * Math.PI / 180,
    );

    const ry = Quaternion.fromAxisAngle(
        [0, 1, 0],
        number(geometry?.rotation_y, 0) * Math.PI / 180,
    );

    const rz = Quaternion.fromAxisAngle(
        [0, 0, 1],
        number(geometry?.rotation_z, 0) * Math.PI / 180,
    );

    const scale = Matrix.scale(
        number(geometry?.scale_x, 1),
        number(geometry?.scale_y, 1),
        number(geometry?.scale_z, 1),
    );

    const transform =
        Matrix.fromQuaternion(rz)
            .multiply(Matrix.fromQuaternion(ry))
            .multiply(Matrix.fromQuaternion(rx))
            .multiply(scale);

    const transformed = Matrix.transformDirection(transform, delta).toArray();

    return Vector.sub(transformed, delta).toArray();
};
/* ---------------------------
 * TransformController
 * -------------------------- */

export class TransformController {
    constructor({
                    camera,
                    viewport,
                    geometry,
                    tool = "translate",
                    axis = "free",
                    pivotMode = "object",
                    pivotPoint = null,
                } = {}) {
        this.camera = camera;
        this.viewport = viewport || { width: 1, height: 1 };
        this.tool = tool;
        this.axis = axis;
        this.pivotMode = pivotMode;

        this.geometry = geometry;
        this.startGeometry = clone(geometry || {}, "json");

        this.objectOrigin = originFromGeometry(this.startGeometry);

        this.pivotPoint = pivotPoint
            ? Vector.from(pivotPoint).toArray()
            : this.objectOrigin.slice();

        this.planeNormal = [0, 0, 1];

        this.startPoint = null;
        this.lastPoint = null;

        this.startLocal = null;
        this.lastLocal = null;

        this.startAxisScreen = null;

        this.active = false;
    }

    pointerRay(event) {
        const x = number(event?.local?.x ?? event?.x ?? event?.clientX, 0);
        const y = number(event?.local?.y ?? event?.y ?? event?.clientY, 0);

        return Ray.fromCamera(this.camera, x, y, this.viewport);
    }

    configure(cfg = {}) {
        this.camera = cfg.camera || this.camera;
        this.viewport = cfg.viewport || this.viewport;
        this.geometry = cfg.geometry || this.geometry;

        this.tool = cfg.tool || this.tool;
        this.axis = cfg.axis || this.axis;
        this.pivotMode = cfg.pivotMode || this.pivotMode;

        this.startGeometry = clone(this.geometry || {}, "json");
        this.objectOrigin = originFromGeometry(this.startGeometry);

        this.pivotPoint = cfg.pivotPoint
            ? Vector.from(cfg.pivotPoint).toArray()
            : this.objectOrigin.slice();

        this.startAxisScreen = null;

        return this;
    }

    normalizePointerEvent(input) {
        if (!input?.event) return input;

        const event = input.event;

        if (input.local) {
            event.local = {
                x: number(input.local.x, 0),
                y: number(input.local.y, 0),
            };
            return event;
        }

        const rect = input.element?.getBoundingClientRect?.();
        if (rect) {
            const sx = Math.max(1, this.viewport.width) / Math.max(1, rect.width);
            const sy = Math.max(1, this.viewport.height) / Math.max(1, rect.height);

            event.local = {
                x: (event.clientX - rect.left) * sx,
                y: (event.clientY - rect.top) * sy,
            };
        }

        return event;
    }

    projectScenePoint(point) {
        const matrix = this.camera?.viewProjectionMatrix;

        if (!matrix?.transformPoint) {
            return null;
        }

        return CoordinateSystem.projectPoint(
            point,
            this.camera || {},
            this.viewport || { width: 1, height: 1 },
            { matrix }
        );
    }

    createAxisScreenDelta(origin = this.pivotPoint) {
        const axisDir = AXIS_VECTORS[this.axis];

        if (!axisDir) {
            return null;
        }

        const a = this.projectScenePoint(origin);
        const b = this.projectScenePoint(
            Vector.add(origin, axisDir).toArray()
        );

        if (!a || !b) {
            return null;
        }

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq <= 4) {
            return null;
        }

        return {
            dx,
            dy,
            lenSq,
            invLen: 1 / Math.sqrt(lenSq),
        };
    }

    begin(input) {
        if (input?.event) this.configure(input);

        const event = this.normalizePointerEvent(input);

        this.planeNormal = dominantPlaneNormal(this.axis, this.camera);

        const hit = Intersection.rayPlane(this.pointerRay(event), {
            point: this.pivotPoint,
            normal: this.planeNormal,
        });

        this.startPoint = hit?.point || this.objectOrigin.slice();
        this.lastPoint = this.startPoint.slice();

        this.startLocal = event.local
            ? { x: event.local.x, y: event.local.y }
            : { x: number(event.clientX, 0), y: number(event.clientY, 0) };

        this.lastLocal = { ...this.startLocal };
        this.startAxisScreen = this.createAxisScreenDelta(this.pivotPoint);

        this.active = true;

        return this;
    }

    update(input) {
        const event = this.normalizePointerEvent(input);
        if (!this.active || !this.geometry) return null;

        const hit = Intersection.rayPlane(this.pointerRay(event), {
            point: this.pivotPoint,
            normal: this.planeNormal,
        });

        const currentLocal = event.local
            ? { x: event.local.x, y: event.local.y }
            : this.lastLocal;

        const dx = clampDelta(currentLocal.x - this.startLocal.x);
        const dy = clampDelta(currentLocal.y - this.startLocal.y);

        const point = hit?.point || this.lastPoint || this.startPoint;

        const rawDelta = hit
            ? Vector.sub(point, this.startPoint).toArray()
            : this.screenDeltaToWorld(dx, dy);

        const delta = this.resolveConstrainedDelta(rawDelta, currentLocal, dx, dy);

        this.lastLocal = currentLocal;

        if (this.tool === "pivot") this.applyPivot(delta);
        else if (this.tool === "scale") this.applyScale(dx, dy, currentLocal);
        else if (this.tool === "rotate") this.applyRotate(point, dx, dy);
        else this.applyTranslate(delta);

        this.lastPoint = point;

        return { point, delta, geometry: this.geometry };
    }

    screenDeltaToWorld(dx, dy) {
        const distanceFactor =
            this.camera?.projection === "orthographic"
                ? number(this.camera?.orthographicScale, 5)
                : number(this.camera?.orbit?.radius ?? this.camera?.radius, 4.6);

        const worldPerPixel =
            Math.max(
                1e-5,
                (distanceFactor / Math.max(1, Math.min(this.viewport.width, this.viewport.height))) * 1.85,
            );

        const right = Vector.normalize(this.camera?.orbit?.right || this.camera?.right, [1, 0, 0]);
        const up = Vector.normalize(this.camera?.orbit?.up || this.camera?.up, [0, 0, 1]);

        return Vector.sub(
            Vector.scale(right, clampDelta(dx) * worldPerPixel),
            Vector.scale(up, clampDelta(dy) * worldPerPixel),
        ).toArray();
    }

    resolveConstrainedDelta(delta, currentLocal, dx, dy) {
        if (AXIS_VECTORS[this.axis]) {
            return (
                this.screenAxisDelta(currentLocal) ||
                Vector.scale(
                    AXIS_VECTORS[this.axis],
                    Vector.from(delta).dot(AXIS_VECTORS[this.axis]),
                ).toArray()
            );
        }

        if (this.axis === "free") return this.screenDeltaToWorld(dx, dy);

        const m = axisMask(this.axis);

        return [
            delta[0] * m[0],
            delta[1] * m[1],
            delta[2] * m[2],
        ];
    }

    screenAxisDelta(currentLocal) {
        if (!this.startAxisScreen || !AXIS_VECTORS[this.axis]) return null;

        const dx = clampDelta(currentLocal.x - this.startLocal.x);
        const dy = clampDelta(currentLocal.y - this.startLocal.y);

        const p =
            (dx * this.startAxisScreen.dx + dy * this.startAxisScreen.dy) /
            this.startAxisScreen.lenSq;

        return Vector.scale(AXIS_VECTORS[this.axis], p).toArray();
    }

    applyTranslate(delta) {
        this.geometry.position_x = number(this.startGeometry.position_x, 0) + clampWorldDelta(delta[0]);
        this.geometry.position_y = number(this.startGeometry.position_y, 0) + clampWorldDelta(delta[1]);
        this.geometry.position_z = number(this.startGeometry.position_z, 0) + clampWorldDelta(delta[2]);
    }

    applyPivot(delta) {
        const comp = pivotCompensationDelta(this.startGeometry, delta);

        this.geometry.pivot_x = number(this.startGeometry.pivot_x, 0) + clampWorldDelta(delta[0]);
        this.geometry.pivot_y = number(this.startGeometry.pivot_y, 0) + clampWorldDelta(delta[1]);
        this.geometry.pivot_z = number(this.startGeometry.pivot_z, 0) + clampWorldDelta(delta[2]);

        this.geometry.position_x = number(this.startGeometry.position_x, 0) + clampWorldDelta(comp[0]);
        this.geometry.position_y = number(this.startGeometry.position_y, 0) + clampWorldDelta(comp[1]);
        this.geometry.position_z = number(this.startGeometry.position_z, 0) + clampWorldDelta(comp[2]);
    }

    applyScale(dx, dy, currentLocal = this.lastLocal) {
        let px = dx - dy;

        if (this.startAxisScreen) {
            px = ((currentLocal.x - this.startLocal.x) * this.startAxisScreen.dx +
                    (currentLocal.y - this.startLocal.y) * this.startAxisScreen.dy) *
                this.startAxisScreen.invLen;
        }

        const f = Math.max(0.001, Math.exp(clamp(px, -360, 360) * 0.006));

        const m = axisMask(this.axis);

        const sx = m[0] ? f : 1;
        const sy = m[1] ? f : 1;
        const sz = m[2] ? f : 1;

        this.geometry.scale_x = clampScale(number(this.startGeometry.scale_x, 1) * sx);
        this.geometry.scale_y = clampScale(number(this.startGeometry.scale_y, 1) * sy);
        this.geometry.scale_z = clampScale(number(this.startGeometry.scale_z, 1) * sz);

        if (this.pivotMode !== "object" && this.pivotMode !== "median") {
            const start = this.objectOrigin;
            const local = Vector.sub(start, this.pivotPoint).toArray();
            const scaled = [local[0] * sx, local[1] * sy, local[2] * sz];
            const next = Vector.add(this.pivotPoint, scaled).toArray();
            const d = Vector.sub(next, start).toArray();

            this.geometry.position_x = number(this.startGeometry.position_x, 0) + clampWorldDelta(d[0]);
            this.geometry.position_y = number(this.startGeometry.position_y, 0) + clampWorldDelta(d[1]);
            this.geometry.position_z = number(this.startGeometry.position_z, 0) + clampWorldDelta(d[2]);
        }
    }

    screenRotationAngle(currentLocal = this.lastLocal, axis = [0, 0, 1]) {
        const pivot = this.projectScenePoint(this.pivotPoint);

        if (!pivot || !this.startLocal || !currentLocal) {
            return null;
        }

        const startX = this.startLocal.x - pivot.x;
        const startY = this.startLocal.y - pivot.y;
        const currentX = currentLocal.x - pivot.x;
        const currentY = currentLocal.y - pivot.y;

        const startLength = Math.hypot(startX, startY);
        const currentLength = Math.hypot(currentX, currentY);

        if (startLength < 6 || currentLength < 6) {
            return null;
        }

        const startAngle = Math.atan2(startY, startX);
        const currentAngle = Math.atan2(currentY, currentX);
        let angle = normalizeRadians(currentAngle - startAngle);

        const forward = Vector.normalize(
            this.camera?.orbit?.forward || this.camera?.forward,
            [0, 1, 0],
        );

        // Screen-space angles flip when the axis points away from the camera.
        // Keeping this sign explicit avoids sudden 180/360 degree jumps while dragging rings.
        if (Vector.from(forward).dot(axis) > 0) {
            angle *= -1;
        }

        return angle;
    }

    applyRotate(point, dx, dy) {
        const axis = AXIS_VECTORS[this.axis] || [0, 0, 1];
        const currentLocal = this.lastLocal || this.startLocal;
        let angle = this.screenRotationAngle(currentLocal, axis);

        if (!Number.isFinite(angle) || Math.abs(angle) < EPSILON) {
            const a = Vector.normalize(
                Vector.sub(this.startPoint, this.pivotPoint),
                [1, 0, 0],
            );

            const b = Vector.normalize(
                Vector.sub(point, this.pivotPoint),
                a.toArray(),
            );

            angle = Math.atan2(
                Vector.dot(axis, Vector.cross(a, b)),
                Vector.dot(a, b),
            );
        }

        if (!Number.isFinite(angle) || Math.abs(angle) < EPSILON) {
            angle = clampDelta(dx + dy, 1024) * 0.006;
        }

        angle = normalizeRadians(angle);
        const deg = toDeg(angle);

        this.geometry.rotation_x = normalizeDegrees(number(this.startGeometry.rotation_x, 0));
        this.geometry.rotation_y = normalizeDegrees(number(this.startGeometry.rotation_y, 0));
        this.geometry.rotation_z = normalizeDegrees(number(this.startGeometry.rotation_z, 0));

        if (this.axis === "x") this.geometry.rotation_x = normalizeDegrees(this.geometry.rotation_x + deg);
        else if (this.axis === "y") this.geometry.rotation_y = normalizeDegrees(this.geometry.rotation_y + deg);
        else this.geometry.rotation_z = normalizeDegrees(this.geometry.rotation_z + deg);

        if (this.pivotMode !== "object" && this.pivotMode !== "median") {
            const next = rotateAroundAxis(this.objectOrigin, this.pivotPoint, axis, angle);
            const d = Vector.sub(next, this.objectOrigin).toArray();

            this.geometry.position_x = number(this.startGeometry.position_x, 0) + clampWorldDelta(d[0]);
            this.geometry.position_y = number(this.startGeometry.position_y, 0) + clampWorldDelta(d[1]);
            this.geometry.position_z = number(this.startGeometry.position_z, 0) + clampWorldDelta(d[2]);
        }
    }

    apply(input) {
        return this.update(input);
    }

    end() {
        this.active = false;
    }
}