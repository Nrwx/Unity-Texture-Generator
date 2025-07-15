import {computed, ref} from "vue";

export function taskbarItemModel(props, emit) {

    const menu = ref(false);


    const hasMenu = computed(() => Array.isArray(props.item.menuItems) && props.item.menuItems.length > 0);

    const emitEvent = () => {
        emit("click");
    };

    const emitMenuEvent = (menuItem) => {
        // Deaktiviere alle menuItems
        props.item.menuItems.forEach(i => i.active = false);

        // Aktiviere das ausgewählte
        menuItem.active = true;

        emit("update:menu-event", menuItem.id);
    };

    return {
        emitMenuEvent,
        hasMenu,
        menu,
        emitEvent,
    };
}

export const taskbarItemProps = {
    item: {
        type: Object,
        required: true,
        default: () => {},
    },
    align: {
        type: String
    },
    centerMenu: {
        type: Boolean
    }
};