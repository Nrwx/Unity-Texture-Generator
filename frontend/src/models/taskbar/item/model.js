import {computed, ref} from "vue";

export function taskbarItemModel(props, emit) {

    const menu = ref(false);
    const ignoreClick = ref(false);


    const hasMenu = computed(() => Array.isArray(props.item.menuItems) && props.item.menuItems.length > 0);
    const isVerticalDial = computed(() => props.item?.orientation === 'vertical' || props.align === 'center');
    const speedDialLocation = computed(() => isVerticalDial.value ? 'top center' : 'right center');
    const speedDialTransition = computed(() => isVerticalDial.value ? 'slide-y-reverse-transition' : 'slide-x-transition');

    const emitEvent = () => {
        if (ignoreClick.value) {
            ignoreClick.value = false;
            return;
        }

        if (props.item?.menuOnly) {
            return;
        }

        emit("click");
    };

    const emitMenuEvent = (menuItem) => {
        ignoreClick.value = true;
        emit("update:menu-event", menuItem.id);
        setTimeout(() => {
            ignoreClick.value = false;
        }, 0);
    };

    const emitSubEvent = (event, payload) => {
        emit("update:sub-component-event",event, payload);
    };

    return {
        emitSubEvent,
        emitMenuEvent,
        hasMenu,
        menu,
        speedDialLocation,
        speedDialTransition,
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
