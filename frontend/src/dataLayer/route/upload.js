import {localData} from "@/dataLayer/local";
import {settings} from "@/dataLayer/parameter";
import api from "@/dataLayer/api";
import {v4 as uuidv4} from "uuid";
import dayjs from "dayjs";

export const fileUpload = async (file) => {
    if (!file) {
        console.error('Bitte ein Bild auswählen.');
        return;
    }
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(settings).forEach(key => formData.append(key, settings[key]));
    formData.append("selectedMaps", JSON.stringify(localData.selectedMaps.value));
    try {
        const response = await api.post('/upload', formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        if (response.additionalMaps && response.additionalMaps.length > 0) {
            localData.output.value = response.additionalMaps[0].url;
        }
        if(localData.animation.value.length > 0) {
            localData.builds.value.push(localData.animation.value[0])
            localData.animation.value = []
        }
        const newMaps = response.additionalMaps.map((map) => ({
            src: map.url,
            width: map.width,
            height: map.height,
            id: map.id,
            type: map.type,
        }));
        const id = uuidv4();
        localData.buildId.value = id
        return {
            id: id,
            maps: localData.selectedMaps.value.join(", "),
            buildMaps: [...newMaps],
            timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            imageCount: response.additionalMaps.length,
            tiledMaps: [],
            collapsed: true,
        }
    } catch (error) {
        console.error('Error processing image:', error);
    }
};