import {computed, ref} from "vue";

export function gradientEditorModel(props, emit) {

    const menu = ref(false);

    const handleMenuToggle = (val) => {
        emit(val ? 'open' : 'close')
    };

    const emitEvent = (payload) => {
        emit('update:modelValue', payload);
    };

    const previewGradient = computed(() => {
        const stops = props.modelValue.stops
            .sort((a, b) => a.offset - b.offset)
            .map(s => `${s.color}${Math.round(s.opacity * 255).toString(16).padStart(2, '0')} ${s.offset}%`)
            .join(', ');

        switch (props.modelValue.type) {
            case 'linear':
                return `linear-gradient(${props.modelValue.angle || 0}deg, ${stops})`;
            case 'radial':
                return `radial-gradient(circle, ${stops})`;
            case 'path':
                return `conic-gradient(from 0deg, ${stops})`;
            default:
                return `linear-gradient(0deg, ${stops})`;
        }
    });

    const previewLabel = computed(() => {
        return props.modelValue.stops.map(s => s.color).join(' → ');
    });

    const gradientTypes = [
        { title: 'Linear', value: 'linear' },
        { title: 'Radial', value: 'radial' },
        { title: 'Entlang Pfad', value: 'path' }
    ];

    const addStop = () => {
        props.modelValue.stops.push({
            color: '#FFFFFF',
            offset: 50,
            opacity: 1,
        });
    };

    const removeStop = (index) => {
        if (props.modelValue.stops.length > 2) {
            props.modelValue.stops.splice(index, 1);
        }
    };

    return {
        menu,
        previewGradient,
        previewLabel,
        handleMenuToggle,
        gradientTypes,
        addStop,
        removeStop,
        emitEvent,
    };
}

export const gradientEditorProps = {
    modelValue: {
        required: true,
    },
    label: String
};