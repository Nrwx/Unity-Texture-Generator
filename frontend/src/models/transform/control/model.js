import {computed, onBeforeUnmount, onMounted} from "vue";
import {clamp} from "@/utils/tools";

export function controlModel(props, emit) {

    const size = 150;

    const toRad = deg => (deg * Math.PI) / 180;
    const scaleAngle = computed(() => (props.data.a - 1 || props.data.d - 1) * 90); // scale 1 = 0°

    const normalizedX = computed(() => {
        if (!props.data.width) return 0.5;
        const halfWidth = props.data.width / 2;
        const clamped = clamp(props.data.x, -halfWidth, halfWidth)
        return 0.5 + clamped / props.data.width;
    });

    const normalizedY = computed(() => {
        if (!props.data.height) return 0.5;
        const halfHeight = props.data.height / 2;
        const clamped = clamp(props.data.y, -halfHeight, halfHeight);
        return 0.5 + clamped / props.data.height;
    });

    const onClickX = (e) => {
        const target = e.currentTarget.querySelector('rect');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const relativeX = localX / rect.width;
        const offset = (relativeX - 0.5) * props.data.width;
        emit("update:position", { x: offset, y: props.data.y });
    };

    const onClickY = (e) => {
        const target = e.currentTarget.querySelector('rect');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const localY = e.clientY - rect.top;
        const relativeY = localY / rect.height;
        const offset = (relativeY - 0.5) * props.data.height;
        emit("update:position", { x: props.data.x, y: offset });
    };

    const onClickScale = (e) => {
        const svg = e.currentTarget.ownerSVGElement;
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;

        // Umwandlung in SVG-Koordinaten
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        const cx = 100;
        const cy = 60;

        const dx = svgP.x - cx;
        const dy = svgP.y - cy;

        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        if (angle < -90 || angle > 90) return; // Nur rechte Seite erlauben

        const normalized = (angle + 90) / 180; // -90 -> 0, +90 -> 1
        const scale = normalized * 2;

        emit("update:scale", scale);
    };

    const onClickRotation = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        emit("update:rotation", (angle + 90 + 360) % 360); // Normalize to 0–360
    };

    const onReset = () => {
        emit('reset');
    };


    onMounted( async () => {
    });

    onBeforeUnmount(() => {
    });

    return {
        size,
        toRad,
        normalizedX,
        normalizedY,
        scaleAngle,
        onReset,
        onClickX,
        onClickY,
        onClickScale,
        onClickRotation
    };
}


export const controlProps = {
    data: {
        type: Object,
        required: true,
    },
    theme: {
        type: String,
        required: true,
    }
};
