<template>
  <v-app>
    <template v-if="windowStates.viewport.value">
      <!-- Viewport Dialog -->
      <viewport @component-event="componentEvent" :state="windowStates.viewport.value" :settings="localData.viewport.value"></viewport>
    </template>
    <template v-else>
      <!-- Settings Dialog -->
      <Setting @component-event="componentEvent" v-model:state="windowStates.setting.value" v-model:settings="osSettings"/>
      <Fullscreen @component-event="componentEvent" v-model:state="windowStates.fullscreen.value" v-model:data="fullscreenInfo"/>
      <!-- Linke Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('left', $event)" align="left" v-model:items="itemsLeft" />
      <!-- Linker Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerLeft.value" v-model:item="activeItemLeft" align="left" @component-event="componentEvent"/>
      <!-- Context Menu -->
      <Context :data="contextData" @select="handleContextAction"/>
      <!-- Main Content -->
      <v-main>
        <viewport-grid @component-event="componentEvent" v-model:layers="localData.layers.value" v-model:settings="localData.viewport.value" v-model:select="windowStates.select.value" v-model:select-mode="localData.selectedShape.value" style="position: relative;"/>
      </v-main>
      <Layer style="position: absolute; top: 40px; right: 70px;" :state="windowStates.layer.value" v-model:layers="localData.layers.value" v-model:channel="localData.channel.value" @component-event="componentEvent"/>
      <!-- Rechte Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('right', $event)" align="right" v-model:items="itemsRight" />
      <!-- Rechter Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerRight.value" v-model:item="activeItemRight" align="right" @component-event="componentEvent"/>
    </template>
  </v-app>
</template>

<script>
import Taskbar from './components/Taskbar/Taskbar.vue';
import { taskbarItemLeft, taskbarItemRight } from "@/models/taskbar/config/model";
import {localData} from "@/dataLayer/local";
import DrawerNew from "@/components/Drawer/DrawerNew";
import {computed, onMounted, reactive, ref} from "vue";
import {
  addLayer, blendLayer,
  deleteLayer,
  fetchLayers,
  hideLayer,
  orderLayers,
  previewLayers, updateChannel,
  updateLayer
} from "@/dataLayer/route/layer";
import {fileUpload} from "@/dataLayer/route/upload";
import Layer from "@/components/Layer/Layer";
import {windowStates} from "@/dataLayer/state";
import Setting from "@/components/Setting/Setting";
import {fetchOsSettings, saveOsSettings} from "@/dataLayer/route/setting";
import {osSettings} from "@/dataLayer/setting";
import Fullscreen from "@/components/Fullscreen/Fullscreen";
import {generateTileLayout} from "@/dataLayer/route/tile";
import Viewport from "@/view/page/Viewport/Viewport";
import {viewportSetup} from "@/dataLayer/route/viewport";
import ViewportGrid from "@/components/Viewport/Grid";
import {settings} from "@/dataLayer/parameter";
import Context from "@/components/Context/Context.vue";
import {contextData} from "@/models/context/item/model";

export default {
  name: 'App',
  components: {
    ViewportGrid,
    Viewport,
    Taskbar,
    DrawerNew,
    Layer,
    Setting,
    Fullscreen,
    Context
  },
  setup() {
    const itemsLeft = ref(taskbarItemLeft);
    const itemsRight = ref(taskbarItemRight);
    const activeItemLeft = computed(() => itemsLeft.value.find(item => item.active));
    const activeItemRight = computed(() => itemsRight.value.find(item => item.active));
    const fullscreenInfo = reactive({
      mode: 0,
      title: '',
      id: '',
      src: '',
      tile: false,
      zoom: false,
      tileSize: {x: 1, y: 1},
      tileSrc: ''
    })

    const taskbarEvent = async (side, itemId) => {
      if (side === 'left') {
        // Setze vorheriges aktives Item zurück
        itemsLeft.value.forEach(item => item.active = false);

        // Finde das neue aktive Item
        const activeItem = itemsLeft.value.find(item => item.id === itemId);
        if (activeItem) activeItem.active = !activeItem.active;

        // Event auslösen, falls vorhanden
        if (activeItem?.event) {
          await componentEvent(activeItem.event, activeItem.active);
          windowStates.drawerLeft.value = !activeItem.active;
        } else {
          windowStates.drawerLeft.value = activeItem.active;
        }
      } else if (side === 'right') {
        // Setze vorheriges aktives Item zurück
        itemsRight.value.forEach(item => item.active = false);

        // Finde das neue aktive Item
        const activeItem = itemsRight.value.find(item => item.id === itemId);
        if (activeItem) activeItem.active = !activeItem.active;

        // Event auslösen, falls vorhanden
        if (activeItem?.event) {
          await componentEvent(activeItem.event, activeItem.active);
          windowStates.drawerRight.value = !activeItem.active;
        } else {
          windowStates.drawerRight.value = activeItem.active;
        }
      }
    };

    const handleContextAction = ({ action, contextId }) => {
      console.log('Aktion:', action, 'auf Datei:', contextId)
    }

    const componentEvent = async (event, payload) => {
      try {
        if (event === "viewport-setup") {
          const data = {mode: payload.mode, title: payload.title, width: payload.width, height: payload.height, layer: payload.layer}
          const response = await viewportSetup(data)
          if (response) {
            await componentEvent('fetch-layer');
            localData.viewport.value = data;
            windowStates.viewport = false;
          }
        } else if (event === "viewport-state") {
          if(typeof payload === 'boolean') {
            windowStates.viewport.value = payload;
          }
        } else if (event === "viewport-settings") {
          const data = {mode: payload.mode, title: payload.title, width: payload.width, height: payload.height}
          if(data) {
            localData.viewport.value = localData.viewport.value[data];
          }
        } else if (event === "apply-file") {
          localData.file.value = payload;
        } else if (event === "upload-file") {
          const response = await fileUpload(localData.file.value)
          if(response) {
            await componentEvent('fetch-layer');
          }
        } else if(event === "apply-maps") {
          localData.selectedMaps.value = payload
        } else if(event === "apply-target-size") {
          localData.selectedTargetResize.value = payload
          settings.resize_index = payload
        } else if(event === "apply-target-size-option") {
          localData.selectedTargetResizeOption.value = payload
          settings.resize_index = payload
        } else if(event === "apply-target-size-method") {
          localData.selectedUpscaleMethod.value = payload
          settings.upscale_method = payload
        } else if(event === "apply-map-auto-optimize") {
          localData.selectedMapAutoOptimize.value = payload
        } else if(event === "apply-rgb-mode") {
          localData.selectedRgb.value = payload
          settings.rgb_mode = payload
        } else if(event === "apply-rgba-mode") {
          localData.selectedRgba.value = payload
          settings.rgba_mode = payload
        } else if(event === "layer-blend-mode") {
          const data = {id: payload.id, blend_mode: payload.blend_mode, color: '#ffffff'}
          const response = await blendLayer(data)
          console.log(data)
          if(response) {
            await componentEvent('fetch-layer');
            console.log('RESPONSE-APP-VUE')
          }
        } else if(event === "update-dimension") {
          localData.dimension.value = payload
        } else if(event === "add-layer") {
          const data = {name: `Layer ${localData.layers.value.length + 1}`, width: localData.dimension.value.width, height: localData.dimension.value.height,}
          const response = await addLayer(data)
          if(response) {
            await componentEvent('fetch-layer');
          }
        } else if(event === "update-layer") {
          const response = await updateLayer(payload)
          if(response) {
            await componentEvent('fetch-layer');
          }
        } else if(event === "fetch-layer") {
          const response = await fetchLayers();
          if(response) {
            localData.layers.value = response;
          }
        }
        else if(event === "delete-layer") {
          const response = await deleteLayer(payload)
          if(response) {
            await componentEvent('fetch-layer');
          }
        } else if(event === "order-layer") {
          const data = {id: payload.id, order: payload.order}
          const response = await orderLayers(data)
          if(response) {
            await componentEvent('fetch-layer');
          }
        } else if(event === "hide-layer") {
          const data = {id: payload.id, hidden: payload.hidden === 0 ? 1 : 0}
          const response = await hideLayer(data)
          if(response) {
            await componentEvent('fetch-layer');
          }
        } else if(event === "layer-state") {
          if(typeof payload === 'boolean') {
            windowStates.layer.value = payload;
            await componentEvent('fetch-layer');
          }
        } else if(event === "select-state") {
          if(typeof payload === 'boolean') {
            windowStates.select.value = payload;
            console.log(payload, 'APP:VUE')
          } else {
            windowStates.select.value = payload.state
            localData.selectedShape.value = payload.shape
            console.log('Auswahl abgeschlossen:', payload)
          }
        }else if(event === "cursor-state") {
          if (typeof payload === 'boolean') {
            windowStates.cursor = payload
            windowStates.select.value = false;
          } else {
            console.log(payload)
          }
        } else if(event === "fetch-setting") {
          const response = await fetchOsSettings()
          if(response) {
            Object.assign(osSettings, response)
          }
        } else if(event === "save-setting") {
          const response = await saveOsSettings()
          if(response) {
            windowStates.setting.value = false
            await componentEvent('fetch-setting');
          }
        } else if(event === "setting-state") {
          if(typeof payload === 'boolean') {
            windowStates.setting.value = payload;
          } else {
            windowStates.setting.value = true;
            await componentEvent('fetch-setting');
          }
        } else if(event === "fullscreen-state") {
          if(typeof payload === 'boolean') {
            windowStates.fullscreen.value = payload;
          } else {
            fullscreenInfo.title = payload.title
            fullscreenInfo.id = payload.id
            fullscreenInfo.src = payload.src
            windowStates.fullscreen.value = true;
          }
        } else if(event === "tile-state") {
          if(typeof payload === 'boolean') {
            fullscreenInfo.tile = payload;
          } else {
            fullscreenInfo.mode = payload.mode
            fullscreenInfo.id = payload.id
            fullscreenInfo.title = payload.title
            fullscreenInfo.src = payload.src
            fullscreenInfo.tile = payload.tile
            fullscreenInfo.tileSrc = payload.tileSrc
            fullscreenInfo.tileSize = payload.tileSize
            fullscreenInfo.zoom = payload.zoom
            const response = await generateTileLayout(fullscreenInfo);
            if(response) {
              fullscreenInfo.tileSrc = response.tileSrc;
            }
          }
        } else if(event === 'preview-layer') {
          const response = await previewLayers();
          if (response) {
            fullscreenInfo.title = response.title;
            fullscreenInfo.id = response.id
            fullscreenInfo.src = response.src
            windowStates.fullscreen.value = true;
          }
        } else if(event === 'update-channel') {
          const response = await updateChannel();
          if (response) {
            localData.channel.value = response
            console.log(response)
          }
        } else if(event === 'tools-state') {
          fullscreenInfo.title = payload.title;
          fullscreenInfo.id = payload.id
          fullscreenInfo.src = payload.src
          windowStates.fullscreen.value = true;
        } else if(event === 'reset-selected-layer') {
          localData.selectedLayers.value = []
        }
      } catch (error) {
        console.error("Error adding layer:", error.response?.data || error.message);
      }
    };

    const init = async () => {
      if(!localData.layers.value.length) {
        await componentEvent('fetch-layer');
      }
      if(!osSettings.use_gpu) {
        await componentEvent('fetch-setting');
      }
    };

    onMounted(async () => {
      await init()
    });

    return {
      itemsLeft,
      itemsRight,
      activeItemLeft,
      activeItemRight,
      fullscreenInfo,
      contextData,
      handleContextAction,
      componentEvent,
      taskbarEvent,
      localData,
      windowStates,
      osSettings
    };
  },
};
</script>

<style lang="scss">
@import "./view/scss/Base.scss";
</style>
