import {ref} from "vue";

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
                    icon: 'mdi-file',
                    children: [
                        { active: true, label: 'Schnell-Export', icon: 'mdi-file-plus', action: 'new', disabled: false },
                        { active: true, label: 'Hohe Qualität', icon: 'mdi-folder-open', action: 'open', disabled: false },
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
                { active: true, label: 'Zu Form umwandeln', icon: 'mdi-format-text', action: 'text-path', disabled: false },
                { active: true, label: 'Kopieren', icon: 'mdi-content-copy', action: 'copy', disabled: false },
                { active: true, label: 'Einfügen', icon: 'mdi-content-paste', action: 'paste', disabled: false },
                { active: false, label: 'Abbrechen', icon: 'mdi-cancel', action: 'cancel', disabled: false},
            ],
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
    disabledData: ref({enabled: false, exclude: [], active: [], inactive: ['cancel']})
}