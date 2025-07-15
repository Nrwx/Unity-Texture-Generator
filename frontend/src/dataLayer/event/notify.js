export const notifyEvent = (route) => ({
    "notify:apply-name": async (payload) => {
        route.notifyMessage.value.name = payload;
    },
    "notify:apply-message": async (payload) => {
        route.notifyMessage.value.message = payload;
    },
    "notify:apply-time": async (payload) => {
        route.notifyMessage.value.time = payload;
    },
    "notify:apply-mute": async (payload) => {
        route.notifyMessage.value.mute = payload;
    },
    "notify:apply-remind": async (payload) => {
        route.notifyMessage.value.remind = payload;
    },
    "notify:apply-rTime": async (payload) => {
        route.notifyMessage.value.rTime = payload;
    },
    "notify:apply-color": async (payload) => {
        route.notifyMessage.value.color = payload;
    },
    "notify:apply-icon": async (payload) => {
        route.notifyMessage.value.icon = payload;
    },
    "notify:apply-event": async (payload) => {
        route.notifyMessage.value.event = payload;
    },
    "notify:reset": async (payload) => {
        if(payload.name) {
            await route.emit('notify:apply-name', '');
        }
        if(payload.message) {
            await route.emit('notify:apply-message', '');
        }
        if(payload.remind) {
            await route.emit('notify:apply-remind', false);
        }
    }
});

