export const contextMenuEvent = (route) => ({
    "context-menu-select": async ({ action, contextId }) => {
        if(action === 'delete') {
            const response = await route.emit('delete-layer', [contextId])
            if(response) {
                console.log('Aktion:', action, 'auf Datei:', contextId)
            }
        }
        else if(action === 'copy') {
            route.emit('context-menu-copy', true)
            console.log('Element kopiert', contextId)
        }
        else if(action === 'paste') {
            const response = await route.emit('paste-layer', { id: contextId})
            if(response) {
                route.emit('context-menu-copy', false)
                console.log('Aktion:', action, 'auf Datei:', contextId)
            }
        }
    },
    "context-menu-copy": (payload) => {
        route.contextStates.copy.value = payload
        console.log(payload, '@EVENT: context-menu-copy')
    },
});