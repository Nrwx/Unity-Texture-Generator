import Upload from "@/view/page/Upload/Upload.vue";
import History from "@/view/page/History/History";
import Tools from "@/view/page/Tools/Tools";
import Typographic from "@/view/page/Typographic/Typographic.vue";
import Color from "@/components/Color/Color.vue";
import Ai from "@/view/page/Ai/Ai";
import Notification from "@/view/page/Notification/Notification";
import {localData} from "@/dataLayer/local";
import {computed} from "vue";
import {windowStates} from "@/dataLayer/state";
import Path from "@/view/page/Path/Path";
import Screenshot from "@/view/page/Screenshot/Screenshot";
import Overview from "@/view/page/Overview/Overview";
import Export from "@/view/page/Export/Export";
import Form from "@/view/page/Form/Form";
import Animation from "@/view/page/Animation/Animation";
import {uuid} from "@/utils/uuid";
import {number} from "@/utils/math";

export const taskbarItemLeft = [
    {
        position: 'top',
        id: uuid(),
        title: 'Einstellungen',
        subtitle: 'Legen Sie zusätzliche Einstellungen fest...',
        icon: 'mdi-cog',
        active: false,
        hidden: false,
        tooltip: 'Einstellungen',
        event: 'setting-state'
    },
    {
        position: 'top',
        id: uuid(),
        title: 'Datei hochladen',
        subtitle: 'Wählen Sie ein Bild aus...',
        icon: 'mdi-file',
        active: false,
        hidden: false,
        tooltip: 'Bild hochladen',
        component: {
            path: Upload,
            props: {}
        },
    },
    {
        position: 'top',
        id: uuid(),
        title: 'AI Bild generieren',
        subtitle: 'Generiere ein Bild mit OpenAI DALL·E',
        icon: 'mdi-robot',
        active: false,
        hidden: false,
        tooltip: 'Erzeuge ein KI-generiertes Bild',
        component: {
            path: Ai,
            props: {}
        },
    },
    {
        position: 'top',
        id: uuid(),
        title: 'Bild Optionen',
        subtitle: 'Legen Sie zusätzliche Einstellungen fest...',
        icon: 'mdi-image-multiple',
        active: false,
        hidden: false,
        tooltip: 'Bild Optionen',
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Auswahl',
        icon: 'mdi-cursor-default-outline',
        active: false,
        hidden: false,
        tooltip: 'Auswahl',
        event: 'cursor-state'
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Frei-Maskierung',
        icon: 'mdi-select',
        active: false,
        hidden: false,
        tooltip: 'Frei-Maskierung',
        event: 'select-state',
        menuItems: [
            {
                id: uuid(),
                title: 'Rechteckmaske',
                icon: 'mdi-select',
                active: false,
                hidden: false,
                event: 'select:mask-shape',
                val: 'rectangle'
            },
            {
                id: uuid(),
                title: 'Kreismaske',
                icon: 'mdi-selection-ellipse',
                active: false,
                hidden: false,
                event: 'select:mask-shape',
                val: 'ellipse'
            },
            {
                id: uuid(),
                title: 'Masken-Pinsel',
                icon: 'mdi-brush',
                active: false,
                hidden: false,
                event: 'select:mask-tool',
                val: 'maskBrush'
            }
        ]
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Radierer-Werkzeug',
        icon: 'mdi-eraser',
        active: false,
        hidden: false,
        tooltip: 'Eraser Tool',
        event: 'eraser-state'
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Pinsel-Werkzeug',
        icon: 'mdi-brush',
        active: false,
        hidden: false,
        tooltip: 'Brush Tool',
        event: 'brush-state'
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Textebene',
        icon: 'mdi-format-text',
        active: false,
        hidden: false,
        tooltip: 'Textebene',
        event: 'text-state'
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Füllwerkzeug',
        icon: 'mdi-format-color-fill',
        active: false,
        hidden: false,
        tooltip: 'Füllwerkzeug',
        event: 'fill-color-state'
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Farbauswahl',
        active: false,
        hidden: false,
        tooltip: 'Farbauswahl',
        event: 'color-slot-state',
        subComponent: {
            path: Color,
            props: {}
        },
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Zeichenwerkzeug',
        icon: 'mdi-fountain-pen-tip',
        active: false,
        hidden: false,
        tooltip: 'Zeichenwerkzeug',
        event: 'pen-state',
        menuItems: [
            {
                id: uuid(),
                title: 'Bezier',
                icon: 'mdi-vector-curve',
                active: false,
                hidden: false,
                event: 'pen:bezier-mode',
                val: 'bezier'
            },
            {
                id: uuid(),
                title: 'Linear',
                icon: 'mdi-vector-line',
                active: false,
                hidden: false,
                event: 'pen:bezier-mode',
                val: 'linear'
            }
        ]
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Formauswahl',
        active: false,
        hidden: false,
        tooltip: 'Form auswählen',
        event: 'select-form-state',
        subComponent: {
            path: Form,
            props: {}
        },
    },
];

export const taskbarItemCenter = [
    {
        position: 'left',
        id: uuid(),
        icon: 'mdi-drawing',
        tooltip: 'Form-Einstellungen',
        active: false,
        hidden: computed(() => {
            return !windowStates.pathLock.value;
        }),
        component: {
            path: Path,
            props: {}
        },
    },
    {
        position: 'left',
        id: uuid(),
        icon: 'mdi-animation-play',
        tooltip: 'Animation',
        active: false,
        hidden: false,
        badge: {
            content: computed(() => {
                return localData.selectedLayer.value.reduce((sum, layer) => {
                    return sum + (layer.keyframes?.length || 0);
                }, 0);
            }),
            dot: true
        },
        component: {
            path: Animation,
            props: {},
            maxWidth: '100%'
        }
    },
    {
        position: 'left',
        id: uuid(),
        title: 'Material Editor',
        subtitle: 'Erstellen und bearbeiten Sie Canvas-Cube-Materialien...',
        icon: 'mdi-cube-scan',
        active: false,
        hidden: false,
        tooltip: 'Material Editor',
        event: 'material-editor:state'
    },
    {
        position: 'left',
        id: uuid(),
        title: 'Animator',
        subtitle: 'World Orbit für 3D Material-Layer...',
        icon: 'mdi-orbit',
        tooltip: 'Animator',
        active: false,
        hidden: false,
        badge: {
            content: computed(() => {
                return localData.selectedLayer.value.filter(layer => number(layer?.type) === 5).length;
            }),
            dot: true
        },
        event: 'orbit:state',
    },
    {
        position: 'center',
        id: uuid(),
        icon: 'mdi-view-dashboard',
        tooltip: 'Übersicht',
        active: false,
        hidden: false,
        component: {
            path: Overview,
            props: {}
        },
    },
    {
        position: 'right',
        id: uuid(),
        icon: 'mdi-bell',
        tooltip: 'Benachrichtigungen',
        active: false,
        hidden: false,
        badge: {
            content: computed(() => {
                return localData.messages.value.length;
            }),
            dot: true
        },
        component: {
            path: Notification,
            props: {}
        },
    },
    {
        position: 'right',
        id: uuid(),
        icon: 'mdi-account',
        tooltip: 'Benutzer',
        active: false,
        hidden: false,
    },
    {
        position: 'right',
        id: uuid(),
        icon: 'mdi-camera',
        tooltip: 'Screenshot',
        active: false,
        hidden: false,
        component: {
            path: Screenshot,
            props: {}
        }
    }
];

export const taskbarItemRight = [
    {
        position: 'top',
        id: uuid(),
        icon: 'mdi-apps',
        active: false,
        hidden: false,
        tooltip: 'Werkzeuge',
        component: {
            path: Tools,
            props: {}
        },
    },
    {
        position: 'top',
        id: uuid(),
        title: 'Ebenen',
        icon: 'mdi-layers-triple',
        active: false,
        hidden: false,
        tooltip: 'Ebenen',
        event: 'layer-state'
    },
    {
        position: 'top',
        id: uuid(),
        title: 'Typographie',
        icon: 'mdi-format-font',
        active: false,
        hidden: false,
        tooltip: 'Typographie',
        component: {
            path: Typographic,
            props: {}
        },
    },
    {
        position: 'top',
        id: uuid(),
        title: 'Verlauf',
        icon: 'mdi-history',
        active: false,
        hidden: false,
        tooltip: 'Verlauf',
        component: {
            path: History,
            props: {}
        },
    },
    {
        position: 'center',
        id: uuid(),
        title: 'Export',
        icon: 'mdi-file-export',
        active: false,
        hidden: false,
        tooltip: 'Projekt exportieren',
        event: 'export-state',
        component: {
            path: Export,
            props: {}
        },
    }
];
