const registry = new Map();

const createKey = ({ scope, id }) => `${scope || "default"}:${id || "unknown"}`;

export const WebGLRuntime = {
    register(entry) {
        if (!entry?.id) {
            return;
        }

        const key = createKey(entry);

        registry.set(key, {
            ...entry,
            key,
            createdAt: Date.now(),
            active: true,
        });
    },

    unregister({ scope, id }) {
        const key = createKey({ scope, id });
        registry.delete(key);
    },

    destroy({ scope, id }) {
        const key = createKey({ scope, id });
        const entry = registry.get(key);

        if (!entry) {
            return;
        }

        try {
            entry.destroy?.();
        } catch (error) {
            console.warn("[WebGLRuntime] destroy failed", error);
        }

        registry.delete(key);
    },

    destroyScope(scope) {
        Array.from(registry.values()).forEach(entry => {
            if (entry.scope !== scope) {
                return;
            }

            this.destroy({
                scope: entry.scope,
                id: entry.id,
            });
        });
    },

    destroyAllExceptScope(scope) {
        Array.from(registry.values()).forEach(entry => {
            if (entry.scope === scope) {
                return;
            }

            this.destroy({
                scope: entry.scope,
                id: entry.id,
            });
        });
    },

    pauseScope(scope) {
        Array.from(registry.values()).forEach(entry => {
            if (entry.scope !== scope) {
                return;
            }

            entry.pause?.();
            entry.active = false;
        });
    },

    resumeScope(scope) {
        Array.from(registry.values()).forEach(entry => {
            if (entry.scope !== scope) {
                return;
            }

            entry.resume?.();
            entry.active = true;
        });
    },

    setExclusiveScope(scope) {
        this.destroyAllExceptScope(scope);
    },

    list() {
        return Array.from(registry.values()).map(entry => ({
            key: entry.key,
            id: entry.id,
            scope: entry.scope,
            active: entry.active,
            createdAt: entry.createdAt,
        }));
    },
};