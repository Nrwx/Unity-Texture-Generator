import {ref} from "vue";
import {localData} from "@/dataLayer/local";

export function viewportModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const config = ref({
        fullscreen: true,
        title: 'Projekteinstellungen',
        emit: 'viewport-state'
    });

    const presets = ref([
        { mode: 0, title: 'Mobile (375x667)', width: 375, height: 667 },
        { mode: 1, title: 'Tablet (768x1024)', width: 768, height: 1024 },
        { mode: 2, title: 'Desktop (1920x1080)', width: 1920, height: 1080 },
        { mode: 3, title: 'Print (2480x3508)', width: 2480, height: 3508 },
        { mode: 4, title: 'Texture (1024x1024)', width: 1024, height: 1024 },
        { mode: 5, title: 'Banner Large (3000x600)', width: 3000, height: 600 },
        { mode: 6, title: 'Poster (2700x4000)', width: 2700, height: 4000 },
        { mode: 7, title: 'Square Large (2500x2500)', width: 2500, height: 2500 },
        { mode: 8, title: 'Icon (512x512)', width: 512, height: 512 }
    ]);

    const selectPreset = (preset) => {
        props.settings.mode = preset.mode;
        props.settings.title = preset.title;
        props.settings.width = preset.width;
        props.settings.height = preset.height;
        emitEvent('viewport-setup', props.settings);
    };

    return {
        loading: localData.loading.value,
        config,
        presets,
        emitEvent,
        selectPreset,
    };
}

export const viewportProps = {
    state: {
        type: Boolean,
        default: false
    },
    settings: {
        type: Object,
        required: true,
        default: () => ({})
    },
    theme: {
        type: String,
        default: false
    },
};