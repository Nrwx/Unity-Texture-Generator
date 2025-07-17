import {computed} from "vue";

export const angleProps = {
    angle: Number
};

export function angleModel(props, emit) {
    const radian = computed(() => ((props.angle - 90) * Math.PI) / 180);
    const style = {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
    const handleClick = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const finalAngle = (angle + 360) % 360;
        emit('update:angle', Math.round(finalAngle));
    };

    const emitAngle = (val) => {
        const normalized = (val + 360) % 360;
        emit('update:angle', Math.round(normalized));
    };

    return {
        radian,
        style,
        handleClick,
        emitAngle
    };
}
