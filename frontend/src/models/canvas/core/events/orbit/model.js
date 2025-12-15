export class Orbit {
    constructor({
                    camera,
                    mode = "2d",          // "2d" | "3d"
                    zoomSpeed = 0.001,
                    panSpeed = 1,
                    rotateSpeed = 0.005
                }) {
        this.camera = camera;
        this.mode = mode;

        this.zoomSpeed = zoomSpeed;
        this.panSpeed = panSpeed;
        this.rotateSpeed = rotateSpeed;

        this.dragging = false;
        this.last = { x: 0, y: 0 };

        // 3D Orbit State
        this.theta = 0;
        this.phi = Math.PI / 2;
        this.radius = 10;

        if (this.mode === "3d") {
            this._syncFromCamera();
        }
    }

    // ============================================================
    // LIFECYCLE
    // ============================================================

    update() {
        if (this.mode === "3d") {
            this._updateCamera3D();
        }
    }

    _syncFromCamera() {
        const dx = this.camera.position.x - this.camera.target.x;
        const dy = this.camera.position.y - this.camera.target.y;
        const dz = this.camera.position.z - this.camera.target.z;

        this.radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
        this.theta = Math.atan2(dz, dx);
        this.phi = Math.acos(dy / this.radius);
    }

    // ============================================================
    // EVENTS
    // ============================================================

    pointerdown = e => {
        this.dragging = true;
        this.last.x = e.pointer.x;
        this.last.y = e.pointer.y;
    };

    pointerup = () => {
        this.dragging = false;
    };

    pointermove = e => {
        if (!this.dragging) return;

        const dx = e.pointer.x - this.last.x;
        const dy = e.pointer.y - this.last.y;

        this.last.x = e.pointer.x;
        this.last.y = e.pointer.y;

        if (this.mode === "2d") {
            this._pan2D(dx, dy);
        } else {
            this._orbit3D(dx, dy);
        }
    };

    wheel = e => {
        if (this.mode === "2d") {
            this._zoom2D(e.originalEvent.deltaY, e.pointer);
        } else {
            this._dolly3D(e.originalEvent.deltaY);
        }
    };

    // ============================================================
    // 2D
    // ============================================================

    _pan2D(dx, dy) {
        this.camera.position.x -= dx / this.camera.zoom * this.panSpeed;
        this.camera.position.y -= dy / this.camera.zoom * this.panSpeed;
    }

    _zoom2D(delta, pointer) {
        const zoomFactor = Math.exp(-delta * this.zoomSpeed);
        const oldZoom = this.camera.zoom;
        const newZoom = Math.max(0.01, oldZoom * zoomFactor);

        const wx = pointer.worldX;
        const wy = pointer.worldY;

        this.camera.zoom = newZoom;
        this.camera.position.x = wx - (wx - this.camera.position.x) * (oldZoom / newZoom);
        this.camera.position.y = wy - (wy - this.camera.position.y) * (oldZoom / newZoom);
    }

    // ============================================================
    // 3D
    // ============================================================

    _orbit3D(dx, dy) {
        this.theta -= dx * this.rotateSpeed;
        this.phi   -= dy * this.rotateSpeed;

        const eps = 0.001;
        this.phi = Math.max(eps, Math.min(Math.PI - eps, this.phi));
    }

    _dolly3D(delta) {
        this.radius *= Math.exp(delta * 0.001);
        this.radius = Math.max(0.1, this.radius);
    }

    _updateCamera3D() {
        const sinPhi = Math.sin(this.phi);

        this.camera.position.x =
            this.camera.target.x + this.radius * sinPhi * Math.cos(this.theta);
        this.camera.position.y =
            this.camera.target.y + this.radius * Math.cos(this.phi);
        this.camera.position.z =
            this.camera.target.z + this.radius * sinPhi * Math.sin(this.theta);
    }
}
