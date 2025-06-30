import {viewportEvent} from "@/dataLayer/event/viewport";
import {
    layerEvent,
    layerModifierEvent,
    selectLayerEvent,
    textLayerEvent,
    textModifierEvent
} from "@/dataLayer/event/layer";
import {globalBackupEvent} from "@/dataLayer/event/backup";
import {windowStateEvent} from "@/dataLayer/event/windowState";
import {fileEvent, fileSettingEvent} from "@/dataLayer/event/file";
import {settingEvent} from "@/dataLayer/event/setting";
import {channelEvent} from "@/dataLayer/event/channel";
import {contextMenuEvent} from "@/dataLayer/event/contextMenu";
import {fontsEvent} from "@/dataLayer/event/font";
import {modifierEvent} from "@/dataLayer/event/modifier";
import {aiEvent} from "@/dataLayer/event/ai";
import {brushEvent} from "@/dataLayer/event/brush";
import {cursorEvent} from "@/dataLayer/event/cursor";

/**
 * Kombiniert alle Events zu einem Handler-Objekt
 */
const eventHandler = (route) => ({
    ...fontsEvent(route),
    ...globalBackupEvent(route),
    ...cursorEvent(route),
    ...windowStateEvent(route),
    ...selectLayerEvent(route),
    ...aiEvent(route),
    ...settingEvent(route),
    ...brushEvent(route),
    ...viewportEvent(route),
    ...modifierEvent(route),
    ...fileEvent(route),
    ...fileSettingEvent(route),
    ...layerEvent(route),
    ...layerModifierEvent(route),
    ...textLayerEvent(route),
    ...textModifierEvent(route),
    ...channelEvent(route),
    ...contextMenuEvent(route)
});

/**
 * Event Manager – nimmt alle Events entgegen und ruft den passenden Handler auf
 */
const eventManager = (handlers) => {
    return async (event, payload) => {
        const handler = handlers[event];
        if (handler) {
            try {
                await handler(payload);
            } catch (error) {
                console.error(`Error in event '${event}':`, error?.response?.data || error.message);
            }
        } else {
            console.warn(`No handler found for event '${event}'`);
        }
    };
};

/**
 * Exportierte Initialisierungsfunktion
 * @param {Object} deps - Alle externen Abhängigkeiten
 */
export const createEventSystem = (deps) => {
    const route = {
        ...deps,
        emit: null
    };

    const emit = eventManager(eventHandler(route));
    route.emit = emit;

    return emit;
};
