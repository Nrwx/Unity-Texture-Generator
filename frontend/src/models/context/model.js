import {nextTick, onBeforeUnmount, onMounted, ref} from "vue";
import {v4 as uuidv4} from "uuid";
import {eventRegister} from "@/dataLayer/event";

export function contextModel(props, emit) {
    const wrapper = ref(null);
    const position = ref({ x: 0, y: 0 });
    const contextId = ref(null);

    const uniqueId = uuidv4()

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const { register } = eventRegister("listener:layer-context", emitEvent);

    const getEventPosition = (event) => {
        return {
            x: event.touches ? event.touches[0].clientX : event.clientX,
            y: event.touches ? event.touches[0].clientY : event.clientY,
        };
    };

    const openMenu = async (event) => {
        const target = event.target.closest(props.targetSelector);
        if (!target) return;

        const id = target.getAttribute("data-context-id");
        if (!id) return;

        event.preventDefault();

        const sameTarget = contextId.value === id;
        if (sameTarget && props.state) {
            emitEvent('context-menu-state', false)
            contextId.value = null;
            return;
        }


        const closeEvent = new CustomEvent("close-all-context-menus", {
            detail: { except: uniqueId },
        });
        document.dispatchEvent(closeEvent);

        const { x: mouseX, y: mouseY } = getEventPosition(event);

        // Menü sichtbar machen, damit es im DOM gerendert wird
        contextId.value = id;
        updateDisabledStates(props.disabled)
        emitEvent('context-menu-state', true);

        await nextTick(); // Warten bis das Menü im DOM gerendert ist

        const menu = wrapper.value;
        if (!menu) return;

        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;

        let posX = mouseX - menuWidth / 2;
        let posY = mouseY - menuHeight / 2;

        const maxX = window.innerWidth - menuWidth;
        const maxY = window.innerHeight - menuHeight;

        posX = Math.max(0, Math.min(posX, maxX));
        posY = Math.max(0, Math.min(posY, maxY));

        position.value = { x: Math.round(posX), y: Math.round(posY) };

        register('add', document, 'click', handleClickOutside);
    };

    const handleClickOutside = (e) => {
        if (!wrapper.value?.contains(e.target)) {
            emitEvent('context-menu-state', false);
            contextId.value = null;
            register('remove', document, 'click', handleClickOutside);
        }
    };

    const handleSelect = (item) => {
        emitEvent("context-menu-select", { ...item, contextId: contextId.value });
        emitEvent('context-menu-state', false);
    };

    const handleCloseAll = (e) => {
        if (e.detail?.except !== uniqueId) {
            emitEvent('context-menu-state', false);
            contextId.value = null;
            register('remove', document, 'click', handleClickOutside);
        }
    };

    const updateDisabledStates = ({ enabled, exclude = [], active = [], inactive = []}) => {
        const walk = (items) => {
            items.forEach(item => {
                if (item.children) {
                    walk(item.children);
                }
                if (item.action) {
                    item.disabled = enabled && !exclude.includes(item.action);

                    if (active.includes(item.action)) {
                        item.active = true;
                    } else if (inactive.includes(item.action)) {
                        item.active = false;
                    }
                } else {
                    item.disabled = false;
                }
            });
        };

        walk(props.data);
        const update = {
            enabled: enabled,
            exclude: exclude,
            active: active,
            inactive: inactive,
            data: props.data
        }
        emitEvent("update-context-menu", update);
    };

    onMounted(() => {
        register('add', document, 'contextmenu', openMenu);
        register('add', document, 'close-all-context-menus', handleCloseAll);
        register('pause')
    });

    onBeforeUnmount(() => {
        register('removeAll');
    });

    return {
        position,
        wrapper,
        handleSelect,
        openMenu,
        handleClickOutside,
        emitEvent,
    };
}

export const contextProps = {
    state: {
        type: Boolean,
        default: false,
    },
    copy: {
        type: Boolean,
        default: false,
    },
    refId: {
        type: String,
        default: '',
    },

    data: {
        type: Array,
        required: true,
        default: () => [],
    },
    disabled: {
        type: Object,
        required: true,
    },
    targetSelector: {
        type: String,
        default: "[data-context-id]",
    },
};
