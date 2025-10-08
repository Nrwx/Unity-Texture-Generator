export const timelineEvent = (route) => ({
    "timeline:id": async (payload) => {
        route.timelineData.value.id = payload;
        console.log(route.timelineData.value.id, 'TIMELINE ID SETUP' )
    },
    "timeline:time": async (payload) => {
        route.timelineData.value.time = payload;
        console.log(route.timelineData.value.time, 'TIMELINE TIME' )
    },
    "timeline:width": async (payload) => {
        route.timelineData.value.width = payload;
        console.log(route.timelineData.value.width, 'TIMELINE WIDTH SETUP')
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
        console.log(route.timelineData.value.keyframes, 'TIMELINE KEYFRAMES')
    },
    "timeline:select-keyframes": async (payload) => {
        route.timelineData.value.selectedKeyframes = payload;
        console.log(route.timelineData.value.selectedKeyframes, 'TIMELINE SELECTED KEYFRAMES')
    },
})