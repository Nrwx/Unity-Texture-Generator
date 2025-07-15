import { ref } from 'vue';

export const notifyMessage = ref({
    id: '',             // Eindeutige Kennung, z.B. message_<timestamp>
    type: 0,            // 0 = Reminder, 1 = System
    order: 0,           // Z-Index/Reihenfolge
    name: '',           // Anzeigename
    message: '',        // Nachricht
    time: 0,            // Benachrichtigung-Zeit (00:00)
    mute: false,        // Benachrichtigung stumm schalten
    active: false,       // Aktiv-Zustand
    remind: false,      // Benachrichtigung wiederholen
    rTime: 0,           // Wiederholungsbenachrichtigungszeit (00:00)
    color: '#904ebd',   // Card fx color
    icon: 'mdi-bell',   // Icon
    event: ''           // Optionales Event
});