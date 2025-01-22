import {v4 as uuidv4} from "uuid";
import UploadFile from "@/components/File/File";
import {localData} from "@/dataLayer/local";

export const taskbarItemLeft = [
    {
        id: uuidv4(),
        title: 'Datei hochladen',
        subtitle: 'Wählen Sie ein Bild aus...',
        icon: 'mdi-file',
        active: false,
        tooltip: 'Bild hochladen',
        component: {
            path: UploadFile,
            props: {
                file: localData.file.value,
            }
        },
    },
    {
        id: uuidv4(),
        icon: 'mdi-image',
        active: false,
        emit: 'toggle-image',
        tooltip: 'Open Image',
    },
];

export const taskbarItemRight = [
    {
        id: uuidv4(),
        icon: 'mdi-apps',
        active: false,
        emit: 'toggle-tool',
        tooltip: 'Open Image',
    },
    {
        id: uuidv4(),
        title: 'Ebenen',
        icon: 'mdi-layers-triple',
        active: false,
        tooltip: 'Ebenen',
        event: 'layer-state'
    },
];