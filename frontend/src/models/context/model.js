import { onBeforeUnmount, onMounted, ref } from "vue";

export function contextModel(props, emit) {
    const wrapper = ref(null);
    const visible = ref(false);
    const position = ref({ x: 0, y: 0 });
    const contextId = ref(null);

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    // 🧠 Hilfsfunktion: Mausposition relativ zu einem Container berechnen
    function getRelativeMousePosition(event, container) {
        const rect = container.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    const openMenu = (event) => {
        const target = event.target.closest(props.targetSelector);
        if (!target) return;

        const id = target.getAttribute("data-context-id");
        if (!id) return;

        event.preventDefault();

        const sameTarget = contextId.value === id;
        if (sameTarget && visible.value) {
            visible.value = false; // Toggle off if same is clicked again
            return;
        }

        // 🟡 Container holen via ref
        const container = document.querySelector('.canvas-container');
        if (!container) {
            console.warn('⚠️ Kein [ref="canvasContainer"] gefunden');
            return;
        }

        const { x: relX, y: relY } = getRelativeMousePosition(event, container);

        const menuWidth = 200; // später dynamisch machen?
        const menuHeight = 200;

        let posX = relX - menuWidth / 2;
        let posY = relY - menuHeight / 2;

        // ⛔ innerhalb des Containers halten
        const maxX = container.clientWidth - menuWidth;
        const maxY = container.clientHeight - menuHeight;

        posX = Math.max(0, Math.min(posX, maxX));
        posY = Math.max(0, Math.min(posY, maxY));

        position.value = { x: posX, y: posY };
        contextId.value = id;
        visible.value = true;

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

    onMounted(() => {
        document.addEventListener("contextmenu", openMenu);
    });

    onBeforeUnmount(() => {
        document.removeEventListener("contextmenu", openMenu);
        document.removeEventListener("click", handleClickOutside);
    });

    return {
        visible,
        position,
        handleClickOutside,
        openMenu,
        handleSelect,
        emitEvent,
        wrapper,
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
