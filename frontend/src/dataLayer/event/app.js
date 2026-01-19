import dayjs from "dayjs";
import {screenshot} from "@/utils/screenshot";
import {uuid} from "@/utils/uuid";
import {useTheme} from 'vuetify';
import {nextTick} from "vue";

export const appEvent = (route) => ({
    "app:boot-state": (payload) => {
        if (typeof payload === "boolean") {
            route.windowStates.boot.value = payload;
        }
    },
    "app:clear-cache": async (payload) => {
        if (payload === route.localData.viewport.value.id) {
            const response = await route.api.clearCache(payload);
            if (response) {
                const task = route.localData.tasks.value.find(x => x.module === 'storage');
                if (task) {
                    const res = await route.api.runTask({id: task.id});
                    if (res) {
                        await route.emit('fetch-setting');
                        console.log('Cache clear erfolgreich');
                    }
                }
            }
        }
    },
    "app:refresh-cache": async (payload) => {
        if (payload === route.localData.viewport.value.id) {
            const task = route.localData.tasks.value.find(x => x.module === 'storage');
            if (task) {
                const res = await route.api.runTask({id: task.id});
                if (res) {
                    await route.emit('fetch-setting');
                    console.log('Cache Refresh erfolgreich');
                }
            } else {
                console.log('Task not found')
            }
        }
    },
    "app:apply-theme": async (payload) => {
        const theme = await useTheme();
        if (theme) {
            theme.global.name.value = payload;
            await nextTick();
            const mode = theme.global.name.value;
            console.log(`Current Theme: ${mode}`)
        }
    },
    "app:update-guide": async (payload) => {
        route.localData.guides.value = payload;
    },
    "app:update-queue": async (payload) => {
        route.localData.queue.value = payload;
    },
    "app:queue-status": async (payload) => {
        const response = await route.api.queueStatus();
        if (response?.history && response.history.length > 0) {
            clearTimeout(route.localData.queuePending.value);
            clearTimeout(route.localData.queueCompleteTimer.value);
            clearTimeout(route.localData.queuePollTimer.value);
            route.localData.queuePollTimer.value = null;
            route.windowStates.queue.value = payload.state;
            const history = response.history;
            if (!route.localData.maxHistoryLength) {
                route.localData.maxHistoryLength = { value: 0 };
            }
            if (history.length > route.localData.maxHistoryLength.value) {
                route.localData.maxHistoryLength.value = history.length;
            }
            if (route.localData.historyIndex.value >= history.length - 1) {
                route.localData.historyIndex.value = 0;
            } else {
                route.localData.historyIndex.value++;
            }
            const index = route.localData.historyIndex.value;
            const step = 3;
            const currentEntry = history[index];
            const processingInfo = currentEntry.processing?.info || response.processing?.info;
            const maxHistory = route.localData.maxHistoryLength.value || 1;
            const rawPercent = Math.round((index / maxHistory) * 100);
            const newPercent = rawPercent > route.localData.lastPercent.value
                ? Math.min(route.localData.lastPercent.value + step, rawPercent)
                : route.localData.lastPercent.value;
            route.localData.lastPercent.value = newPercent;
            const data = {
                title: processingInfo.method && processingInfo.path
                    ? `${processingInfo.method} ${processingInfo.path}`
                    : processingInfo.endpoint,
                subTitle: processingInfo.content_type || processingInfo.endpoint,
                percent: newPercent,
                indeterminate: false,
                complete: newPercent >= 100,
                path: processingInfo.path,
                method: processingInfo.method
            };
            await route.emit('app:update-queue', data);
            route.localData.queuePollTimer.value = setTimeout(() => {
                route.emit('app:queue-status', { state: true });
            }, 100);
        } else {
            if (response?.pending === true) {
                route.localData.queuePending.value = setTimeout(async () => {
                    const pending = {
                        title: 'Warten...',
                        subTitle: 'Auf Anfrage...',
                        percent: 100,
                        indeterminate: true,
                        complete: false,
                        method: '/PENDING',
                        path: '/pending',
                        intermediate: true,
                        wait: true
                    };
                    await route.emit('app:update-queue', pending);
                }, 150);
            } else {
                if (route.localData.maxHistoryLength) {
                    route.localData.maxHistoryLength.value = 0;
                }
                route.localData.queue.value.complete = true;
                route.localData.lastPercent.value = 0;
                route.localData.queueCompleteTimer.value = setTimeout(async () => {
                    const finish = {
                        title: 'Fertig',
                        subTitle: 'alle cron-jobs erledigt.',
                        percent: 100,
                        indeterminate: false,
                        method: 'FINISH',
                        path: '/finish',
                        complete: true,
                    };
                    await route.emit('app:update-queue', finish);
                }, 150);
                clearTimeout(route.localData.queuePollTimer.value);
                route.localData.queuePollTimer.value = null;
                route.localData.queuePollTimer.value = setTimeout(async () => {
                    const reset = {
                        title: '',
                        subTitle: '',
                        percent: 0,
                        time: '',
                        indeterminate: false,
                        complete: false
                    };
                    await route.emit('app:update-queue', reset);
                    route.windowStates.queue.value = payload.state;
                    route.localData.queueCompleteTimer.value = null;
                    route.localData.queuePending.value = null;
                }, 200);
            }
        }
    },
    "app:update-messages": async (payload) => {
        route.localData.messages.value = payload;

        route.localData.messages.value.forEach(newMsg => {

            const existingIndex = route.localData.messages.value.findIndex(m => m.id === newMsg.id);

            if (existingIndex !== -1) {
                // Vorhandene Nachricht aktualisieren
                route.localData.messages.value[existingIndex] = newMsg;
            } else {
                // Neue Nachricht hinzufügen
                route.localData.messages.value.push(newMsg);
            }
        });
    },
    "app:clear-message-timer": async (payload) => {
        const timers = route.localData.messageTimers.value.get(payload);
        if (timers) {
            if (timers?.timeoutId) clearTimeout(timers.timeoutId);
            if (timers?.autoCloseId) clearTimeout(timers.autoCloseId);
            if (timers?.remindTimeoutId) clearTimeout(timers.remindTimeoutId);
            route.localData.messageTimers.value.delete(payload);
        }
    },
    "app:set-message": async (payload) => {
        // Timer löschen
        route.emit('app:clear-message-timer', payload.id);

        const current = route.localData.messages.value.find(m => m.id === payload.id);
        if (!current) return;

        // Wenn bereits abgeschlossen, nichts mehr tun
        if (current.complete) return;

        // Wenn stummgeschaltet → sofort schließen + nichts weiter
        if (current.mute) {
            current.active = false;
            return;
        }

        const timers = {};

        const showAndAutoClose = () => {
            const msg = route.localData.messages.value.find(m => m.id === payload.id);
            if (!msg || msg.mute) return;

            if (payload.remind && !msg.initialShown) {
                msg.initialShown = true;
            }

            msg.active = true;

            const autoCloseId = setTimeout(() => {
                const again = route.localData.messages.value.find(m => m.id === payload.id);
                if (again) again.active = false;

                // Reminder erneut anzeigen (wenn aktiv)
                if (payload.remind && payload.rTime > 0 && !payload.mute) {
                    const now = dayjs();
                    if (payload.initialShown && payload.remind && payload.rTime) {
                        payload.nextRemindAt = now.add(payload.rTime, 'millisecond');
                    }
                    const remindTimeoutId = setTimeout(() => {
                        showAndAutoClose();
                    }, payload.rTime);

                    const t = route.localData.messageTimers.value.get(payload.id) || {};
                    t.remindTimeoutId = remindTimeoutId;
                    route.localData.messageTimers.value.set(payload.id, t);
                } else {
                    // Bei einmaliger Nachricht als abgeschlossen markieren
                    if (!payload.remind) {
                        if (again) again.complete = true;
                    }
                }

            }, 7000);

            const t = route.localData.messageTimers.value.get(payload.id) || {};
            t.autoCloseId = autoCloseId;
            route.localData.messageTimers.value.set(payload.id, t);
        };

        // Reminder-Logik
        if (payload.remind === true) {
            // Erste Anzeige nach .time
            const now = dayjs();
            if (!payload.initialShown && payload.time) {
                payload.startAt = now.add(payload.time, 'millisecond');
            }

            if (payload.time > 0) {
                timers.timeoutId = setTimeout(() => {
                    showAndAutoClose();
                }, payload.time);
            } else {
                showAndAutoClose();
            }

            // Einmalige Nachricht → nach .time (oder sofort), dann schließen + complete setzen
        } else if (payload.remind === false) {
            if (payload.time > 0) {
                const now = dayjs();
                if (payload.time) {
                    payload.startAt = now.add(payload.time, 'millisecond');
                }

                timers.timeoutId = setTimeout(() => {
                    const msg = route.localData.messages.value.find(m => m.id === payload.id);
                    if (!msg || msg.mute) return;

                    msg.active = true;

                    const autoCloseId = setTimeout(() => {
                        msg.active = false;
                        msg.complete = true; // nur hier wird complete gesetzt
                    }, 7000);

                    const t = route.localData.messageTimers.value.get(payload.id) || {};
                    t.autoCloseId = autoCloseId;
                    route.localData.messageTimers.value.set(payload.id, t);

                }, payload.time);
            } else {
                const msg = route.localData.messages.value.find(m => m.id === payload.id);
                if (!msg || msg.mute) return;

                msg.active = true;

                const autoCloseId = setTimeout(() => {
                    msg.active = false;
                    msg.complete = true;
                }, 7000);

                const t = route.localData.messageTimers.value.get(payload.id) || {};
                t.autoCloseId = autoCloseId;
                route.localData.messageTimers.value.set(payload.id, t);
            }
        }

        route.localData.messageTimers.value.set(payload.id, timers);
    },
    "app:close-message": async (payload) => {
        const current = route.localData.messages.value.find(m => m.id === payload.id);
        if (current) current.active = false;
    },
    "app:delete-message": async (payload) => {
        const id = payload.id;
        await route.emit('app:clear-message-timer', id);
        const index = route.localData.messages.value.findIndex(m => m.id === id);
        if (index !== -1) {
            route.localData.messages.value.splice(index, 1);
        }
    },
    "app:screenshot": async (payload) => {
        route.screenshotData.url.value = null;
        let el;
        let name;
        const now = dayjs();
        const title = `Screenshot-${payload.mode}-${now.format('YYYY-MM-DD_HH-mm-ss')}`;

        if(payload.title) {
            name = payload.title
        } else if (payload.prefix && payload.title === '') {
            name = payload.prefix + '-' + title
        } else if (payload.title !== '' && payload.prefix) {
            name = payload.prefix + '-' + payload.title
        } else {
            name = title
        }

        const data = {
            id: uuid(),
            url: '',
            date: now.format('DD.MM.YYYY'),
            time: now.format('HH:mm:ss'),
            mode: payload.mode,
            title: name
        }

        if (payload.mode === 'full') {
            el = document.getElementById(route.tempData.appId.value);
        } else {
            el = document.getElementById(route.tempData.canvasId.value);
        }
        try {
            if(payload.crop) {
                route.screenshotData.url.value = await screenshot(el, payload.config, payload.crop);
            }
            else {
                route.screenshotData.url.value = await screenshot(el, payload.config);
            }

            if( route.screenshotData.url.value) {
                data.url = route.screenshotData.url.value;
                route.screenshotData.history.value.push(data)
                console.log(route.screenshotData.history.value, 'SCREENSHOTS')
            }

        } catch (err) {
            console.error('Screenshot fehlgeschlagen:', err);
        }
    },
    "app:apply-screenshot-prefix": async (payload) => {
        route.screenshotData.prefix.value = payload
    },
    "app:apply-screenshot-title": async (payload) => {
        route.screenshotData.title.value = payload
    },
    "app:apply-screenshot-mode": async (payload) => {
        route.screenshotData.mode.value = payload.mode
    },
    "app:apply-screenshot-quality": async (payload) => {
        route.screenshotData.quality.value = payload.mode
    },
});
