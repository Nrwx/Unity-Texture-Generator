import {onBeforeUnmount, onMounted, ref} from "vue";

export function contextModel(props, emit) {
    const wrapper = ref(null)
    const visible = ref(false)
    const position = ref({ x: 0, y: 0 })
    const contextId = ref(null)
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const openMenu = (event)  => {
        const target = event.target.closest(props.targetSelector)
        if (!target) return

        event.preventDefault()
        contextId.value = target.getAttribute('data-context-id')

        position.value = {
            x: Math.min(event.clientX, window.innerWidth - 200),
            y: Math.min(event.clientY, window.innerHeight - 200),
        }

        visible.value = true
        document.addEventListener('click', handleClickOutside)
    }

    const handleClickOutside = (e)  => {
        if (!wrapper.value?.contains(e.target)) {
            visible.value = false
            document.removeEventListener('click', handleClickOutside)
        }
    }

    const handleSelect = (item)  => {
        emit('select', { ...item, contextId: contextId.value })
        visible.value = false
    }

    onMounted(() => document.addEventListener('contextmenu', openMenu))
    onBeforeUnmount(() => {
        document.removeEventListener('contextmenu', openMenu)
        document.removeEventListener('click', handleClickOutside)
    })

    return {
        visible,
        position,
        handleClickOutside,
        openMenu,
        handleSelect,
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
        default: '[data-context-id]',
    },
};