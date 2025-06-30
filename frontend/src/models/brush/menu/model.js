import {computed, reactive, ref} from "vue";

export function brushMenuModel(props, emit) {
    const presetName = ref('');
    const tabs = [
        { id: 'settings', icon: 'mdi-cog' },
        { id: 'save', icon: 'mdi-content-save' },
        { id: 'upload', icon: 'mdi-upload' }
    ];

    const sliderColor = '#007AFFFF'

    const brushItems = computed(() => {
        if (!props.brushes) return [];
        return props.brushes.flatMap(brush =>
            (brush.children || []).map(child => ({
                categoryName: brush.name,
                categoryId: brush.id,
                childId: child.id,
                childName: child.name,
                imageUrl: '/brush' + child.path
            }))
        );
    });

    const settingsItems = [
        { key: 'size', label: 'Größe', type: 'slider', min: 1, max: 500, step: 1, unit: 'px' },
        { key: 'opacity', label: 'Deckkraft', type: 'slider', min: 0, max: 1, step: 0.01, unit: '%' },
        { key: 'pressure', label: 'Druck', type: 'slider', min: 0.01, max: 2, step: 0.01, unit: '%' },
        { key: 'jitter', label: 'Jitter', type: 'slider', min: 0, max: 100, step: 1, unit: '%' },
        { key: 'scatter', label: 'Scatter', type: 'slider', min: 0, max: 100, step: 1, unit: 'px' },
        { key: 'angle', label: 'Orientierung', type: 'slider', min: 0, max: 360, step: 1, unit: '°' },
        { key: 'fadeDynamics', label: 'Fade Dynamics', type: 'toggle' },
        { key: 'sizeDynamics', label: 'Size Dynamics', type: 'toggle' },
        { key: 'angleDynamics', label: 'Angle Dynamics', type: 'toggle' },
        { key: 'rotationRandom', label: 'Zufallsrotation', type: 'toggle' },
        { key: 'flipX', label: 'Flip X', type: 'toggle' },
        { key: 'flipY', label: 'Flip Y', type: 'toggle' },
        { key: 'blendMode', label: 'Blend Mode', type: 'select', options: [
                'normal','multiply','screen','overlay','darken','lighten','color-dodge',
                'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay', 'darken',
                'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
                'exclusion', 'hue', 'saturation', 'color', 'luminosity'
            ] }
    ];


    const config = reactive({
        size:           props.settings.size,
        opacity:        props.settings.opacity,
        jitter:         props.settings.jitter,
        angle:          props.settings.angle,
        pressure:       props.settings.pressure,
        sizeDynamics:   props.settings.sizeDynamics,
        fadeDynamics:   props.settings.fadeDynamics,
        angleDynamics:  props.settings.angleDynamics,
        rotationRandom: props.settings.rotationRandom,
        scatter:        props.settings.scatter,
        flipX:          props.settings.flipX,
        flipY:          props.settings.flipY,
        blendMode:      props.settings.blendMode
    })

    const activeTab = ref('settings');

    const emitEvent = (event, payload) => {
        emit("update:menu-event", event, payload);
    };

    const angleRad = computed(() => (props.settings.angle - 90) * (Math.PI / 180));

    const menuStyle = computed(() => ({
        top: `${props.menuPos.y}px`,
        left: `${props.menuPos.x}px`,
        width: '380px'
    }));

    const savePreset = () => {
        emitEvent('save-preset', {name: presetName.value, data: props.settings});
        presetName.value = '';
    };

    const uploadBrush = (e) => {
        const file = e.target.files[0];
        if (file) emitEvent('upload-brush', file);
    };

    return {
        settingsItems,
        brushItems,
        config,
        sliderColor,
        tabs,
        activeTab,
        presetName,
        menuStyle,
        angleRad,
        savePreset,
        uploadBrush,
        emitEvent
    };
}

export const brushMenuProps = {
    visible: { type: Boolean, required: true },
    menuPos: { type: Object, required: true },
    settings: { type: Object, required: true },
    brushes: { type: Array, required: true }
};
