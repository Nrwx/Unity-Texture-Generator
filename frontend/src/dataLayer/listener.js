const createListenerManager = () => {
    const listeners = new Map(); // id → Array von Listener-Objekten

    const add = (id, target, type, handler, options) => {
        let list = listeners.get(id);
        if (!list) {
            list = [];
            listeners.set(id, list);
        } else {
            const exists = list.find(l =>
                l.target === target &&
                l.type === type &&
                l.originalHandler === handler &&
                JSON.stringify(l.options) === JSON.stringify(options)
            );
            if (exists) return;
        }

        /**
         * @param {Event} e
         */
        const wrappedHandler = (e) => {
            if (options?.prevent) e.preventDefault();
            return handler(e);
        };

        const listener = {
            target,
            type,
            handler: wrappedHandler,
            options,
            active: true,
            originalHandler: handler
        };

        list.push(listener);
        target.addEventListener(type, wrappedHandler, options);
    };

    const remove = (id, type, handler) => {
        const list = listeners.get(id);
        if (!list) return;

        const filter = {};
        if (type) filter.type = type;
        if (handler) filter.handler = handler;

        if (!type && !handler) {
            for (const l of list) {
                if (l.active) l.target.removeEventListener(l.type, l.handler, l.options);
            }
            listeners.delete(id);
            return;
        }

        for (let i = list.length - 1; i >= 0; i--) {
            const l = list[i];
            let match = true;
            for (const key in filter) {
                if (l[key] !== filter[key]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                if (l.active) l.target.removeEventListener(l.type, l.handler, l.options);
                list.splice(i, 1);
            }
        }
        if (list.length === 0) listeners.delete(id);
    };

    const pause = (id, type, handler) => {
        if (!id) return pauseAll();
        const list = listeners.get(id);
        if (!list) return;

        const filter = {};
        if (type) filter.type = type;
        if (handler) filter.handler = handler;

        for (const l of list) {
            let match = true;
            for (const key in filter) {
                if (l[key] !== filter[key]) {
                    match = false;
                    break;
                }
            }
            if (match && l.active) {
                l.target.removeEventListener(l.type, l.handler, l.options);
                l.active = false;
            }
        }
    };

    const resume = (id, type, handler) => {
        if (!id) return resumeAll();
        const list = listeners.get(id);
        if (!list) return;

        const filter = {};
        if (type) filter.type = type;
        if (handler) filter.handler = handler;

        for (const l of list) {
            let match = true;
            for (const key in filter) {
                if (l[key] !== filter[key]) {
                    match = false;
                    break;
                }
            }
            if (match && !l.active) {
                l.target.addEventListener(l.type, l.handler, l.options);
                l.active = true;
            }
        }
    };

    const pauseAll = () => {
        for (const list of listeners.values()) {
            for (const l of list) {
                if (l.active) {
                    l.target.removeEventListener(l.type, l.handler, l.options);
                    l.active = false;
                }
            }
        }
    };

    const resumeAll = () => {
        for (const list of listeners.values()) {
            for (const l of list) {
                if (!l.active) {
                    l.target.addEventListener(l.type, l.handler, l.options);
                    l.active = true;
                }
            }
        }
    };

    const destroy = () => {
        pauseAll();
        listeners.clear();
    };

    return {
        add,
        remove,
        pause,
        resume,
        pauseAll,
        resumeAll,
        destroy,
        list: () => Array.from(listeners.entries()),
        count: () => Array.from(listeners.values()).reduce((sum, list) => sum + list.length, 0),
        isActive: (id) => {
            if (id) {
                const list = listeners.get(id);
                if (!list) return false;
                return list.every(l => l.active);
            }
            return Array.from(listeners.values()).every(list => list.every(l => l.active));
        }
    };
};

export default createListenerManager;
