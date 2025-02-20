import {ref} from "vue";

export const localData = {
    viewport: ref({
        width: 1024,
        height: 1024,
        mode: 1,
        title: 'Unbekannt',
        layer: 'Ebene'
    }),
    file: ref(null),
    output: ref(''),
    dimension: ref({width: 1024, height: 1024}),
    layers: ref([]),
    selectedLayers: ref([]),
    maps: ref(["Diffuse Map", "Normal Map", "Specular Map", "Bump Map", "Light Map", "Alpha Map"]),
    selectedMaps: ref(["Diffuse Map"]),
    buildId: ref(''),
    builds: ref([]),
    sort: ref("newest"),
    animation: ref([]),
    tile: ref({x: 1, y: 1}),
}