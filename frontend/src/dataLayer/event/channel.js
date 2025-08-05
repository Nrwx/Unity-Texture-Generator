export const channelEvent = (route) => ({
    "renderer:channel": async () => {
        const response = await route.api.renderer({mode: 'channel'})
        if (response) {
            route.localData.channel.value = response
            console.log(response)
        }
    },
});