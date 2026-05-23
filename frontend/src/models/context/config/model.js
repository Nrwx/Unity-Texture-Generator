import { ref } from "vue";

const imageFilterChildren = [
    {
        active: true,
        label: 'Farbe & Licht',
        icon: 'mdi-palette',
        children: [
            {
                active: true,
                label: 'Helligkeit / Kontrast',
                icon: 'mdi-brightness-6',
                action: 'brightness-contrast',
                modifier: 'apply_brightness_contrast.py',
                disabled: false
            },
            {
                active: true,
                label: 'Farbverschiebung',
                icon: 'mdi-palette-swatch',
                action: 'apply:color-shift',
                modifier: 'apply_color_shift.py',
                disabled: false
            },
            {
                active: true,
                label: 'Hue Rotation',
                icon: 'mdi-rotate-3d-variant',
                action: 'apply:hue-rotation',
                modifier: 'apply_hue_rotation.py',
                disabled: false
            },
            {
                active: true,
                label: 'Farben invertieren',
                icon: 'mdi-invert-colors',
                action: 'apply:invert-colors',
                modifier: 'apply_invert_colors.py',
                disabled: false
            },
            {
                active: true,
                label: 'Color Lookup',
                icon: 'mdi-table-filter',
                action: 'apply:color-lookup',
                modifier: 'apply_color_lookup.py',
                disabled: false
            },
        ],
    },
    {
        active: true,
        label: 'Schärfe & Details',
        icon: 'mdi-image-filter-center-focus',
        children: [
            {
                active: true,
                label: 'Schärfen',
                icon: 'mdi-image-filter-center-focus-strong',
                action: 'sharpness',
                modifier: 'apply_sharpness.py',
                disabled: false
            },
            {
                active: true,
                label: 'Weichzeichnen',
                icon: 'mdi-blur',
                action: 'apply:blur',
                modifier: 'apply_blur.py',
                disabled: false
            },
            {
                active: true,
                label: 'Kantenerkennung',
                icon: 'mdi-vector-polyline',
                action: 'apply:edge-detection',
                modifier: 'apply_edge_detection.py',
                disabled: false
            },
            {
                active: true,
                label: 'Kanten glätten',
                icon: 'mdi-vector-radius',
                action: 'apply:edge-smooth',
                modifier: 'apply_edge_smooth.py',
                disabled: false
            },
            {
                active: true,
                label: 'Kanten verblenden',
                icon: 'mdi-blur-linear',
                action: 'apply:blend-edges',
                modifier: 'apply_blend_edges.py',
                disabled: false
            },
        ],
    },
    {
        active: true,
        label: 'Effekte',
        icon: 'mdi-creation',
        children: [
            {
                active: true,
                label: 'Rauschen',
                icon: 'mdi-grain',
                action: 'noise',
                modifier: 'apply_noise.py',
                disabled: false
            },
            {
                active: true,
                label: 'Pixelate',
                icon: 'mdi-grid',
                action: 'apply:pixelate',
                modifier: 'apply_pixelate.py',
                disabled: false
            },
            {
                active: true,
                label: 'Glas',
                icon: 'mdi-glass-fragile',
                action: 'apply:glass',
                modifier: 'apply_glass.py',
                disabled: false
            },
            {
                active: true,
                label: 'Tiefe / Höhe',
                icon: 'mdi-terrain',
                action: 'apply:deepness-highness',
                modifier: 'apply_deepness_highness.py',
                disabled: false
            },
        ],
    },
    {
        active: true,
        label: 'Verzerrung',
        icon: 'mdi-wave',
        children: [
            {
                active: true,
                label: 'Verzerren',
                icon: 'mdi-vector-curve',
                action: 'distort',
                modifier: 'apply_distort.py',
                disabled: false
            },
            {
                active: true,
                label: 'Welle',
                icon: 'mdi-waveform',
                action: 'apply:wave',
                modifier: 'apply_wave.py',
                disabled: false
            },
            {
                active: true,
                label: 'Zufälliger Versatz',
                icon: 'mdi-shuffle-variant',
                action: 'apply:random-shift',
                modifier: 'apply_random_shift.py',
                disabled: false
            },
        ],
    },
    {
        active: true,
        label: 'Freistellen & Maske',
        icon: 'mdi-vector-square',
        children: [
            {
                active: true,
                label: 'Maske anwenden',
                icon: 'mdi-image-filter-none',
                action: 'apply:mask',
                modifier: 'apply_mask.py',
                disabled: false
            },
            {
                active: true,
                label: 'Ausschneiden',
                icon: 'mdi-content-cut',
                action: 'apply:cut-out',
                modifier: 'apply_cut_out.py',
                disabled: false
            },
        ],
    },
];

export const contextConfig = {
    contextRefId: ref(''),

    contextData: ref([
        {
            active: true,
            label: 'Datei',
            icon: 'mdi-file',
            action: 'file',
            children: [
                {
                    active: true,
                    label: 'Export',
                    icon: 'mdi-file-export',
                    children: [
                        {
                            active: true,
                            label: 'Schnell-Export',
                            icon: 'mdi-file-plus',
                            action: 'export:quick',
                            disabled: false
                        },
                        {
                            active: true,
                            label: 'Hohe Qualität',
                            icon: 'mdi-file-star',
                            action: 'export:high-quality',
                            disabled: false
                        },
                    ],
                },
            ],
            disabled: false
        },

        {
            active: true,
            label: 'Bearbeiten',
            icon: 'mdi-pencil',
            action: 'edit',
            children: [
                {
                    active: true,
                    label: 'Zu Form umwandeln',
                    icon: 'mdi-vector-square',
                    action: 'text-path',
                    disabled: false
                },
                {
                    active: true,
                    label: 'Kopieren',
                    icon: 'mdi-content-copy',
                    action: 'copy',
                    disabled: false
                },
                {
                    active: true,
                    label: 'Einfügen',
                    icon: 'mdi-content-paste',
                    action: 'paste',
                    disabled: false
                },
                {
                    active: true,
                    label: 'Zuschneiden',
                    icon: 'mdi-crop',
                    action: 'crop-image',
                    disabled: false
                },
                {
                    active: true,
                    label: 'Größe ändern',
                    icon: 'mdi-resize',
                    action: 'apply:resize',
                    modifier: 'apply_resize.py',
                    disabled: false
                },
                {
                    active: false,
                    label: 'Abbrechen',
                    icon: 'mdi-cancel',
                    action: 'cancel',
                    disabled: false
                },
            ],
            disabled: false
        },

        {
            active: true,
            label: 'Filter',
            icon: 'mdi-image-filter-vintage',
            action: 'filter',
            children: imageFilterChildren,
            disabled: false
        },

        {
            active: true,
            label: 'Löschen',
            icon: 'mdi-delete',
            action: 'delete',
            disabled: false
        },
    ]),

    disabledData: ref({
        enabled: false,
        exclude: [],
        active: [],
        inactive: ['cancel']
    })
};