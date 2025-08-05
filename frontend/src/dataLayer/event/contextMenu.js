export const contextMenuEvent = (route) => ({
    "context-menu-select": async ({ action, contextId }) => {

        const reset = {
            enabled: false,
            exclude: [],
            active: [''],
            inactive: ['cancel']
        }

        if(action === 'delete') {
            const response = await route.emit('delete-layer', [contextId])
            if(response) {
                console.log('Aktion:', action, 'auf Datei:', contextId)
            }
        }
        else if(action === 'text-path') {
            await route.emit('renderer:text-to-path', {mode: 'text-path', id: contextId})
        }
        else if(action === 'copy') {
            route.emit('context-menu-copy', {state: true, id: contextId})
            console.log('Element kopiert', contextId)
        }
        else if(action === 'cancel') {
            route.contextConfig.contextRefId.value = '';
            route.emit('update-context-menu', reset)
            console.log('Element zurückgesetzt', contextId)
        }
        else if(action === 'paste') {
            const id = contextId === route.contextConfig.contextRefId.value ? contextId : route.contextConfig.contextRefId.value;
            const response = await route.api.pasteLayer({ id: id})
            if(response) {
                route.contextConfig.contextRefId.value = '';
                route.emit('context-menu-copy', false)
                route.emit('update-context-menu', reset)
                route.emit('fetch-layer')
                console.log('Aktion:', action, ' erfolgreich')
            } else {
                route.contextConfig.contextRefId.value = '';
                route.emit('context-menu-copy', false)
                route.emit('update-context-menu', reset)
                console.log('Aktion:', action, ' fehlgeschlagen')
            }
        }
    },
    "context-menu-copy": (payload) => {
        route.contextStates.copy.value = payload.state
        route.contextConfig.contextRefId.value = payload.id
        const data = {
            enabled: true,
            exclude: ['edit', 'copy', 'paste', 'cancel'],
            active: ['cancel'],
            inactive: ['']
        }
        route.emit('update-context-menu', data)
    },
    "update-context-menu": (payload) => {
        if(payload.data && payload.data !== route.contextConfig.contextData.value) {
            route.contextConfig.contextData.value = payload.data
            route.contextConfig.disabledData.value.exclude = payload.exclude;
            route.contextConfig.disabledData.value.enabled = payload.enabled;
            route.contextConfig.disabledData.value.active = payload.active;
            route.contextConfig.disabledData.value.inactive = payload.inactive;
            console.log('ContextData Updated')
        } else if(!payload.data){
            route.contextConfig.disabledData.value.exclude = payload.exclude;
            route.contextConfig.disabledData.value.enabled = payload.enabled;
            route.contextConfig.disabledData.value.active = payload.active;
            route.contextConfig.disabledData.value.inactive = payload.inactive;
            console.log('ContextData Settings Updated')
        } else {
            console.log('Keine Context Änderungen')
        }
    },
});