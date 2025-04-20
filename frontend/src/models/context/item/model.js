export const contextData = [
    {
        label: 'Datei',
        icon: 'mdi-file',
        children: [
            { label: 'Neu', icon: 'mdi-file-plus', action: 'new' },
            { label: 'Öffnen', icon: 'mdi-folder-open', action: 'open' },
            { label: 'Speichern', icon: 'mdi-content-save', action: 'save' },
            {
                label: 'Export',
                icon: 'mdi-file',
                children: [
                    { label: 'Schnell-Export', icon: 'mdi-file-plus', action: 'new' },
                    { label: 'Hohe Qualität', icon: 'mdi-folder-open', action: 'open' }
                ],
            },
        ],
    },
    {
        label: 'Bearbeiten',
        icon: 'mdi-pencil',
        children: [
            { label: 'Kopieren', icon: 'mdi-content-copy', action: 'copy' },
            { label: 'Einfügen', icon: 'mdi-content-paste', action: 'paste' },
        ],
    },
    {
        label: 'Löschen',
        icon: 'mdi-delete',
        action: 'delete',
    },
]