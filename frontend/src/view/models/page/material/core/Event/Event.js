import {Layer} from '@/view/models/page/material/core/Event/Layer/Layer';

export class Event {
    constructor({ canvas, session, mode = "all" }) {
        this.canvas = canvas;
        this.session = session;
        this.mode = mode;

        this.pointer = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            ray: null
        };

        this.root = new Layer({ id: "root", target: session, mode });
        this.session.rootEvent = this.root;

        this._bind();
    }

    /* ============================= */
    /* EVENT BINDINGS                */
    /* ============================= */

    _bind() {
        ["pointerdown", "pointermove", "pointerup", "wheel"].forEach(type =>
            this.canvas.addEventListener(type, e => this._emit(type, e))
        );
        ["keydown", "keyup", "resize"].forEach(type =>
            window.addEventListener(type, e => this._emit(type, e))
        );
    }

    /* ============================= */
    /* EMIT                          */
    /* ============================= */

    _emit(type, e) {
        this._updatePointer(e);

        const event = {
            type,
            originalEvent: e,
            pointer: { ...this.pointer },
            session: this.session,
            mode: this.mode,
            resize: type === "resize"
                ? { width: window.innerWidth, height: window.innerHeight }
                : null,
            hits: type.startsWith("pointer") && this.session?.ray
                ? this.session.ray(this.pointer.x, this.pointer.y)
                : []
        };

        this.root.dispatch(event);
    }

    /* ============================= */
    /* POINTER UPDATE                */
    /* ============================= */

    _updatePointer(e) {
        if (!e.clientX && !e.touches) return;

        const rect = this.canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;

        const x = (cx - rect.left) * (this.canvas.width / rect.width);
        const y = (cy - rect.top)  * (this.canvas.height / rect.height);

        this.pointer.x = x;
        this.pointer.y = y;

        console.log(x,y)

        if (!this.session.camera) {
            this.pointer.worldX = x;
            this.pointer.worldY = y;
            this.pointer.ray = null;
            return;
        }

        /* ---------- 2D ---------- */
        if (this.session.camera.world === "2d") {
            const w = this.session.camera.screenToWorld(x, y);
            this.pointer.worldX = w.x;
            this.pointer.worldY = w.y;
            this.pointer.ray = null;
            return;
        }

        /* ---------- 3D ---------- */
        const viewport = this.session?._config?.viewport;
        if (!viewport) return;

        const ray = this.session.camera.rayFromScreen(x, y, viewport);
        this.pointer.ray = ray;

        // optional: project ray to ground plane (y = 0)
        const t = ray.dir.y !== 0
            ? (-ray.origin.y / ray.dir.y)
            : null;

        if (t > 0) {
            this.pointer.worldX = ray.origin.x + ray.dir.x * t;
            this.pointer.worldY = ray.origin.z + ray.dir.z * t;
        } else {
            this.pointer.worldX = NaN;
            this.pointer.worldY = NaN;
        }
    }

    /* ============================= */
    /* MODE MANAGEMENT               */
    /* ============================= */

    setMode(mode) {
        this.mode = mode;
        this._updateMode(this.root);
    }

    _updateMode(node) {
        node.enabled = !node.mode || node.mode === this.mode;
        for (const c of node.children) this._updateMode(c);
    }

    /* ============================= */
    /* REGISTRATION                  */
    /* ============================= */

    register(target, type, handler, mode = null, priority = 0) {
        const layer = new EventLayer({ target, mode, priority });
        layer.on(type, handler);
        this.root.attach(layer);
        return layer;
    }

    unregister(layer) {
        if (layer.parent) layer.parent.detach(layer);
    }
}
