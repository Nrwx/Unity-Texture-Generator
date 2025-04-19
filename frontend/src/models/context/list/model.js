import {nextTick, onMounted, ref} from "vue";

export function listModel(props, emit) {

    const hovered = ref(null)
    const menu = ref(null)
    const submenuStyle = ref({})
    const submenuCoords = ref({ x: 0, y: 0 })


    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const handleClick = (item) => {
        if (!item.children) emit('select', item)
    };


    onMounted(() => {
        nextTick(() => {
            const rect = menu.value?.getBoundingClientRect()
            if (!rect) return

            const overflowsRight = props.parentCoords.x + rect.width * 2 > window.innerWidth
            const overflowsBottom = props.parentCoords.y + rect.height > window.innerHeight

            submenuStyle.value = {
                left: overflowsRight ? `-${rect.width}px` : `${rect.width}px`,
                top: overflowsBottom ? `-${rect.height / 2}px` : '0px',
            }

            submenuCoords.value = {
                x: props.parentCoords.x + rect.width,
                y: props.parentCoords.y,
            }
        })
    })


    return {
        hovered,
        submenuStyle,
        submenuCoords,
        emitEvent,
        handleClick,
    };
}

export const listProps = {
    items: Array,
    parentCoords: Object,
};