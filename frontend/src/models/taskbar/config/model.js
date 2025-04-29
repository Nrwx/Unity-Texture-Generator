import {v4 as uuidv4} from "uuid";
import Upload from "@/view/page/Upload/Upload.vue";
import History from "@/components/History/History";
import Tools from "@/view/page/Tools/Tools";

export const taskbarItemLeft = [
    {
        position: 'top',
        id: uuidv4(),
        title: 'Einstellungen',
        subtitle: 'Legen Sie zusätzliche Einstellungen fest...',
        icon: 'mdi-cog',
        active: false,
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
        tooltip: 'Bild hochladen',
        component: {
            path: Upload,
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
        tooltip: 'Bild Optionen',
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Auswahl',
        icon: 'mdi-cursor-default-outline',
        active: false,
        tooltip: 'Auswahl',
        event: 'cursor-state'
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Frei-Maskierung',
        icon: 'mdi-select',
        active: false,
        tooltip: 'Frei-Maskierung',
        event: 'select-state'
    },
    {
        position: 'center',
        id: uuidv4(),
        title: 'Textebene',
        icon: 'mdi-format-text',
        active: false,
        tooltip: 'Textebene',
        event: 'text-state'
    },
];

export const taskbarItemRight = [
    {
        position: 'top',
        id: uuidv4(),
        icon: 'mdi-apps',
        active: false,
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
        tooltip: 'Ebenen',
        event: 'layer-state'
    },
    {
        position: 'top',
        id: uuidv4(),
        title: 'Verlauf',
        icon: 'mdi-history',
        active: false,
        tooltip: 'Verlauf',
        component: {
            path: History,
            props: {}
        },
    },
];