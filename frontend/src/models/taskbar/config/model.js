import {v4 as uuidv4} from "uuid";
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
export const taskbarItemLeft = [
    {
        position: 'top',
        id: uuidv4(),
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
        id: uuidv4(),
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
        id: uuidv4(),
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
        id: uuidv4(),
        title: 'Bild Optionen',
        subtitle: 'Legen Sie zusätzliche Einstellungen fest...',
        icon: 'mdi-image-multiple',
        active: false,
        hidden: false,
        tooltip: 'Bild Optionen',
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Auswahl',
        icon: 'mdi-cursor-default-outline',
        active: false,
        hidden: false,
        tooltip: 'Auswahl',
        event: 'cursor-state'
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Frei-Maskierung',
        icon: 'mdi-select',
        active: false,
        hidden: false,
        tooltip: 'Frei-Maskierung',
        event: 'select-state',
        menuItems: [
            {
                id: uuidv4(),
                title: 'Rechteckmaske',
                icon: 'mdi-select',
                active: false,
                hidden: false,
                event: 'select:mask-shape',
                val: 'rectangle'
            },
            {
                id: uuidv4(),
                title: 'Kreismaske',
                icon: 'mdi-selection-ellipse',
                active: false,
                hidden: false,
                event: 'select:mask-shape',
                val: 'ellipse'
            }
        ]
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Pinsel-Werkzeug',
        icon: 'mdi-brush',
        active: false,
        hidden: false,
        tooltip: 'Brush Tool',
        event: 'brush-state'
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Textebene',
        icon: 'mdi-format-text',
        active: false,
        hidden: false,
        tooltip: 'Textebene',
        event: 'text-state'
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Füllwerkzeug',
        icon: 'mdi-format-color-fill',
        active: false,
        hidden: false,
        tooltip: 'Füllwerkzeug',
        event: 'fill-color-state'
    },
    {
        position: 'center',
        id: uuidv4(),
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
        id: uuidv4(),
        title: 'Zeichenwerkzeug',
        icon: 'mdi-fountain-pen-tip',
        active: false,
        hidden: false,
        tooltip: 'Zeichenwerkzeug',
        event: 'pen-state',
        menuItems: [
            {
                id: uuidv4(),
                title: 'Bezier',
                icon: 'mdi-vector-curve',
                active: false,
                hidden: false,
                event: 'pen:bezier-mode',
                val: 'bezier'
            },
            {
                id: uuidv4(),
                title: 'Linear',
                icon: 'mdi-vector-line',
                active: false,
                hidden: false,
                event: 'pen:bezier-mode',
                val: 'linear'
            }
        ]
    },
];

export const taskbarItemCenter = [
    {
        position: 'left',
        id: uuidv4(),
        icon: 'mdi-drawing',
        tooltip: 'Form-Einstellungen',
        active: false,
        hidden: computed(() => {
            return !windowStates.pathClose.value;
        }),
        component: {
            path: Path,
            props: {}
        },
    },
    {
        position: 'left',
        id: uuidv4(),
        icon: 'mdi-animation-play',
        tooltip: 'Animation',
        active: false,
        hidden: false,
    },
    {
        position: 'center',
        id: uuidv4(),
        icon: 'mdi-view-dashboard',
        tooltip: 'Übersicht',
        active: false,
        hidden: false,
    },
    {
        position: 'right',
        id: uuidv4(),
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
        id: uuidv4(),
        icon: 'mdi-account',
        tooltip: 'Benutzer',
        active: false,
        hidden: false,
    },
    {
        position: 'right',
        id: uuidv4(),
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
        id: uuidv4(),
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
        id: uuidv4(),
        title: 'Ebenen',
        icon: 'mdi-layers-triple',
        active: false,
        hidden: false,
        tooltip: 'Ebenen',
        event: 'layer-state'
    },
    {
        position: 'top',
        id: uuidv4(),
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
        id: uuidv4(),
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
];