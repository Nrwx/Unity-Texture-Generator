export function taskbarItemModel(emit) {
    const emitEvent = () => {
        emit("click");
    };
    return {
        emitEvent,
    };
}

export const taskbarItemProps = {
    item: {
        type: Object,
        required: true,
        default: () => {},
    },
};