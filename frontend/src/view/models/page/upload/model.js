import {computed, reactive} from "vue";
import {localData} from "@/dataLayer/local";

export function uploadModel(emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const config = reactive({
        method: 9,
        selectedMaps: localData.selectedMaps.value,
        selectedTargetResize: localData.selectedTargetResize.value,
        selectedTargetResizeOption: localData.selectedTargetResizeOption.value,
        selectedUpscaleMethod: localData.selectedUpscaleMethod.value,
        selectedMapAutoOptimize: localData.selectedMapAutoOptimize.value
    })
    const methods = computed(() =>({
        9: {
            selectedMaps: {
                active: true,
                type: "select",
                label: "Zusätzliche Maps",
                title: 'Map-Generierung',
                subtitle: 'Erstellen Sie zusätzlich zu ihrer Upload-Referenz, eine Auswahl an Subtexturen.',
                prependIcon: 'mdi-image-plus-outline',
                options: localData.maps.value,
                multi: true,
                event: 'apply-maps'
            },
            selectedTargetResize: {
                active: true,
                type: "select",
                label: "Ziel-Skalierung",
                title: 'Resizing/Upscale',
                subtitle: 'Bild-Auflösungsoperationen für eine schnelle saubere Skalierung.',
                prependIcon: 'mdi-image-size-select-large',
                options: localData.targetResize.value.filter(option =>
                    option.w <= localData.viewport.value.width &&
                    option.h <= localData.viewport.value.height
                ),
                event: 'apply-target-size'
            },
            selectedTargetResizeOption: {
                active: localData.selectedTargetResize.value > 0,
                type: "select",
                label: "Ziel-Skalierungsoption",
                title: 'Power-of-Two Anpassung',
                subtitle: `Bild zuschneiden oder auffüllen auf Größe: ${localData.targetResize.value[localData.selectedTargetResize.value].title}.`,
                prependIcon: localData.selectedTargetResizeOption.value === 0 ? 'mdi-crop' : 'mdi-crop-free',
                options: localData.targetResizeOption.value,
                event: 'apply-target-size-option'
            },
            selectedUpscaleMethod: {
                active: localData.selectedTargetResize.value > 0,
                type: "select",
                label: "Ziel-Skalierungsmethode",
                title: 'Resize-Bildprozess',
                subtitle: `Bestimme die Qualität der Vergrößerung (z.B ${localData.upscaleMethods.value[localData.selectedUpscaleMethod.value].title}).`,
                prependIcon: localData.selectedUpscaleMethod.value === 2 ? 'mdi-robot-outline' : 'mdi-overscan',
                options: localData.upscaleMethods.value,
                event: 'apply-target-size-method'
            },
            selectedMapAutoOptimize: {
                active: true,
                type: "select",
                label: "Bildbereinigung/Farbraum-Anpassungen",
                title: 'Bild-Auto-Optimierung',
                subtitle: 'Automatische Bildbereinigung und Farbraum-Anpassungen vor dem Upload.',
                prependIcon: 'mdi-creation',
                options: localData.mapAutoOptimize.value,
                event: 'apply-map-auto-optimize'
            },
        },
    }))
    return {
        emitEvent,
        config,
        methods,
    };
}

export const uploadProps = {
};