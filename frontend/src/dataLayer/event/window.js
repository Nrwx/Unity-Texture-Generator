import {windowManager} from "@/models/window/manager/model";

export const windowEvent = route => ({
    "window:register": async payload => {
        return windowManager.registerWindow(payload);
    },

    "window:update": async payload => {
        return windowManager.updateWindow(payload);
    },

    "window:unregister": async payload => {
        return windowManager.unregisterWindow(payload.id);
    },

    "window:focus": async payload => {
        const next = windowManager.focusWindow(payload.id);

        if (next) {
            await route.emit("window:update", {
                id: next.id,
                zIndex: next.zIndex,
                stackIndex: next.stackIndex,
            });
        }

        return next;
    },

    "window:drag": async payload => {
        return windowManager.updateWindow({
            id: payload.id,
            offset: {
                x: payload.x,
                y: payload.y,
            },
        });
    },

    "window:reset": async payload => {
        const next = windowManager.resetWindow(payload.id);

        if (next) {
            await route.emit("window:update", {
                id: next.id,
                offset: {
                    x: 0,
                    y: 0,
                },
            });
        }

        return next;
    },

    "window:reset-all": async () => {
        const all = windowManager.resetAllWindows();

        await Promise.all(
            Object.keys(all).map(id => route.emit("window:update", {
                id,
                offset: {
                    x: 0,
                    y: 0,
                },
            }))
        );

        return all;
    },

    "window:close": async payload => {
        const next = windowManager.closeWindow(payload.id);

        if (next?.closeEvent) {
            await route.emit(next.closeEvent, false);
        }

        return next;
    },

    "window:close-all": async () => {
        const all = windowManager.closeAllWindows();

        await Promise.all(
            Object.values(all)
                .filter(item => item.closeEvent)
                .map(item => route.emit(item.closeEvent, false))
        );

        return all;
    },

    "window:meta": async payload => {
        return windowManager.getWindowMeta(payload?.id);
    },

    "window:stacked": async () => {
        return windowManager.stacked.value;
    },
});