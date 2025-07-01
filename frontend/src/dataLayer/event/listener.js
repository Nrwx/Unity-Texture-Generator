export const listenerEvent = (route) => ({
    "event:listener": async (payload) => {
        if (payload.add) {
            route.listener.add(payload.id, payload.target, payload.type, payload.handler, payload.options, payload.active);
        }
        else if (payload.remove) {
            route.listener.remove(payload.id, payload.type, payload.handler);
        }
        else if (payload.removeAll) {
            route.listener.remove(payload.id);
        }
        else if (payload.pause) {
            route.listener.pause(payload.id, payload.type, payload.handler);
        }
        else if (payload.resume) {
            route.listener.resume(payload.id, payload.type, payload.handler);
        }
    },
})