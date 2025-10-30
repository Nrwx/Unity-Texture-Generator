//event.js
import createListenerManager from "@/dataLayer/listener";
import {listenerEvent} from "@/dataLayer/event/listener";
import {viewportEvent} from "@/dataLayer/event/viewport";
import {
    brushLayerEvent,
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
import {keyEvent} from "@/dataLayer/event/key";
import {exportEvent} from "@/dataLayer/event/export";
import {rendererEvent} from "@/dataLayer/event/renderer";
import {pathEvent} from "@/dataLayer/event/path";
import {timelineEvent} from "@/dataLayer/event/timeline";
import {taskEvent} from "@/dataLayer/event/task";
import {canvasEvent} from "@/dataLayer/event/canvas";
import {createCanvasEnvironment} from "@/dataLayer/canvas";


/**
 * Kombiniert alle Events zu einem Handler-Objekt
 */
const eventHandler = (route) => ({
    ...canvasEvent(route),
    ...listenerEvent(route),
    ...keyEvent(route),
    ...appEvent(route),
    ...timelineEvent(route),
    ...fontsEvent(route),
    ...globalBackupEvent(route),
    ...cursorEvent(route),
    ...notifyEvent(route),
    ...windowStateEvent(route),
    ...selectLayerEvent(route),
    ...aiEvent(route),
    ...settingEvent(route),
    ...taskEvent(route),
    ...brushEvent(route),
    ...brushLayerEvent(route),
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
    ...contextMenuEvent(route),
    ...exportEvent(route),
    ...rendererEvent(route),
    ...pathEvent(route)
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
    route.canvas = createCanvasEnvironment();

    const emit = eventManager(eventHandler(route));
    route.emit = emit;
    return emit;
};

/**
 * @param {string} id - eindeutige Listener ID
 * @param {function} emitEvent - Vue emit Funktion
 */
export const eventRegister = (id= '', emitEvent = null) => {
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
    const register = (mode, target=null, type=null, handler=null, options = {}) => {

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

/**
 * Canvas Register Helper
 * @param {string} id - eindeutige Canvas ID
 * @param {function} emitEvent - Vue emit Funktion
 */
export const canvasRegister = (id = '', emitEvent = null) => {
    if (!id || typeof id !== 'string') {
        console.warn(`[canvasRegister] ⚠️ id ist nicht definiert oder kein String!`);
    }
    if (!emitEvent || typeof emitEvent !== 'function') {
        console.warn(`[canvasRegister] ⚠️ emitEvent ist nicht definiert oder keine Funktion!`);
    }

    /**
     * @param {string} mode
     * 'register' | 'update' | 'pause' | 'resume' | 'export' | 'destroy' | 'pause-all' | 'resume-all'
     * 'add-segment' | 'update-segment' | 'remove-segment' | 'fullscreen-segment' | 'add-layer'
     * | 'update-layer' | 'remove-layer'
     * @param {Object} config - optional, bei 'register'
     * @param {Object} payload - optional, bei 'update' oder Segment-Operation
     * @param {boolean} loop - optional, bei 'update'
     */
    const environment = (mode, config = {}, payload = {}, loop = false) => {
        switch (mode) {
            case 'register':

                if (!config?.canvas || !(config?.canvas instanceof HTMLCanvasElement)) {
                    console.warn(`[canvasRegister:register] Ungültiges Canvas Element:`, config.canvas);
                    return;
                }
                emitEvent('canvas:register', {
                    id: payload?.id || id,
                    config: config
                });
                break;

            case 'update':
                emitEvent('canvas:update', {
                    id: id,
                    payload: {
                        ...config,
                        ...payload
                    },
                    loop: loop
                });
                break;

            case 'select':
                emitEvent('canvas:select', {
                    x: payload?.x,
                    y: payload?.y,
                    id: payload?.id || id,
                });
                break;

            case 'export':
                emitEvent('canvas:export', {
                    id: payload?.id || id,
                });
                break;

            case 'pause':
                emitEvent('canvas:pause', {
                    id: payload?.id || id,
                });
                break;

            case 'resume':
                emitEvent('canvas:resume', {
                    id: payload?.id || id,
                });
                break;

            case 'remove':
                emitEvent('canvas:remove', payload?.id || id);
                break;

            case 'remove-all':
                emitEvent('remove-all');
                break;

            case 'pause-all':
                emitEvent('canvas:pause-all');
                break;

            case 'resume-all':
                emitEvent('canvas:resume-all');
                break;

            case 'add-segment':
                emitEvent('canvas:add-segment', { id, ...payload });
                break;

            case 'update-segment':
                emitEvent('canvas:update-segment', { id, ...payload });
                break;

            case 'remove-segment':
                emitEvent('canvas:remove-segment', { id, ...payload });
                break;

            case 'fullscreen-segment':
                emitEvent('canvas:fullscreen-segment', { id, ...payload });
                break;

            case 'add-layer':
                emitEvent('canvas:add-layer', { id, ...payload });
                break;

            case 'update-layer':
                emitEvent('canvas:update-layer', { id, ...payload });
                break;

            case 'remove-layer':
                emitEvent('canvas:remove-layer', { id, ...payload });
                break;

            default:
                console.warn(`[canvasRegister] Unbekannter Modus: ${mode}`);
        }
    };

    return { environment };
};