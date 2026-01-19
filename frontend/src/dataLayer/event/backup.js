export const globalBackupEvent = (route) => ({
    "backup:create-global": async (payload) => {
        console.log(payload, 'BACKUP')
        const response = await route.api.createBackup(payload.id, payload.state, payload.title);
        if (response) {
            await route.emit("backup:fetch-list");
        }
    },

    "backup:jump-to": async ({ id, index }) => {
        const response = await route.api.jumpToBackup(id, index);
        if (response) {
            await route.emit("fetch-layer");
            await route.emit("backup:fetch-list");
        }
    },

    "backup:fetch-list": async () => {
        const response = await route.api.fetchBackupList();

        if(response) {
            route.backupStates.global.value = response
        }
    },

    "backup:action": async (payload) => {
        route.backupStates.action.value = payload;
    },
});
