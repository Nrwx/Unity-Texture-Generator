import { ref, reactive, onMounted, onUnmounted } from "vue";
import { appData, localData } from "@/dataLayer/local";
import { notifyMessage } from "@/models/notify/config/model";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import duration from 'dayjs/plugin/duration';
dayjs.extend(duration);

export function notificationModel(props, emit) {
    const messages = localData.messages;
    const activeTab = ref("reminder");
    const menu = ref(false);
    const timerId = ref(null);

    const systemLogs = ref([
        { name: "Cache gelöscht", message: "Lokaler Cache wurde erfolgreich entfernt." },
        { name: "Verbindung wiederhergestellt", message: "System ist wieder online." },
    ]);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const config = reactive({
        method: 11,
        name: notifyMessage.value?.title || '',
        message: notifyMessage.value?.message || '',
        time: notifyMessage.value?.time || 1, // in Minuten
        remind: notifyMessage.value?.remind || false,
        rTime: notifyMessage.value?.rTime || 0, // in Minuten
        color: notifyMessage.value?.color || '#1976d2',
        icon: notifyMessage.value?.icon || 'mdi-bell',
        event: notifyMessage.value?.event || '',
    });

    const operation = {
        11: {
            name: { type: 'text', label: 'Titel', event: 'notify:apply-name', active: true },
            message: { type: 'text', label: 'Nachricht', event: 'notify:apply-message', active: true },
            time: { type: 'number', label: 'Ausführen in (Minuten)', min: 0, max: 60, step: 1, event: 'notify:apply-time', active: true },
            remind: { type: 'switch', label: 'Erinnerung aktivieren', event: 'notify:apply-remind', active: true },
            rTime: { type: 'number', label: 'Erinnern in (Minuten)', min: 0, max: 120, step: 1, event: 'notify:apply-rTime', active: true },
            color: { type: 'color', label: 'Farbe', event: 'notify:apply-color', active: true },
            icon: { type: 'icon', label: 'Icon (z.B. mdi-bell)', event: 'notify:apply-icon', active: true },
            event: { type: 'text', label: 'Event-Key', event: 'notify:apply-event', active: true },
        }
    };

    const saveAndClose = () => {
        const now = dayjs();

        const data = localData.messages.value;

        // Zeit in Millisekunden berechnen
        const startAt = now.add(config.time, 'minute');
        const nextRemindAt = now.add(config.rTime, 'minute');

        const timeMs = startAt.diff(now, 'millisecond');
        const rTimeMs = nextRemindAt.diff(now, 'millisecond');

        const reminder = {
            id: uuidv4(),
            type: 0,
            order: messages.value.length,
            name: config.name,
            message: config.message,
            mute: false,
            active: false,
            remind: config.remind,
            color: config.color,
            icon: config.icon,
            event: config.event,
            complete: false,
            initialShown: false,
            time: timeMs,
            rTime: rTimeMs
        };

        data.push(reminder);
        emitEvent("app:set-message", reminder);
        emitEvent("app:update-messages", data);

        menu.value = false;
        emitEvent("notify:reset", { name: true, message: true, remind: true });

        config.name = '';
        config.message = '';
        config.remind = false;
    };

    const toggleMute = (reminder) => {
        const idx = messages.value.findIndex(m => m.id === reminder.id);
        if (idx === -1) return;

        const target = messages.value[idx];
        target.mute = !target.mute;
        reminder.mute = !reminder.mute;

        if (!target.mute) {
            emitEvent("app:set-message", target);
        } else {
            emitEvent("app:clear-message-timer", target.id);
        }

        emitEvent("app:update-messages", messages.value);
    };

    const deleteMsg = (reminder) => {
        const idx = messages.value.findIndex(m => m.id === reminder.id);
        if (idx === -1) return;

        // Sofort aus der lokalen Liste entfernen
        messages.value.splice(idx, 1);

        // Event zum Löschen der Nachricht inkl. Timer
        emitEvent("app:delete-message", { id: reminder.id });

        // Liste nach extern synchronisieren
        emitEvent("app:update-messages", messages.value);
    };

    const formatDuration = (seconds) => {
        const duration = dayjs.duration(seconds, 'seconds');
        const minutes = String(duration.minutes()).padStart(2, '0');
        const secs = String(duration.seconds()).padStart(2, '0');
        return `${minutes}:${secs}`;
    };

    const startTimer = () => {
        if (timerId.value) return;

        timerId.value = setInterval(() => {
            const now = dayjs();

            localData.messages.value.forEach(msg => {
                if (msg.complete || msg.mute) {
                    if(msg.remind) {
                        msg.nextRemindAt = now.add(msg.rTime, 'millisecond')
                    } else {
                        msg.startAt = now.add(msg.time, 'millisecond')
                    }
                    msg.timeLeft = 0
                    msg.rTimeLeft = 0
                    msg.active = false;
                    emitEvent("app:clear-message-timer", msg.id);
                    emitEvent("app:set-message", msg)
                    if(!localData.messages.value.length) stopTimer();
                    return
                }

                // Zeit bis zur ersten Anzeige
                if (msg?.startAt && !msg.mute && !msg.complete) {
                    const diffSec = msg.startAt.diff(now, 'seconds');
                    msg.timeLeft = Math.max(0, diffSec);
                }

                // Zeit bis zur nächsten Erinnerung
                if (msg?.nextRemindAt && !msg.mute && !msg.complete) {
                    const diffSec = msg.nextRemindAt.diff(now, 'seconds');
                    msg.rTimeLeft = Math.max(0, diffSec);
                }
            });
        }, 1000); // Alle 1 Sekunde statt 10 Sekunden → genauere Anzeige
    };

    const stopTimer = () => {
        if (timerId.value) {
            clearInterval(timerId.value);
            timerId.value = null;
        }
    };

    const toggleMenu = (state) => {
        menu.value = !state;
        emitEvent("rule:allow-form", !state);

        if (!state) {
            startTimer();
        } else {
            stopTimer();
        }
    };

    const init = () => {
        const time = dayjs();

        const data = localData.messages.value;

        // Zeit in Millisekunden berechnen
        const startAt = time.add(15, 'minute');
        const nextRemindAt = time.add(30, 'minute');

        const timeMs = startAt.diff(time, 'millisecond');
        const rTimeMs = nextRemindAt.diff(time, 'millisecond');

        const reminder = {
            id: uuidv4(),
            type: 0,
            order: messages.value.length,
            name: 'Speichern',
            message: 'Bitte regelmäßig speichern.',
            mute: false,
            active: false,
            remind: true,
            color: '#699843',
            icon: 'mdi-content-save',
            event: '',
            complete: false,
            initialShown: false,
            time: timeMs,
            rTime: rTimeMs
        };

        if(!data.find(x => x.message === reminder.message)) {
            data.push(reminder);
            emitEvent("app:set-message", reminder);
            emitEvent("app:update-messages", data);
        }

    };

    onMounted(() => {
        startTimer();
        init()
    });

    onUnmounted(() => {
        stopTimer();
    });

    return {
        theme: appData.theme.value,
        messages: messages.value,
        menu,
        toggleMenu,
        config,
        operation,
        systemLogs,
        saveAndClose,
        emitEvent,
        toggleMute,
        activeTab,
        formatDuration,
        deleteMsg
    };
}

export const notificationProps = {};
