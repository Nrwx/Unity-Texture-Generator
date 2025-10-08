import {ref} from "vue";

export const timelineData = ref({
    id: null,
    width: 0,
    height: 200,
    time: 0,
    totalTime: 200,
    zoomLevel: {
        current: 1,
        min: 0.2,
        max: 6
    },
    ease: 'linear',
    padding: 40,
    keyframes: [],
    selectedKeyframes: [],
    pointShape: '-6,0 0,-8 6,0 0,8',
    pointColor: {
        default: '#f87171',
        selected: '#67e8f9',
        stroke: '#222',
    },
    ticks: {
        candidates: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200],
        targetPx: 50,
        color: '#444'
    }
})