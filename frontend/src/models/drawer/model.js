import { useDisplay } from "vuetify";

export function drawerModel(props, emit) {
    const { mobile } = useDisplay();

    const closeDrawer = () => {
        emit("update:taskbar-menu", false);
    };

    const handleComponentEvent = (event, payload) => {
        if (props.item && props.item.component) {
            emit("component-event", event, payload);
        }
    };

    return {
        mobile,
        closeDrawer,
        handleComponentEvent,
    };
}

export const drawerProps = {
    // Ob der Drawer ein Taskbar-Menü ist
    item: {
        type: Object,
        required: true,
        default: () => {},
    },
    taskbarMenu: {
        type: Boolean,
        required: true,
        default: false,
    },
    time: {
        type: Number,
        required: false,
        default: 400,
    },
    width: {
        type: Number,
        required: false,
        default: 400,
    },
    // Position des Drawers
    align: {
        type: String,
        required: true,
        default: "left",
    },
    // Titel des Drawers
    title: {
        type: String,
        required: false,
    },
    // Untertitel des Drawers
    subtitle: {
        type: String,
        required: false,
    },
    // Symbole für den Schließen-Button
    icon: {
        type: Array,
        required: false,
        default: () => ["mdi-menu", "mdi-close"],
    },
    // Optionale Button-Symbole
    button: {
        type: Array,
        required: false,
        default: () => ["mdi-menu", "mdi-close"],
    },
};
