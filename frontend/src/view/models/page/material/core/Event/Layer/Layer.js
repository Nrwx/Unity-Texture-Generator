import { uuid } from "@/utils/uuid";

export class Layer {
    constructor({
                    id = null,
                    enabled = true,
                    priority = 0,
                    hitTest = null,
                    target = null,
                    mode = null,
                } = {}) {
        this.id = id ?? uuid("event");
        this.enabled = enabled;
        this.priority = priority;
        this.hitTest = hitTest;
        this.target = target;
        this.mode = mode;

        this.parent = null;
        this.children = new Set();
        this.handlers = new Map();
    }

    attach(child) {
        if (!child || child === this) {
            return child;
        }

        if (child.parent) {
            child.parent.detach(child);
        }

        child.parent = this;
        this.children.add(child);

        return child;
    }

    detach(child) {
        if (!child) {
            return null;
        }

        if (child.parent === this) {
            child.parent = null;
        }

        this.children.delete(child);

        return child;
    }

    clear() {
        for (const child of this.children) {
            child.parent = null;
        }

        this.children.clear();
        this.handlers.clear();

        return this;
    }

    destroy() {
        if (this.parent) {
            this.parent.detach(this);
        }

        return this.clear();
    }

    setEnabled(state) {
        this.enabled = state === true;
        return this;
    }

    on(type, fn) {
        if (typeof fn !== "function") {
            throw new Error("[Layer.on] handler must be a function");
        }

        this.handlers.set(type, fn);
        return this;
    }

    off(type) {
        this.handlers.delete(type);
        return this;
    }

    accepts(event) {
        if (!this.enabled) {
            return false;
        }

        if (this.mode && event.mode && this.mode !== event.mode) {
            return false;
        }

        if (this.hitTest && !this.hitTest(event.pointer, event.session, event)) {
            return false;
        }

        return true;
    }

    dispatch(event) {
        if (!this.accepts(event)) {
            return false;
        }

        if (!Array.isArray(event.path)) {
            event.path = [];
        }

        event.path.push(this);

        const children = [...this.children].sort((a, b) => b.priority - a.priority);

        for (const child of children) {
            if (child.dispatch(event)) {
                return true;
            }
        }

        const handler = this.handlers.get(event.type);

        if (!handler) {
            return false;
        }

        const result = handler(event, {
            layer: this,
            target: this.target,
            session: event.session,
            hub: event.hub,
        });

        return result === true || event.consumed === true;
    }
}
