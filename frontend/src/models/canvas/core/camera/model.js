import { matrixMultiply } from "@/utils/matrix";

export class Camera {
    constructor(model) {
        this.mode = model.mode;

        this.position = model.position;
        this.target = model.target;
        this.zoom = model.zoom;

        this.fov = model.fov;
        this.near = model.near;
        this.far = model.far;

        this.viewMatrix = new Float32Array(16);
        this.projMatrix = new Float32Array(16);
        this.viewProjMatrix = new Float32Array(16);
    }

    // ============================================================
    // Update
    // ============================================================
    update(viewport) {
        this._updateView();
        this._updateProjection(viewport);
        this.viewProjMatrix = matrixMultiply(
            this.projMatrix,
            this.viewMatrix,
            true
        );
    }

    // ============================================================
    // VIEW
    // ============================================================
    _updateView() {
        if (this.mode === "2d") {
            this.viewMatrix.set([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                -this.position.x,
                -this.position.y,
                0,
                1
            ]);
        } else {
            // simple look-at (3D)
            // (kann später durch echte LookAt-Matrix ersetzt werden)
            this.viewMatrix.set([
                1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                -this.position.x,
                -this.position.y,
                -this.position.z,
                1
            ]);
        }
    }

    // ============================================================
    // PROJECTION
    // ============================================================
    _updateProjection(viewport) {
        const { width, height } = viewport;
        const aspect = width / height;

        if (this.mode === "2d") {
            const w = width / this.zoom;
            const h = height / this.zoom;

            this.projMatrix.set([
                2 / w, 0, 0, 0,
                0, -2 / h, 0, 0,
                0, 0, 1, 0,
                -1, 1, 0, 1
            ]);
        } else {
            const f = 1 / Math.tan((this.fov * Math.PI) / 360);
            const nf = 1 / (this.near - this.far);

            this.projMatrix.set([
                f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, (this.far + this.near) * nf, -1,
                0, 0, (2 * this.far * this.near) * nf, 0
            ]);
        }
    }

    // ============================================================
    // Screen → World
    // ============================================================
    screenToWorld(x, y, viewport) {
        if (this.mode === "2d") {
            return {
                x: x / this.zoom + this.position.x,
                y: y / this.zoom + this.position.y,
                z: 0
            };
        }

        // 3D handled via ray
        return null;
    }

    // ============================================================
    // Screen → Ray (for Raycast)
    // ============================================================
    rayFromScreen(x, y, viewport) {
        const nx = (x / viewport.width) * 2 - 1;
        const ny = 1 - (y / viewport.height) * 2;

        // ============================
        // 2D → orthografisch
        // ============================
        if (this.mode === "2d") {
            return {
                origin: this.screenToWorld(x, y, viewport),
                dir: { x: 0, y: 0, z: -1 }
            };
        }

        // ============================
        // 3D → Welt-Ray (vereinfachtes Frustum)
        // ============================
        const f = Math.tan((this.fov * Math.PI) / 360);

        const dir = {
            x: nx * f * (viewport.width / viewport.height),
            y: ny * f,
            z: -1
        };

        // normalize
        const len = Math.hypot(dir.x, dir.y, dir.z);
        dir.x /= len;
        dir.y /= len;
        dir.z /= len;

        return {
            origin: { ...this.position },
            dir
        };
    }
}
