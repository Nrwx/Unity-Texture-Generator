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
        selectedRgb: localData.selectedRgb.value,
        selectedRgba: localData.selectedRgba.value
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
            selectedRgb: {
                active: true,
                type: "select",
                label: "Pre RGB Konfiguration",
                title: 'RGB: ' + localData.rgbMode.value[localData.selectedRgb.value]?.title || 'RGB-Auto-Optimierungs Preset',
                subtitle: localData.rgbMode.value[localData.selectedRgb.value]?.subtitle || 'Legen Sie Ihr Individuelles RGB Preset fest',
                prependIcon: localData.rgbMode.value[localData.selectedRgb.value]?.icon || 'mdi-image',
                options: localData.rgbMode.value,
                event: 'apply-rgb-mode'
            },
            selectedRgba: {
                active: true,
                type: "select",
                label: "Pre RGBA Konfiguration",
                title: 'Alpha: ' + localData.rgbaMode.value[localData.selectedRgba.value]?.title || 'RGBA-Auto-Optimierungs Preset',
                subtitle: localData.rgbaMode.value[localData.selectedRgba.value]?.subtitle || 'Legen Sie Ihr Individuelles RGBA Preset fest',
                prependIcon: localData.rgbaMode.value[localData.selectedRgba.value]?.icon || 'mdi-alpha-a-box',
                options: localData.rgbaMode.value,
                event: 'apply-rgba-mode'
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