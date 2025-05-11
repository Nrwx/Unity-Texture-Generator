import dayjs from "dayjs";
import {localData} from "@/dataLayer/local";
import api from "@/dataLayer/api";

export const generateTileLayout = async (data) => {
    try {
        const build = localData.builds.value.find((b) => b.id === data.id);
        const prefix = data.title + ' (' + data.tileSize.x + 'x' + data.tileSize.y + ')'

        if(!build.maps.includes(prefix)) {
            const formData = new FormData();
            formData.append("diffuse_image_url", data.src);
            formData.append("tile_x", data.tileSize.x);
            formData.append("tile_y", data.tileSize.y);

            const response = await api.post('/tile', formData, {
                headers: {'Content-Type': 'multipart/form-data'},
            });

            if (response && response.url) {
                const newTileMap = {
                    src: response.url,
                    id: response.id,
                    width: response.width,
                    height: response.height,
                    type: prefix,
                };

                if (data.tileSize.x > 1 && data.tileSize.y > 1) {
                    localData.buildId.value = data.id
                    build.maps = [...build.maps.split(', '), newTileMap.type].join(', ');
                    build.tiledMaps.push(newTileMap);
                    build.timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss')
                }
                data.tileSrc = response.url;
                return data
            }
        }
        else {
            const cache = build.tiledMaps.find((b) => b.type === prefix);
            data.tileSrc = cache.src
            return data
        }
    } catch (error) {
        console.error("Error during tile image generation:", error);
    }
};