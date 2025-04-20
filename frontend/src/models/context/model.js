import {nextTick, onBeforeUnmount, onMounted, ref} from "vue";

export function contextModel(props, emit) {
    const wrapper = ref(null);
    const visible = ref(false);
    const position = ref({ x: 0, y: 0 });
    const contextId = ref(null);

    const uniqueId = `context-${Math.random().toString(36).slice(2)}`;

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

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
        if (sameTarget && visible.value) {
            visible.value = false;
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
        visible.value = true;

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

        position.value = { x: posX, y: posY };

        document.addEventListener("click", handleClickOutside);
    };

    const handleClickOutside = (e) => {
        if (!wrapper.value?.contains(e.target)) {
            visible.value = false;
            contextId.value = null;
            document.removeEventListener("click", handleClickOutside);
        }
    };

    const handleSelect = (item) => {
        emit("select", { ...item, contextId: contextId.value });
        visible.value = false;
    };

    const handleCloseAll = (e) => {
        if (e.detail?.except !== uniqueId) {
            visible.value = false;
            contextId.value = null;
            document.removeEventListener("click", handleClickOutside);
        }
    };

    onMounted(() => {
        document.addEventListener("contextmenu", openMenu);
        document.addEventListener("close-all-context-menus", handleCloseAll);
    });

    onBeforeUnmount(() => {
        document.removeEventListener("contextmenu", openMenu);
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("close-all-context-menus", handleCloseAll);
    });

    return {
        visible,
        position,
        wrapper,
        handleSelect,
        openMenu,
        handleClickOutside,
        emitEvent,
    };
}

export const contextProps = {
    data: {
        type: Array,
        required: true,
        default: () => [],
    },
    targetSelector: {
        type: String,
        default: "[data-context-id]",
    },
};
