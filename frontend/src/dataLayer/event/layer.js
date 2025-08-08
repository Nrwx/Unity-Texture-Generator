export const layerEvent = (route) => ({
    "fetch-layer": async () => {
        const response = await route.api.fetchLayers()
        if (response) {
            route.localData.layers.value = response;
            if(route.localData.layers.value?.length) {
                if (!route.listener.isActive('listener:layer-context')) {
                    await route.emit("event:listener", {resume: true, id: 'listener:layer-context'})
                }
            }
             else {
                 if(route.listener.isActive('listener:layer-context')) {
                     await route.emit("event:listener", {pause: true, id: 'listener:layer-context'})
                 }
            }
        }
    },
    "add-layer": async () => {
        const data = {
            name: `Layer ${route.localData.layers.value.length + 1}`,
            type: 0,
            width: route.localData.viewport.value.width,
            height: route.localData.viewport.value.height
        }
        const response = await route.api.addLayer(data);
        if (response) {
            await route.emit("fetch-layer");
            await route.emit("backup:fetch-list");
        }
    },
    "update-layer": async (payload) => {
        const response = await route.api.updateLayer(payload)
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "delete-layer": async (payload) => {
        const response = await route.api.deleteLayer(payload);
        if (response) {
            await route.emit("layer:select", [])
            await route.emit("fetch-layer");
        }
    },
    "group-layer": async (payload) => {
        const ids = payload.ids.map(x => x.id);
        const data = {
            ...payload,
            ids: ids
        };
        const response = await route.api.groupLayer(data);
        if (response) {
            await route.emit("layer:select", []);
            await route.emit("fetch-layer");
        }
    },
    "paste-layer": async (payload) => {
        const response = await route.api.pasteLayer(payload);
        if (response) {
            await route.emit("fetch-layer");
        }
    }
});

export const layerModifierEvent = (route) => ({
    "layer-blend-mode": async (payload) => {
        const data = {id: payload.id, blend_mode: payload.blend_mode, color: route.localData.color.value}
        console.log(data)
        const response = await route.api.blendLayer(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "hide-layer": async (payload) => {
        const data = {id: payload.id, hidden: payload.hidden === 0 ? 1 : 0}
        const response = await route.api.hideLayer(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "order-layer": async (payload) => {
        const data = {id: payload.id, order: payload.order}
        const response = await route.api.orderLayers(data);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
    "mask-layer": async (payload) => {
        const { id, id2 } = payload;

        if (!id || !id2) {
            console.warn("mask-layer: Ungültiger Payload", payload);
            return;
        }
        const response = await route.api.maskLayer(id, id2);
        if (response) {
            const res = await route.api.maskedLayer(response?.id, response?.id2);
            if(res) {
                await route.emit("fetch-layer");
            }
        }
    },
});

export const selectLayerEvent = (route) => ({
    "layer:select": async (payload) => {
        route.localData.selectedLayer.value = payload
    },
});

export const textLayerEvent = (route) => ({
    "add-text-layer": async (payload) => {
        const response = await route.api.addTextLayer(payload);
        if (response) {
            await route.emit("fetch-layer");
        }
    },
});

export const textModifierEvent = (route) => ({
    "apply-font-size": (payload) => {
        route.textLayer.value.fontSize = payload;
    },
    "apply-font-family": (payload) => {
        route.textLayer.value.fontFamily = payload.value;
        route.textLayer.value.font = payload.id
    },
    "apply-font-weight": (payload) => {
        route.textLayer.value.fontWeight = payload;
    },
    "apply-font-text-align": (payload) => {
        route.textLayer.value.textAlign = payload;
    },
    "apply-font-line-height": (payload) => {
        route.textLayer.value.lineHeight = payload;
    },
    "apply-font-letter-spacing": (payload) => {
        route.textLayer.value.letterSpacing = payload;
    },
    "apply-font-text-transform": (payload) => {
        route.textLayer.value.textTransform = payload;
    },
    "apply-font-text-decoration": (payload) => {
        route.textLayer.value.textDecoration = payload;
    },
    "apply-font-color": (payload) => {
        route.textLayer.value.color = payload;
    },
});

export const pathLayerEvent = (route) => ({
    "add-path-layer": async (payload) => {
        const response = await route.api.addPathLayer(payload);
        if (response) {
            await route.emit('path:add', payload);
            await route.emit('path-drag-state', false)
            await route.emit('path:reset', false)
            await route.emit("fetch-layer");
        }
    },
    "update:path-layer": async (payload) => {
        route.pathLayer.value = payload;
    },
    "select:path-layer": async (payload) => {
        route.localData.selectedPath.value = payload;
    },
    "path:edit": async (payload) => {
        route.windowStates.pathEdit.value = payload;
        route.emit('path:import', false)
    },
    "path:lock": async (payload) => {
        route.windowStates.pathLock.value = payload;
        route.emit('path:import', false)
    },
    "path:import": async (payload) => {
        route.windowStates.pathImport.value = payload;
    },
    "path:reset": async (payload) => {
        await route.emit('pen-state', payload)
        await route.emit('pen:path-state', payload)
        await route.emit('path:import', payload)
        await route.emit('drawer-center-state', payload)

        const data =  {
            name: 'Form',
            closed: false,
            edit: true,

            width: 0,
            height: 0,

            points: [],
            connections: [],

            // Style-Attribute für Stroke/Fill
            stroke: '#000000',
            strokeWidth: 1,
            strokeDash: 0,
            strokeDashArray: [],
            strokeDashType: '',
            fill: '#ffffff',
            fillOpacity: 1,
            gradient: {
                type: 'linear',
                angle: 90,
                stops: [],
            },
        };
        await route.emit('update:path-layer', data)
        await route.emit('path:edit', !payload)
        await route.emit('path:lock', payload)
    },
});

export const pathModifierEvent = (route) => ({
    "apply-path-name": (payload) => {
        route.pathLayer.value.name = payload;
    },
    "apply-path-stroke": (payload) => {
        route.pathLayer.value.stroke = payload;
    },
    "apply-path-fill": (payload) => {
        route.pathLayer.value.fill = payload;
    },
    "apply-path-gradient": (payload) => {
        route.pathLayer.value.gradient = payload;
    },
    "apply-path-stroke-width": (payload) => {
        route.pathLayer.value.strokeWidth = payload;
    },
    "apply-path-border-type": (payload) => {
        route.pathLayer.value.strokeDashType = payload;
    },
    "apply-path-dash": (payload) => {
        route.pathLayer.value.strokeDashArray = payload;
    },
    "apply-path-dash-array": (payload) => {
        route.pathLayer.value.strokeDashArray = payload;
    },
    "apply-path-opacity": (payload) => {
        route.pathLayer.value.opacity = payload;
    },
    "apply-path-closed": (payload) => {
        route.pathLayer.value.closed = payload;
    },
    "apply-path-edit": (payload) => {
        route.pathLayer.value.edit = payload;
    }
});
