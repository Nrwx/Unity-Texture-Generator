export const appEvent = (route) => ({
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
            if (route.localData.selectedLayer.value.length) {
                await route.emit('layer:select', []);
                await route.emit('reset:grid-states', false);
                await route.emit('reset:canvas-states', false);
            }
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
    }
});
