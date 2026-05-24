import { Intersection } from "@/view/models/page/material/core/Ray/Intersection";
import { Ray } from "@/view/models/page/material/core/Ray/Ray";
import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { Matrix } from "@/view/models/page/material/core/Math/Matrix/Matrix";
import { Quaternion } from "@/view/models/page/material/core/Math/Quaternion/Quaternion";
import { clone } from "@/utils/tools";

const AXIS_VECTORS = Object.freeze({
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
});

const AXIS_PLANES = Object.freeze({
    xy: [0, 0, 1],
    yx: [0, 0, 1],
    xz: [0, 1, 0],
    zx: [0, 1, 0],
    yz: [1, 0, 0],
    zy: [1, 0, 0],
});

const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const toDeg = radians => radians * 180 / Math.PI;
const vec = value => Vector.from(value).toArray();
const add = (a, b) => Vector.add(a, b).toArray();
const sub = (a, b) => Vector.sub(a, b).toArray();
const mul = (a, s) => Vector.scale(a, s).toArray();
const dot = (a, b) => Vector.dot(a, b);
const cross = (a, b) => Vector.cross(a, b).toArray();
const normalize = (a, fallback = [0, 0, 1]) => Vector.normalize(a, fallback).toArray();

const geometryOrigin = geometry => [
    toNumber(geometry.position_x, 0) + toNumber(geometry.pivot_x, 0),
    toNumber(geometry.position_y, 0) + toNumber(geometry.pivot_y, 0),
    toNumber(geometry.position_z, 0) + toNumber(geometry.pivot_z, 0),
];

const axisMask = axis => {
    if (axis === "free") return [1, 1, 1];
    if (AXIS_VECTORS[axis]) return AXIS_VECTORS[axis];
    if (axis === "xy" || axis === "yx") return [1, 1, 0];
    if (axis === "xz" || axis === "zx") return [1, 0, 1];
    if (axis === "yz" || axis === "zy") return [0, 1, 1];
    return [1, 1, 1];
};

const dominantPlaneNormal = (axis, camera) => {
    if (AXIS_PLANES[axis]) {
        return AXIS_PLANES[axis];
    }

    const forward = normalize(camera?.orbit?.forward || camera?.forward, [0, 0, -1]);

    if (AXIS_VECTORS[axis]) {
        const axisDir = AXIS_VECTORS[axis];
        const tangent = normalize(cross(forward, axisDir), [0, 0, 1]);
        return normalize(cross(axisDir, tangent), forward);
    }

    return forward;
};

const rotateAroundAxis = (point, origin, axis, angleRad) => {
    const quaternion = Quaternion.fromAxisAngle(axis, angleRad);
    const matrix = Matrix.fromQuaternion(quaternion);
    const local = Vector.sub(point, origin);
    const rotated = matrix.transformDirection(local).toArray();
    return Vector.add(origin, rotated).toArray();
};

const pivotCompensationDelta = (geometry, delta) => {
    const rx = Matrix.fromQuaternion(Quaternion.fromAxisAngle(
        [1, 0, 0],
        toNumber(geometry.rotation_x, 0) * Math.PI / 180,
    ));
    const ry = Matrix.fromQuaternion(Quaternion.fromAxisAngle(
        [0, 1, 0],
        toNumber(geometry.rotation_y, 0) * Math.PI / 180,
    ));
    const rz = Matrix.fromQuaternion(Quaternion.fromAxisAngle(
        [0, 0, 1],
        toNumber(geometry.rotation_z, 0) * Math.PI / 180,
    ));
    const scale = Matrix.scale(
        toNumber(geometry.scale_x, 1),
        toNumber(geometry.scale_y, 1),
        toNumber(geometry.scale_z, 1),
    );
    const transformed = rz
        .multiply(ry)
        .multiply(rx)
        .multiply(scale)
        .transformDirection(delta)
        .toArray();

    return sub(transformed, delta);
};

const projectToViewport = (camera, point, viewport = { width: 1, height: 1 }) => {
    const matrix = camera?.viewProjectionMatrix;

    if (!matrix?.transformPoint) {
        return null;
    }

    const ndc = matrix.transformPoint(point, 1);
    const x = (ndc.x * 0.5 + 0.5) * Math.max(1, viewport.width);
    const y = (1 - (ndc.y * 0.5 + 0.5)) * Math.max(1, viewport.height);

    return { x, y };
};

export class TransformController {
    constructor({ camera, viewport, geometry, tool = "translate", axis = "free", pivotMode = "object", pivotPoint = null } = {}) {
        this.camera = camera;
        this.viewport = viewport || { width: 1, height: 1 };
        this.tool = tool;
        this.axis = axis || "free";
        this.pivotMode = pivotMode;
        this.geometry = geometry;
        this.startGeometry = clone(geometry || {}, "json");
        this.objectOrigin = geometryOrigin(this.startGeometry);
        this.pivotPoint = pivotPoint ? vec(pivotPoint) : this.objectOrigin.slice();
        this.planeNormal = [0, 0, 1];
        this.startPoint = null;
        this.lastPoint = null;
        this.startLocal = null;
        this.lastLocal = null;
        this.startAxisScreen = null;
        this.active = false;
    }

    pointerRay(event) {
        const x = toNumber(event?.local?.x ?? event?.x ?? event?.clientX, 0);
        const y = toNumber(event?.local?.y ?? event?.y ?? event?.clientY, 0);
        return Ray.fromCamera(this.camera, x, y, this.viewport);
    }

    configure({ camera = this.camera, viewport = this.viewport, geometry = this.geometry, tool = this.tool, axis = this.axis, pivotMode = this.pivotMode, pivotPoint = this.pivotPoint } = {}) {
        this.camera = camera;
        this.viewport = viewport || { width: 1, height: 1 };
        this.geometry = geometry;
        this.tool = tool || "translate";
        this.axis = axis || "free";
        this.pivotMode = pivotMode || "object";
        this.startGeometry = clone(geometry || {}, "json");
        this.objectOrigin = geometryOrigin(this.startGeometry);
        this.pivotPoint = pivotPoint ? vec(pivotPoint) : this.objectOrigin.slice();
        return this;
    }

    normalizePointerEvent(input) {
        if (input?.event) {
            const event = input.event;
            if (input.local) {
                event.local = { x: toNumber(input.local.x, 0), y: toNumber(input.local.y, 0) };
                return event;
            }
            const rect = input.element?.getBoundingClientRect?.();
            if (rect) {
                const scaleX = Math.max(1, this.viewport.width) / Math.max(1, rect.width);
                const scaleY = Math.max(1, this.viewport.height) / Math.max(1, rect.height);
                event.local = {
                    x: (event.clientX - rect.left) * scaleX,
                    y: (event.clientY - rect.top) * scaleY,
                };
            }
            return event;
        }
        return input;
    }

    begin(input) {
        if (input?.event) {
            this.configure(input);
        }
        const event = this.normalizePointerEvent(input);
        this.planeNormal = dominantPlaneNormal(this.axis, this.camera);
        const hit = Intersection.rayPlane(this.pointerRay(event), { point: this.pivotPoint, normal: this.planeNormal });
        this.startPoint = hit?.point || this.objectOrigin.slice();
        this.lastPoint = this.startPoint.slice();
        this.startLocal = event.local ? { ...event.local } : { x: toNumber(event.clientX, 0), y: toNumber(event.clientY, 0) };
        this.lastLocal = { ...this.startLocal };
        this.startAxisScreen = this.resolveAxisScreenData();
        this.active = true;
        return this;
    }

    update(input) {
        const event = this.normalizePointerEvent(input);
        if (!this.active || !this.geometry) {
            return null;
        }

        const hit = Intersection.rayPlane(this.pointerRay(event), { point: this.pivotPoint, normal: this.planeNormal });
        const currentLocal = event.local ? { ...event.local } : this.lastLocal;
        const dx = currentLocal.x - this.startLocal.x;
        const dy = currentLocal.y - this.startLocal.y;
        const point = hit?.point || this.lastPoint || this.startPoint;
        const rawDelta = hit ? sub(point, this.startPoint) : this.screenDeltaToWorld(dx, dy);
        const delta = this.resolveConstrainedDelta(rawDelta, currentLocal, dx, dy);
        this.lastLocal = currentLocal;

        if (this.tool === "pivot") {
            this.applyPivot(delta);
        } else if (this.tool === "scale") {
            this.applyScale(dx, dy, currentLocal);
        } else if (this.tool === "rotate") {
            this.applyRotate(point, dx, dy);
        } else {
            this.applyTranslate(delta);
        }

        this.lastPoint = point;
        return { point, delta, geometry: this.geometry };
    }

    resolveAxisScreenData() {
        if (!AXIS_VECTORS[this.axis]) {
            return null;
        }

        const origin = projectToViewport(this.camera, this.pivotPoint, this.viewport);
        const endpoint = projectToViewport(this.camera, add(this.pivotPoint, AXIS_VECTORS[this.axis]), this.viewport);

        if (!origin || !endpoint) {
            return null;
        }

        const dx = endpoint.x - origin.x;
        const dy = endpoint.y - origin.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq < 1e-6) {
            return null;
        }

        return { origin, dx, dy, lenSq };
    }

    screenAxisDelta(currentLocal) {
        if (!this.startAxisScreen || !AXIS_VECTORS[this.axis]) {
            return null;
        }

        const pointerDx = currentLocal.x - this.startLocal.x;
        const pointerDy = currentLocal.y - this.startLocal.y;
        const pixelsAlongAxis = (pointerDx * this.startAxisScreen.dx + pointerDy * this.startAxisScreen.dy) / this.startAxisScreen.lenSq;

        return mul(AXIS_VECTORS[this.axis], pixelsAlongAxis);
    }

    screenDeltaToWorld(dx, dy) {
        const distanceFactor = this.camera?.projection === "orthographic"
            ? toNumber(this.camera?.orthographicScale, 5)
            : toNumber(this.camera?.orbit?.radius ?? this.camera?.radius, 4.6);
        const worldPerPixel = Math.max(0.00001, distanceFactor / Math.max(1, Math.min(this.viewport.width, this.viewport.height)) * 1.85);
        const right = normalize(this.camera?.orbit?.right || this.camera?.right, [1, 0, 0]);
        const up = normalize(this.camera?.orbit?.up || this.camera?.up, [0, 0, 1]);
        return sub(mul(right, dx * worldPerPixel), mul(up, dy * worldPerPixel));
    }

    resolveConstrainedDelta(delta, currentLocal, dx, dy) {
        if (AXIS_VECTORS[this.axis]) {
            return this.screenAxisDelta(currentLocal) || mul(AXIS_VECTORS[this.axis], dot(delta, AXIS_VECTORS[this.axis]));
        }

        if (this.axis === "free") {
            return this.screenDeltaToWorld(dx, dy);
        }

        const mask = axisMask(this.axis);
        return [delta[0] * mask[0], delta[1] * mask[1], delta[2] * mask[2]];
    }

    applyTranslate(delta) {
        this.geometry.position_x = toNumber(this.startGeometry.position_x, 0) + delta[0];
        this.geometry.position_y = toNumber(this.startGeometry.position_y, 0) + delta[1];
        this.geometry.position_z = toNumber(this.startGeometry.position_z, 0) + delta[2];
    }

    applyPivot(delta) {
        const compensation = pivotCompensationDelta(this.startGeometry, delta);

        this.geometry.pivot_x = toNumber(this.startGeometry.pivot_x, 0) + delta[0];
        this.geometry.pivot_y = toNumber(this.startGeometry.pivot_y, 0) + delta[1];
        this.geometry.pivot_z = toNumber(this.startGeometry.pivot_z, 0) + delta[2];

        // Pivot edit mode must move only the custom object anchor on screen.
        // The mesh must stay visually in place, so compensate the object position
        // for the changed pivot under the current rotation/scale transform.
        this.geometry.position_x = toNumber(this.startGeometry.position_x, 0) + compensation[0];
        this.geometry.position_y = toNumber(this.startGeometry.position_y, 0) + compensation[1];
        this.geometry.position_z = toNumber(this.startGeometry.position_z, 0) + compensation[2];
    }

    applyScale(dx, dy, currentLocal = this.lastLocal) {
        const axisVector = AXIS_VECTORS[this.axis];
        let signedPixels = dx - dy;

        if (axisVector && this.startAxisScreen) {
            const pointerDx = currentLocal.x - this.startLocal.x;
            const pointerDy = currentLocal.y - this.startLocal.y;
            signedPixels = (pointerDx * this.startAxisScreen.dx + pointerDy * this.startAxisScreen.dy) / Math.sqrt(this.startAxisScreen.lenSq);
        }

        const factor = Math.max(0.001, Math.exp(Math.max(-180, Math.min(180, signedPixels)) * 0.008));
        const mask = axisMask(this.axis);
        const sx = mask[0] ? factor : 1;
        const sy = mask[1] ? factor : 1;
        const sz = mask[2] ? factor : 1;

        this.geometry.scale_x = Math.max(0.001, toNumber(this.startGeometry.scale_x, 1) * sx);
        this.geometry.scale_y = Math.max(0.001, toNumber(this.startGeometry.scale_y, 1) * sy);
        this.geometry.scale_z = Math.max(0.001, toNumber(this.startGeometry.scale_z, 1) * sz);

        if (this.pivotMode !== "object" && this.pivotMode !== "median") {
            const startOrigin = this.objectOrigin;
            const local = sub(startOrigin, this.pivotPoint);
            const scaled = [local[0] * sx, local[1] * sy, local[2] * sz];
            const nextOrigin = add(this.pivotPoint, scaled);
            const deltaOrigin = sub(nextOrigin, startOrigin);
            this.geometry.position_x = toNumber(this.startGeometry.position_x, 0) + deltaOrigin[0];
            this.geometry.position_y = toNumber(this.startGeometry.position_y, 0) + deltaOrigin[1];
            this.geometry.position_z = toNumber(this.startGeometry.position_z, 0) + deltaOrigin[2];
        }
    }

    applyRotate(point, dx, dy) {
        const axis = AXIS_VECTORS[this.axis] || [0, 0, 1];
        const startVector = normalize(sub(this.startPoint, this.pivotPoint), [1, 0, 0]);
        const currentVector = normalize(sub(point, this.pivotPoint), startVector);
        let angle = Math.atan2(dot(axis, cross(startVector, currentVector)), dot(startVector, currentVector));

        if (!Number.isFinite(angle) || Math.abs(angle) < 1e-7) {
            angle = (dx + dy) * 0.006;
        }

        const degrees = toDeg(angle);
        this.geometry.rotation_x = toNumber(this.startGeometry.rotation_x, 0);
        this.geometry.rotation_y = toNumber(this.startGeometry.rotation_y, 0);
        this.geometry.rotation_z = toNumber(this.startGeometry.rotation_z, 0);

        if (this.axis === "x") this.geometry.rotation_x += degrees;
        else if (this.axis === "y") this.geometry.rotation_y += degrees;
        else this.geometry.rotation_z += degrees;

        if (this.pivotMode !== "object" && this.pivotMode !== "median") {
            const nextOrigin = rotateAroundAxis(this.objectOrigin, this.pivotPoint, axis, angle);
            const deltaOrigin = sub(nextOrigin, this.objectOrigin);
            this.geometry.position_x = toNumber(this.startGeometry.position_x, 0) + deltaOrigin[0];
            this.geometry.position_y = toNumber(this.startGeometry.position_y, 0) + deltaOrigin[1];
            this.geometry.position_z = toNumber(this.startGeometry.position_z, 0) + deltaOrigin[2];
        }
    }

    apply(input) {
        return this.update(input);
    }

    end() {
        this.active = false;
    }
}
