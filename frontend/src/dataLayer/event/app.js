export const appEvent = (route) => ({
    "app:update-guide": async (payload) => {
        route.localData.guides.value = payload;
    },
});
