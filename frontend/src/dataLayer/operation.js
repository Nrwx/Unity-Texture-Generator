import {computed} from "vue";
import {settings} from "@/dataLayer/parameter";

export const methodSettings = computed(() =>({
    0: {
        color_overlay: {
            active: true,
            type: "color",
            label: "Farbverschiebung",
        },
        color_overlay_mode: {
            active: true,
            type: "select",
            label: "Überlagerung",
            options: settings.colorOverlayModes
        },
        color_shift: {
            active: true,
            type: "slider",
            label: "Farbverschiebung",
            min: -100,
            max: 100,
            step: 1,
        },
        hue_variation: {
            active: true,
            type: "slider",
            label: "Farbtonvariation",
            min: -180,
            max: 180,
            step: 1,
        },
        invert_colors: {
            active: true,
            type: "checkbox",
            label: "Farben invertieren",
        },
    },
    1: {
        brightness: {
            active: true,
            type: "slider",
            label: "Helligkeit",
            min: 0,
            max: 200,
            step: 1,
        },
        contrast: {
            active: true,
            type: "slider",
            label: "Kontrast",
            min: 0,
            max: 100,
            step: 1,
        },
        sharpness: {
            active: true,
            type: "slider",
            label: "Schärfe",
            min: 0,
            max: 2,
            step: 0.1,
        },
        edge_detection: {
            active: true,
            type: "checkbox",
            label: "Kantenerkennung",
        },
    },
    2: {
        blur_mode: {
            active: true,
            type: "select",
            label: "Weichzeichnungs-Filter",
            options: settings.blurModes
        },
        blur_falloff_mode: {
            active: true,
            type: "select",
            label: "Weichzeichnungs-Verlauf",
            options: settings.blurFalloffModes
        },
        blur_type: {
            active: true,
            type: "select",
            label: "Weichzeichnungs-Typ",
            options: settings.blurTypes
        },
        blur: {
            active: true,
            type: "slider",
            label: "Weichzeichnen",
            min: 0,
            max: 10,
            step: 0.1,
        },
        blur_radius: {
            active: true,
            type: "slider",
            label: "Radius",
            min: 0,
            max: 200,
            step: 1,
        },
        noise_level: {
            active: true,
            type: "slider",
            label: "Rauschlevel",
            min: 0,
            max: 100,
            step: 1,
        },
    },
    3: {
        color_lookup: {
            active: true,
            type: "select",
            label: "Filmfarben-Filter",
            options: settings.colorLookupModes
        },
    },
    4: {
        cropTop: {
            active: true,
            type: "number",
            label: "Oben (px)",
            min: 0,
            max: 256,
            step: 1,
        },
        cropLeft: {
            active: true,
            type: "number",
            label: "Links (px)",
            min: 0,
            max: 256,
            step: 1,
        },
        cropBottom: {
            active: true,
            type: "number",
            label: "Unten (px)",
            min: 0,
            max: 256,
            step: 1,
        },
        cropRight: {
            active: true,
            type: "number",
            label: "Rechts (px)",
            min: 0,
            max: 256,
            step: 1,
        },
    },
    5: {},
    6: {
        simulate_mode: {
            active: true,
            type: "select",
            label: "Motion-Filter",
            options: settings.simulateModes
        },
        wave_type: {
            active: settings?.simulate_mode === 1,
            type: "select",
            label: "Wellen-Typ",
            options: settings.waveTypes
        },
        frame_count: {
            active: settings?.simulate_mode !== 0,
            type: "number",
            label: "Frames",
            min: 1,
            max: 30,
            step: 1,
        },
        amplitude: {
            active: settings?.simulate_mode === 1,
            type: "slider",
            label: "Amplitude",
            min: 0,
            max: 100,
            step: 1,
        },
        amplitude_multiplier: {
            active: settings?.simulate_mode === 1,
            type: "slider",
            label: "Amplitude-Verstärker",
            min: 0,
            max: 2,
            step: 0.1,
        },
        frequency: {
            active: settings?.simulate_mode === 1,
            type: "slider",
            label: "Frequenz",
            min: 0,
            max: 5,
            step: 0.1,
        },
        phase_shift: {
            active: settings?.simulate_mode === 1,
            type: "slider",
            label: "Phase",
            min: 0,
            max: 5,
            step: 0.1,
        },
    },
    7: {},
    8: {},
}));