export const channelEvent = (route) => ({
    "update-channel": async () => {
        const response = await route.api.updateChannel()
        if (response) {
            route.localData.channel.value = response
            console.log(response)
        }
    },
});