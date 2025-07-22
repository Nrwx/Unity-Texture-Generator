import {reactive, ref} from "vue";
import {screenshotData} from "@/dataLayer/local";

export function screenshotModel(props, emit) {

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const selectionBounds = ref(null);


    const isLoading = ref(false);

    const modeOpts = [
        {
            title: 'Vollbild',
            mode: 'full',
            icon: 'mdi-fullscreen',
            event: 'app:apply-screenshot-mode'
        },
        {
            title: 'Zeichenfläche',
            mode: 'draw',
            icon: 'mdi-artboard',
            event: 'app:apply-screenshot-mode'
        },
        {
            title: 'Freihand',
            mode: 'free',
            icon: 'mdi-crop',
            event: 'app:apply-screenshot-mode'
        },
    ];

    const qualityOpts = [
        {
            mode: 'low',
            title: 'Niedrig',
            icon: 'mdi-quality-low',
            config: { backgroundColor: '#ffffff', scale: 1, useCORS: true },
            event: 'app:apply-screenshot-quality'
        },
        {
            mode: 'medium',
            title: 'Normal',
            icon: 'mdi-quality-medium',
            config: { backgroundColor: '#ffffff', scale: 2, useCORS: true },
            event: 'app:apply-screenshot-quality'
        },
        {
            mode: 'high',
            title: 'Hoch',
            icon: 'mdi-quality-high',
            config: { backgroundColor: '#ffffff', scale: 3, useCORS: true },
            event: 'app:apply-screenshot-quality'
        }
    ];

    const config = reactive({
        method: 21,
        title: screenshotData.title.value,
        mode:  screenshotData.mode.value,
        quality: screenshotData.quality.value,
        prefix: screenshotData.prefix.value
    });

    const operation = {
        21: {
            mode: { type: 'button-bar', label: 'Auswahl-Modus', hint: 'Wählen Sie einen Screenshot-Modus', active: true, options: modeOpts },
            quality: { type: 'button-bar', label: 'Qualität', hint: 'Wählen Sie eine Screenshot-Auflösung', active: true, options: qualityOpts, class: 'mb-4' },
            prefix: { type: 'text', label: 'Prefix', event: 'app:apply-screenshot-prefix', icon: 'mdi-regex', active: true },
            title: { type: 'text', label: 'Titel', event: 'app:apply-screenshot-title',  icon: 'mdi-rename', active: true },
        }
    };

    const updateSelection = (bounds) => {
        selectionBounds.value = bounds;
        console.log(selectionBounds.value)
    };

    const screenshot = async () => {
        isLoading.value = true;
        try {
            await emitEvent('app:screenshot', config);
        } catch (err) {
            console.error('Screenshot fehlgeschlagen:', err);
        } finally {
            isLoading.value = false;
        }
    };

    return {
        isLoading,
        screenshots: screenshotData.history.value,
        config,
        operation,
        screenshot,
        updateSelection,
        emitEvent
    };
}

export const screenshotProps = {};
