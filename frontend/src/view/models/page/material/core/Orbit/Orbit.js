import {Vector} from "@/view/models/page/material/core/Math/Vector/Vector";
import {Quaternion} from "@/view/models/page/material/core/Math/Quaternion/Quaternion";

const DEG = Math.PI / 180;

export class Orbit {
    constructor(camera, {
        radius = 4.6,
        theta = -45 * DEG,
        phi = 58 * DEG,
        target = [0, 0, 0],
        damping = 18,
        rotateSpeed = 0.0065,
        panSpeed = 0.0028,
        dollySpeed = 0.0012,
        minRadius = 0.18,
        maxRadius = 250,
        minPhi = -89.5 * DEG,
        maxPhi = 89.5 * DEG,
    } = {}) {
        this.camera = camera;

        this.theta = theta;
        this.phi = phi;
        this.radius = radius;
        this.target = Vector.from(target);

        this.smoothTheta = theta;
        this.smoothPhi = phi;
        this.smoothRadius = radius;
        this.smoothTarget = this.target.clone();

        this.damping = damping;
        this.rotateSpeed = rotateSpeed;
        this.panSpeed = panSpeed;
        this.dollySpeed = dollySpeed;

        this.minRadius = minRadius;
        this.maxRadius = maxRadius;
        this.minPhi = minPhi;
        this.maxPhi = maxPhi;

        this.position = Vector.zero();
        this.forward = Vector.forward();
        this.right = Vector.right();
        this.up = Vector.up();
        this.rotation = Quaternion.identity();

        this.dragging = false;
        this.last = { x: 0, y: 0 };

        this.updateVectors();
    }

    setOptions(options = {}) {
        if (options.rotateSpeed !== undefined) this.rotateSpeed = Vector.number(options.rotateSpeed, this.rotateSpeed);
        if (options.panSpeed !== undefined) this.panSpeed = Vector.number(options.panSpeed, this.panSpeed);
        if (options.dollySpeed !== undefined) this.dollySpeed = Vector.number(options.dollySpeed, this.dollySpeed);
        if (options.damping !== undefined) this.damping = Vector.number(options.damping, this.damping);
        if (options.minRadius !== undefined) this.minRadius = Vector.number(options.minRadius, this.minRadius);
        if (options.maxRadius !== undefined) this.maxRadius = Vector.number(options.maxRadius, this.maxRadius);
        if (options.minPhi !== undefined) this.minPhi = Vector.number(options.minPhi, this.minPhi);
        if (options.maxPhi !== undefined) this.maxPhi = Vector.number(options.maxPhi, this.maxPhi);

        this.radius = Math.min(Math.max(this.radius, this.minRadius), this.maxRadius);
        this.phi = this.clampPhi(this.phi);

        return this;
    }

    update(dt = 1 / 60) {
        const alpha = this.damping <= 0
            ? 1
            : 1 - Math.exp(-this.damping * dt);

        this.smoothTheta += (this.theta - this.smoothTheta) * alpha;
        this.smoothPhi += (this.phi - this.smoothPhi) * alpha;
        this.smoothRadius += (this.radius - this.smoothRadius) * alpha;
        this.smoothTarget.lerp(this.target, alpha);

        this.updateVectors();

        if (this.camera) {
            this.camera.position.copy(this.position);
            this.camera.target.copy(this.smoothTarget);
            this.camera.rotation.copy(this.rotation);
        }

        return this;
    }

    updateVectors() {
        const cosPhi = Math.cos(this.smoothPhi);
        const sinPhi = Math.sin(this.smoothPhi);
        const cosTheta = Math.cos(this.smoothTheta);
        const sinTheta = Math.sin(this.smoothTheta);

        const direction = new Vector(
            cosPhi * sinTheta,
            sinPhi,
            cosPhi * cosTheta,
        ).normalize([0, 0, 1]);

        this.position
            .copy(this.smoothTarget)
            .addScaled(direction, this.smoothRadius);

        this.forward = Vector.sub(this.smoothTarget, this.position).normalize([0, 0, -1]);
        this.right = Vector.cross(this.forward, Vector.up()).normalize([1, 0, 0]);
        this.up = this.right.crossed(this.forward).normalize([0, 1, 0]);
        this.rotation = Quaternion.lookRotation(this.forward, this.up);

        return this;
    }

    syncFromCamera() {
        if (!this.camera) {
            return this;
        }

        this.target.copy(this.camera.target);
        this.smoothTarget.copy(this.camera.target);

        const offset = Vector.sub(this.camera.position, this.camera.target);
        const radius = Math.max(this.minRadius, offset.length());

        this.radius = radius;
        this.smoothRadius = radius;

        this.theta = Math.atan2(offset.x, offset.z);
        this.smoothTheta = this.theta;

        this.phi = Math.asin(Math.min(Math.max(offset.y / radius, -1), 1));
        this.phi = this.clampPhi(this.phi);
        this.smoothPhi = this.phi;

        return this.updateVectors();
    }

    orbit(deltaX = 0, deltaY = 0) {
        this.theta -= deltaX * this.rotateSpeed;
        this.phi -= deltaY * this.rotateSpeed;
        this.phi = this.clampPhi(this.phi);

        return this;
    }

    pan(deltaX = 0, deltaY = 0) {
        const amount = this.smoothRadius * this.panSpeed;

        this.target
            .addScaled(this.right, -deltaX * amount)
            .addScaled(this.up, deltaY * amount);

        return this;
    }

    dolly(delta = 0) {
        this.radius *= Math.exp(delta * this.dollySpeed);
        this.radius = Math.min(Math.max(this.radius, this.minRadius), this.maxRadius);

        return this;
    }

    setState({
                 radius = this.radius,
                 theta = this.theta,
                 phi = this.phi,
                 target = this.target,
                 sync = false,
             } = {}) {
        this.radius = Math.min(Math.max(Vector.number(radius, this.radius), this.minRadius), this.maxRadius);
        this.theta = Vector.number(theta, this.theta);
        this.phi = this.clampPhi(Vector.number(phi, this.phi));
        this.target.copy(target);

        if (sync) {
            this.smoothRadius = this.radius;
            this.smoothTheta = this.theta;
            this.smoothPhi = this.phi;
            this.smoothTarget.copy(this.target);
        }

        return this;
    }

    setTarget(value) {
        this.target.copy(value);
        return this;
    }

    setRadius(value) {
        this.radius = Math.min(Math.max(Vector.number(value, this.radius), this.minRadius), this.maxRadius);
        return this;
    }

    setAngles(theta = this.theta, phi = this.phi) {
        this.theta = Vector.number(theta, this.theta);
        this.phi = this.clampPhi(Vector.number(phi, this.phi));

        return this;
    }

    clampPhi(value) {
        return Math.min(Math.max(value, this.minPhi), this.maxPhi);
    }

    pointerdown = event => {
        const pointer = event.pointer || event;

        this.dragging = true;
        this.last.x = pointer.x ?? pointer.clientX ?? 0;
        this.last.y = pointer.y ?? pointer.clientY ?? 0;
    };

    pointerup = () => {
        this.dragging = false;
    };

    pointermove = event => {
        if (!this.dragging) {
            return;
        }

        const pointer = event.pointer || event;
        const x = pointer.x ?? pointer.clientX ?? 0;
        const y = pointer.y ?? pointer.clientY ?? 0;

        const dx = x - this.last.x;
        const dy = y - this.last.y;

        this.last.x = x;
        this.last.y = y;

        if (event.shiftKey || event.mode === "pan") {
            this.pan(dx, dy);
        } else {
            this.orbit(dx, dy);
        }
    };

    wheel = event => {
        const delta = event.originalEvent?.deltaY ?? event.deltaY ?? 0;
        this.dolly(delta);
    };

    toPayload(camera = this.camera) {
        this.updateVectors();

        return {
            mode: "world_orbit",

            projection: camera?.projection ?? "perspective",
            fov: camera?.fov ?? 50,
            near: camera?.near ?? 0.01,
            far: camera?.far ?? 1000,
            aspect: camera?.aspect ?? 1,

            radius: this.smoothRadius,
            min_radius: this.minRadius,
            max_radius: this.maxRadius,
            orthographic_scale: camera?.orthographicScale ?? 5,
            min_orthographic_scale: camera?.minOrthographicScale ?? 0.05,
            max_orthographic_scale: camera?.maxOrthographicScale ?? 250,

            theta: this.smoothTheta,
            phi: this.smoothPhi,
            min_phi: this.minPhi,
            max_phi: this.maxPhi,
            rotate_speed: this.rotateSpeed,
            pan_speed: this.panSpeed,
            dolly_speed: this.dollySpeed,
            damping: this.damping,

            target: this.smoothTarget.toObject(),
            position: this.position.toObject(),
            forward: this.forward.toObject(),
            right: this.right.toObject(),
            up: this.up.toObject(),

            rotation: this.rotation.toObject(),
        };
    }
}
