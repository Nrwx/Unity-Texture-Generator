const registry = new Map();

const createKey = ({ scope, id }) => `${scope || "default"}:${id || "unknown"}`;

const safeCall = (entry, name, payload = {}) => {
    const callback = entry?.[name];

    if (typeof callback !== "function") {
        return false;
    }

    try {
        callback(payload);
        return true;
    } catch (error) {
        console.warn(`[WebGLRuntime] ${name} failed`, error);
        return false;
    }
};

const markPaused = entry => {
    entry.active = false;
    entry.paused = true;
    entry.pausedAt = Date.now();
};

const markActive = entry => {
    entry.active = true;
    entry.paused = false;
    entry.resumedAt = Date.now();
};

export const WebGLRuntime = {
    register(entry) {
        if (!entry?.id) {
            return;
        }

        const key = createKey(entry);
        const previous = registry.get(key);

        registry.set(key, {
            ...entry,
            key,
            createdAt: previous?.createdAt || Date.now(),
            registeredAt: Date.now(),
            active: true,
            paused: false,
            pausedAt: previous?.pausedAt || null,
            resumedAt: previous?.resumedAt || null,
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

        safeCall(entry, "destroy", {
            reason: "destroy",
            preserveRegistry: false,
        });

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
            if (entry.scope !== scope || entry.paused === true) {
                return;
            }

            // A paused WebGL layer must release GPU resources. The entry stays
            // registered so resumeScope can safely rebuild the renderer later.
            const handledByPause = safeCall(entry, "pause", {
                reason: "pause",
                destroy: true,
                preserveRegistry: true,
            });

            if (!handledByPause) {
                safeCall(entry, "destroy", {
                    reason: "pause",
                    preserveRegistry: true,
                });
            }

            const current = registry.get(entry.key);

            if (current) {
                markPaused(current);
            }
        });
    },

    resumeScope(scope) {
        Array.from(registry.values()).forEach(entry => {
            if (entry.scope !== scope || entry.active === true) {
                return;
            }

            // Prefer restore for contexts that were destroyed during pause.
            // Fallback to resume keeps older runtime entries compatible.
            const restored = safeCall(entry, "restore", {
                reason: "resume",
                restore: true,
            });

            if (!restored) {
                safeCall(entry, "resume", {
                    reason: "resume",
                    restore: true,
                });
            }

            const current = registry.get(entry.key);

            if (current) {
                markActive(current);
            }
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
            paused: entry.paused === true,
            createdAt: entry.createdAt,
            registeredAt: entry.registeredAt,
            pausedAt: entry.pausedAt,
            resumedAt: entry.resumedAt,
        }));
    },
};
