export const timelineEvent = (route) => ({
    "timeline:id": async (payload) => {
        route.timelineData.value.id = payload;
        console.log(route.timelineData.value.id, 'TIMELINE ID SETUP' )
    },
    "timeline:time": async (payload) => {
        route.timelineData.value.time = payload;
    },
    "timeline:width": async (payload) => {
        route.timelineData.value.width = payload;
        console.log(route.timelineData.value.width, 'TIMELINE WIDTH' )
    },
    "timeline:totalTime": async (payload) => {
        route.timelineData.value.totalTime = payload;
        console.log(route.timelineData.totalTime)
    },
    "timeline:zoom": async (payload) => {
        route.timelineData.value.zoomLevel.current = payload;
    },
    "timeline:padding": async (payload) => {
        route.timelineData.value.padding = payload;
    },
    "timeline:keyframes": async (payload) => {
        route.timelineData.value.keyframes = payload;
    },
    "timeline:select-keyframes": async (payload) => {
        route.timelineData.value.selectedKeyframes = payload;
        console.log(route.timelineData.value.selectedKeyframes, 'TIMELINE SELECT KEYFRAMES')
    },
    "timeline:record": async (payload) => {
        route.timelineStates.record.value = payload;
    },
    "timeline:play": async (payload) => {
        route.timelineStates.play.value = payload;
    },
})