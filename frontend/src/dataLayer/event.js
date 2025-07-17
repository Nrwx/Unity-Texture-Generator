//event.js
import createListenerManager from "@/dataLayer/listener";
import {listenerEvent} from "@/dataLayer/event/listener";
import {viewportEvent} from "@/dataLayer/event/viewport";
import {
    layerEvent,
    layerModifierEvent, pathLayerEvent, pathModifierEvent,
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
import {appEvent} from "@/dataLayer/event/app";
import {notifyEvent} from "@/dataLayer/event/notify";


/**
 * Kombiniert alle Events zu einem Handler-Objekt
 */
const eventHandler = (route) => ({
    ...listenerEvent(route),
    ...appEvent(route),
    ...fontsEvent(route),
    ...globalBackupEvent(route),
    ...cursorEvent(route),
    ...notifyEvent(route),
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
    ...pathLayerEvent(route),
    ...pathModifierEvent(route),
    ...channelEvent(route),
    ...contextMenuEvent(route)
});


/**
 * Event Manager – nimmt alle Events entgegen und ruft den passenden Handler auf
 */
const eventManager = (handlers) => {
    return async (event, payload=undefined) => {
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
        emit: null,
    };

    route.listener = createListenerManager();

    const emit = eventManager(eventHandler(route));
    route.emit = emit;
    return emit;
};

/**
 * @param id
 * @param emitEvent
 */
export const eventRegister = (id='', emitEvent=null) => {
    if (!id || id === '' || typeof id !== 'string') {
        console.warn(`[eventRegister] ⚠️ id ist nicht definiert oder kein String!`);
    }
    if (!emitEvent || typeof emitEvent !== 'function') {
        console.warn(`[eventRegister] ⚠️ emitEvent ist nicht definiert oder keine Funktion!`);
    }
    /**
     * @param mode
     * @param target
     * @param type
     * @param handler
     * @param options
     */
    const register = (mode, target, type, handler, options = false) => {

        switch (mode) {
            case 'add':
                if (!target || typeof target.addEventListener !== 'function') {
                    console.warn(`Ungültiges Target für EventListener:`, target);
                    return;
                }
                emitEvent('event:listener', {
                    add: true,
                    id: id,
                    target: target,
                    type: type,
                    handler: handler,
                    options: options,
                    active: true
                });
                break;

            case 'pause':
                emitEvent('event:listener', {
                    pause: true,
                    id,
                });
                break;

            case 'remove':
                emitEvent('event:listener', {
                    remove: true,
                    id: id,
                    type: type,
                    handler: handler
                });
                break;

            case 'removeAll':
                emitEvent('event:listener', {
                    removeAll: true,
                    id,
                });
                break;
        }
    };

    return { register };
};

