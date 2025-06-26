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

    const config = reactive({
        size:           props.settings.size,
        spacing:        props.settings.spacing,
        opacity:        props.settings.opacity,
        flow:           props.settings.flow,
        jitter:         props.settings.jitter,
        angle:          props.settings.angle,
        randomize:      props.settings.randomize,
        sizeDynamics:   props.settings.sizeDynamics,
        opacityDynamics:props.settings.opacityDynamics,
        angleDynamics:  props.settings.angleDynamics,
        rotationRandom: props.settings.rotationRandom,
        scatter:        props.settings.scatter,
        flipX:          props.settings.flipX,
        flipY:          props.settings.flipY,
        pressureFade:   props.settings.pressureFade,
        blendMode:      props.settings.blendMode
    })

    const activeTab = ref('settings');
    const blendModes = ['normal','multiply','screen','overlay','darken','lighten','color-dodge'];

    const emitEvent = (event, payload) => {
        emit("update:menu-event", event, payload);
        console.log(config)
        console.log(props.settings)
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
        brushItems,
        config,
        sliderColor,
        tabs,
        activeTab,
        blendModes,
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
