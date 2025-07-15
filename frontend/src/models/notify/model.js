import {computed} from "vue";

export function notifyModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const visibleMessages = computed(() =>
        props.data.filter(msg => msg.active && !msg.mute).sort((a,b) => (a.order ?? 0) - (b.order ?? 0))
    );

    const positionStyle = index => ({
        position: 'fixed',
        bottom: `${10 + index * 160}px`,
        right: '20px',
        width: '320px',
        zIndex: 9999
    });

    const remove = (id) => {
        const msg = props.data.find(m => m.id === id);
        if (msg) {
            msg.active = false;
            emitEvent('app:close-message', msg)
        }
    };

    const mute = (reminder) => {
        const idx = props.data.findIndex(m => m.id === reminder.id);
        if (idx === -1) return;

        const target = props.data[idx];
        target.mute = !target.mute;

        if (!target.mute) {
            emitEvent("app:set-message",target);
        } else {
            emitEvent("app:clear-message-timer",target.id);
        }

        emitEvent("app:update-messages", props.data);
    };

    return { visibleMessages, mute, remove, positionStyle };
}



export const notifyProps = {
    state: {
        type: Boolean,
        required: true
    },
    data: {
        type: Array,
        required: true
    },
    theme: {
        type: String,
        required: true
    },
    wait: {
        type: Boolean,
        required: true
    }
};
