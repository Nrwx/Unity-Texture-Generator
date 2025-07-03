export function selectVectorModel(props, emit) {

    const onResize = (direction, event) => {
        emit('resize', direction, event)
    }

    const onRotate = (direction, event) => {
        emit('rotate', direction, event)
    }

    return {
        onResize,
        onRotate
    };
}

export const selectVectorProps = {
    frameBox: {
        type: Object,
        required: true
    }
};