import {Layer} from "@/view/models/page/material/core/Event/Layer/Layer";

export class Event {
    constructor({ canvas = null, session = {}, mode = "all" } = {}) {
        this.canvas = canvas;
        this.session = session;
        this.mode = mode;
        this.disposers = [];

        this.pointer = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            ray: null,
        };

        this.root = new Layer({ id: "root", target: session, mode });

        if (this.session && typeof this.session === "object") {
            this.session.rootEvent = this.root;
        }

        this.bind();
    }

    bind() {
        if (this.canvas) {
            ["pointerdown", "pointermove", "pointerup", "wheel"].forEach(type => {
                const handler = event => this.emit(type, event);

                this.canvas.addEventListener(type, handler);
                this.disposers.push(() => this.canvas?.removeEventListener(type, handler));
            });
        }

        ["keydown", "keyup", "resize"].forEach(type => {
            const handler = event => this.emit(type, event);

            window.addEventListener(type, handler);
            this.disposers.push(() => window.removeEventListener(type, handler));
        });

        return this;
    }

    destroy() {
        this.disposers.splice(0).forEach(dispose => dispose());
        this.root.destroy();

        return this;
    }

    emit(type, originalEvent = null) {
        this.updatePointer(originalEvent);

        const event = {
            type,
            originalEvent,
            pointer: { ...this.pointer },
            session: this.session,
            mode: this.mode,
            path: [],
            consumed: false,
            resize: type === "resize"
                ? { width: window.innerWidth, height: window.innerHeight }
                : null,
            hits: type.startsWith("pointer") && this.session?.ray
                ? this.session.ray(this.pointer.x, this.pointer.y)
                : [],
        };

        this.root.dispatch(event);

        return event;
    }

    updatePointer(event = null) {
        if (!event || event.clientX === undefined) {
            return this;
        }

        const rect = this.canvas?.getBoundingClientRect?.();
        const cx = event.touches?.[0]?.clientX ?? event.clientX;
        const cy = event.touches?.[0]?.clientY ?? event.clientY;
        const x = rect
            ? (cx - rect.left) * ((this.canvas.width || rect.width || 1) / Math.max(rect.width, 1))
            : cx;
        const y = rect
            ? (cy - rect.top) * ((this.canvas.height || rect.height || 1) / Math.max(rect.height, 1))
            : cy;

        this.pointer.x = x;
        this.pointer.y = y;

        const camera = this.session?.camera;

        if (!camera) {
            this.pointer.worldX = x;
            this.pointer.worldY = y;
            this.pointer.ray = null;
            return this;
        }

        if (camera.world === "2d" && typeof camera.screenToWorld === "function") {
            const world = camera.screenToWorld(x, y);

            this.pointer.worldX = world.x;
            this.pointer.worldY = world.y;
            this.pointer.ray = null;
            return this;
        }

        const viewport = this.session?._config?.viewport || {
            width: this.canvas?.width || rect?.width || 1,
            height: this.canvas?.height || rect?.height || 1,
        };

        if (typeof camera.rayFromScreen !== "function") {
            return this;
        }

        const ray = camera.rayFromScreen(x, y, viewport);
        this.pointer.ray = ray;

        const t = ray?.dir?.y !== 0
            ? (-ray.origin.y / ray.dir.y)
            : null;

        if (t > 0) {
            this.pointer.worldX = ray.origin.x + ray.dir.x * t;
            this.pointer.worldY = ray.origin.z + ray.dir.z * t;
        } else {
            this.pointer.worldX = NaN;
            this.pointer.worldY = NaN;
        }

        return this;
    }

    setMode(mode) {
        this.mode = mode;
        this.updateMode(this.root);

        return this;
    }

    updateMode(node) {
        node.enabled = !node.mode || node.mode === this.mode;

        for (const child of node.children) {
            this.updateMode(child);
        }
    }

    register(target, type, handler, mode = null, priority = 0) {
        const layer = new Layer({ target, mode, priority });

        layer.on(type, handler);
        this.root.attach(layer);

        return layer;
    }

    unregister(layer) {
        layer?.destroy?.();

        return this;
    }
}
