import { EventLayer } from "@/models/canvas/core/events/layer/model";

export class EventHub {
    constructor({ canvas, scene, camera, mode = "all" }) {
        this.canvas = canvas;
        this.scene = scene;
        this.camera = camera;
        this.mode = mode; // aktueller Mode

        this.pointer = { x: 0, y: 0, worldX: 0, worldY: 0 };

        // Root Event Container für den aktiven Mode
        this.root = new EventLayer({ id: "root", target: scene, mode });
        this.scene.rootEvent = this.root;

        this._bind();
    }

    // =============================
    // EVENT BINDINGS
    // =============================
    _bind() {
        ["pointerdown", "pointermove", "pointerup"].forEach(type =>
            this.canvas.addEventListener(type, e => this._emit(type, e))
        );
        ["keydown", "keyup"].forEach(type =>
            window.addEventListener(type, e => this._emit(type, e))
        );
        ["resize"].forEach(type =>
            window.addEventListener(type, e => this._emit(type, e))
        );
    }

    // =============================
    // EMIT EVENT
    // =============================
    _emit(type, e) {
        this._updatePointer(e);

        const event = {
            type,
            originalEvent: e,
            pointer: { ...this.pointer },
            camera: this.camera,
            scene: this.scene,
            resize: type === "resize" ? { width: window.innerWidth, height: window.innerHeight } : null,
            mode: this.mode,
            hits: type.startsWith("pointer") ? this.scene.raycastScreen(this.pointer.x, this.pointer.y) : []
        };

        this.root.dispatch(event);
    }

    // =============================
    // POINTER POSITION
    // =============================
    _updatePointer(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top)  * (this.canvas.height / rect.height);

        this.pointer.x = x;
        this.pointer.y = y;

        if (this.camera) {
            const w = this.camera.screenToWorld(x, y, this.scene.viewport);
            this.pointer.worldX = w?.x ?? x;
            this.pointer.worldY = w?.y ?? y;
        } else {
            this.pointer.worldX = x;
            this.pointer.worldY = y;
        }
    }

    // =============================
    // MODE MANAGEMENT
    // =============================
    setMode(mode) {
        this.mode = mode;
        this._updateMode(this.root);
    }

    _updateMode(node) {
        node.enabled = !node.mode || node.mode === this.mode;
        for (const child of node.children) this._updateMode(child);
    }

    // =============================
    // REGISTRATION
    // =============================
    register(target, type, handler, mode = null, priority = 0) {
        const container = new EventLayer({ target, mode, priority });
        container.on(type, handler);
        this.root.attach(container);
        return container;
    }

    unregister(container) {
        if (container.parent) container.parent.detach(container);
    }
}
