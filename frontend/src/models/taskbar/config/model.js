import {v4 as uuidv4} from "uuid";
import Upload from "@/view/page/Upload/Upload.vue";
import History from "@/components/History/History";
import Tools from "@/view/page/Tools/Tools";

export const taskbarItemLeft = [
    {
        id: uuidv4(),
        title: 'Einstellungen',
        subtitle: 'Legen Sie zusätzliche Einstellungen fest...',
        icon: 'mdi-cog',
        active: false,
        tooltip: 'Einstellungen',
        event: 'setting-state',
    },
    {
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
        id: uuidv4(),
        title: 'Bild Optionen',
        subtitle: 'Legen Sie zusätzliche Einstellungen fest...',
        icon: 'mdi-image-multiple',
        active: false,
        tooltip: 'Bild Optionen',
    },
];

export const taskbarItemRight = [
    {
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
        id: uuidv4(),
        title: 'Ebenen',
        icon: 'mdi-layers-triple',
        active: false,
        tooltip: 'Ebenen',
        event: 'layer-state'
    },
    {
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