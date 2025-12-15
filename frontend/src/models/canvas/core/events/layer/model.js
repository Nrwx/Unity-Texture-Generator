export class EventLayer {
    constructor({
            id = crypto.randomUUID(),
            enabled = true,
            priority = 0,
            hitTest = null,       // (pointer, scene) => boolean
            target = null,        // Scene | Entity | Tool | whatever
            mode = null           // optional: mode für Mode-spezifische Events
        } = {}) {
        this.id = id;
        this.enabled = enabled;
        this.priority = priority;
        this.hitTest = hitTest;
        this.target = target;
        this.mode = mode;

        this.parent = null;
        this.children = new Set();
        this.handlers = new Map(); // type -> fn
    }

    // =============================
    // TREE MANAGEMENT
    // =============================
    attach(child) {
        child.parent = this;
        this.children.add(child);
        return child;
    }

    detach(child) {
        child.parent = null;
        this.children.delete(child);
    }

    setEnabled(state) {
        this.enabled = state;
    }

    // =============================
    // HANDLERS
    // =============================
    on(type, fn) {
        this.handlers.set(type, fn);
        return this;
    }

    off(type) {
        this.handlers.delete(type);
    }

    // =============================
    // CORE DISPATCH
    // =============================
    dispatch(event) {
        // 0️⃣ Nur aktive Events
        if (!this.enabled) return false;
        if (this.parent && !this.parent.enabled) return false;

        // 1️⃣ Prüfe Mode
        if (this.mode && event.mode && this.mode !== event.mode) return false;

        // 2️⃣ Prüfe Hit-Test
        if (this.hitTest && !this.hitTest(event.pointer, event.scene)) return false;

        // 3️⃣ Dispatch an Children (Topmost zuerst nach Priority)
        const sorted = [...this.children].sort((a, b) => b.priority - a.priority);
        for (const child of sorted) {
            if (child.dispatch(event)) return true;
        }

        // 4️⃣ Eigener Handler
        const handler = this.handlers.get(event.type);
        if (handler) {
            handler(event);
            return true;
        }

        return false;
    }
}
