export function brushMenuItemModel(props, emit) {
    const sliderColor = '#007AFFFF';

    const emitEvent = (key) => {
        emit('update:brush-menu-item', {key, data: props.modelValue[key]});
    };

    const formattedValue = (item) => {
        const val = props.modelValue[item.key];

        if (typeof val !== 'number') return val;

        if (item.unit === '%') {
            const multiplier = 1 / item.step;
            return `${(val * multiplier).toFixed(0)}%`;
        }

        // Bestimme Nachkommastellen aus step
        let decimals = 0;
        if (item.step && item.step < 1) {
            decimals = item.step.toString().split('.')[1]?.length || 0;
        }

        return `${val.toFixed(decimals)}${item.unit || ''}`;
    };

    return { sliderColor, formattedValue, emitEvent };
}

export const brushMenuItemProps = {
    items: { type: Object, required: true },
    modelValue: null
};
