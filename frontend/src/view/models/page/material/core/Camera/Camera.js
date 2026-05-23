import {Orbit} from "@/view/models/page/material/core/Orbit/Orbit";
import {Matrix} from "@/view/models/page/material/core/Math/Matrix/Matrix";
import {Quaternion} from "@/view/models/page/material/core/Math/Quaternion/Quaternion";
import {Vector} from "@/view/models/page/material/core/Math/Vector/Vector";

export class Camera {
    constructor({
                    projection = "perspective",
                    fov = 50,
                    near = 0.01,
                    far = 1000,
                    aspect = 1,
                    orthographicScale = 5,
                    minOrthographicScale = 0.05,
                    maxOrthographicScale = 250,
                    position = [-1.7236637240151509, 1.7236637240151513, 3.901021242319559],
                    target = [0, 0, 0],
                    up = [0, 0, 1],
                    damping = 18,
                    orbit = {},
                } = {}) {
        this.projection = projection === "orthographic" || projection === "ortho"
            ? "orthographic"
            : "perspective";

        this.fov = fov;
        this.near = near;
        this.far = far;
        this.aspect = aspect;
        this.orthographicScale = orthographicScale;
        this.minOrthographicScale = minOrthographicScale;
        this.maxOrthographicScale = maxOrthographicScale;
        this.backgroundGrid = true;

        this.position = Vector.from(position);
        this.target = Vector.from(target);
        this.up = Vector.from(up, [0, 0, 1]).normalize([0, 0, 1]);
        this.rotation = Quaternion.identity();

        this.viewMatrix = Matrix.identity();
        this.projectionMatrix = Matrix.identity();
        this.viewProjectionMatrix = Matrix.identity();
        this.inverseViewProjectionMatrix = Matrix.identity();

        const hasOrbitState = (
            orbit.radius !== undefined ||
            orbit.theta !== undefined ||
            orbit.phi !== undefined
        );

        this.orbit = new Orbit(this, {
            damping,
            target: this.target,
            ...orbit,
        });

        if (!hasOrbitState) {
            this.orbit.syncFromCamera();
        }

        this.update(1 / 60);
    }

    static fromPayload(payload = {}) {
        return new Camera({
            projection: payload.projection,
            fov: payload.fov,
            near: payload.near,
            far: payload.far,
            aspect: payload.aspect,
            orthographicScale: payload.orthographic_scale ?? payload.orthographicScale,
            minOrthographicScale: payload.min_orthographic_scale ?? payload.minOrthographicScale,
            maxOrthographicScale: payload.max_orthographic_scale ?? payload.maxOrthographicScale,
            position: payload.position,
            target: payload.target,
            up: payload.up,
            orbit: {
                radius: payload.radius,
                minRadius: payload.min_radius ?? payload.minRadius,
                maxRadius: payload.max_radius ?? payload.maxRadius,
                theta: payload.theta,
                phi: payload.phi,
                minPhi: payload.min_phi ?? payload.minPhi,
                maxPhi: payload.max_phi ?? payload.maxPhi,
                rotateSpeed: payload.rotate_speed ?? payload.rotateSpeed,
                panSpeed: payload.pan_speed ?? payload.panSpeed,
                dollySpeed: payload.dolly_speed ?? payload.dollySpeed,
                target: payload.target,
                worldUp: payload.up,
            },
        });
    }

    setViewport(width = 1, height = 1) {
        this.aspect = Math.max(0.0001, width / Math.max(1, height));
        return this;
    }

    setProjection(value = "perspective") {
        this.projection = value === "orthographic" || value === "ortho"
            ? "orthographic"
            : "perspective";

        return this;
    }

    setOrthographicScale(value = this.orthographicScale) {
        this.orthographicScale = Math.min(
            Math.max(Vector.number(value, this.orthographicScale), this.minOrthographicScale),
            this.maxOrthographicScale,
        );

        return this;
    }

    update(dt = 1 / 60) {
        this.orbit.update(dt);

        this.viewMatrix = Matrix.lookAt(
            this.position,
            this.target,
            this.up,
        );

        this.projectionMatrix = this.createProjectionMatrix();

        this.viewProjectionMatrix = this.projectionMatrix
            .clone()
            .multiply(this.viewMatrix);

        this.inverseViewProjectionMatrix = this.viewProjectionMatrix
            .clone()
            .invert();

        return this;
    }

    createProjectionMatrix() {
        if (this.projection === "orthographic") {
            const halfHeight = this.orthographicScale * 0.5;
            const halfWidth = halfHeight * this.aspect;

            return Matrix.orthographic(
                -halfWidth,
                halfWidth,
                -halfHeight,
                halfHeight,
                this.near,
                this.far,
            );
        }

        return Matrix.perspective(
            this.fov * Math.PI / 180,
            this.aspect,
            this.near,
            this.far,
        );
    }

    toViewportCamera() {
        return this.orbit.toPayload(this);
    }

    toRendererCamera() {
        return {
            camera: this.toViewportCamera(),

            view: this.viewMatrix.data,
            projection: this.projectionMatrix.data,
            viewProj: this.viewProjectionMatrix.data,

            cameraPos: this.position.toArray(),
            cameraPosition: this.position.toObject(),

            viewMatrix: this.viewMatrix,
            projectionMatrix: this.projectionMatrix,
            viewProjectionMatrix: this.viewProjectionMatrix,
            inverseViewProjectionMatrix: this.inverseViewProjectionMatrix,
        };
    }

    screenToWorldAtDepth(x, y, depth01, viewport) {
        const nx = (x / Math.max(1, viewport.width)) * 2 - 1;
        const ny = 1 - (y / Math.max(1, viewport.height)) * 2;
        const nz = depth01 * 2 - 1;

        const point = this.inverseViewProjectionMatrix.transformPoint(
            [nx, ny, nz],
            1,
        );

        const w = point.w || 1;

        return {
            x: point.x / w,
            y: point.y / w,
            z: point.z / w,
        };
    }

    rayFromScreen(x, y, viewport) {
        const near = this.screenToWorldAtDepth(x, y, 0, viewport);
        const far = this.screenToWorldAtDepth(x, y, 1, viewport);

        const direction = Vector
            .sub(far, near)
            .normalize([0, 1, 0]);

        return {
            origin: near,
            dir: direction.toObject(),
        };
    }
}
