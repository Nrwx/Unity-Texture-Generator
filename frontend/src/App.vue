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
      <DrawerNew
          v-model:taskbar-menu="windowStates.drawerLeft.value"
          v-model:item="activeItemLeft"
          align="left"
          @component-event="componentEvent"
      />
      <!-- Main Content -->
      <v-main>
        <viewport-grid v-model:layers="localData.layers.value" v-model:settings="localData.viewport.value" style="position: relative;">
          <template #canvas>
            <Image
                v-model:layers="localData.layers.value"
                @component-event="componentEvent"
            />
          </template>
        </viewport-grid>
      </v-main>
      <Layer
          style="position: relative"
          v-model:state="windowStates.layer.value"
          v-model:layers="localData.layers.value"
          @component-event="componentEvent"
      />
      <!-- Rechte Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('right', $event)" align="right" v-model:items="itemsRight" />
      <!-- Rechter Drawer -->
      <DrawerNew
          v-model:taskbar-menu="windowStates.drawerRight.value"
          v-model:item="activeItemRight"
          align="right"
          @component-event="componentEvent"
      />
    </template>
  </v-app>
</template>

<script>
import Taskbar from './components/Taskbar/Taskbar.vue';
import { taskbarItemLeft, taskbarItemRight } from "@/models/taskbar/config/model";
import {localData} from "@/dataLayer/local";
import DrawerNew from "@/components/Drawer/DrawerNew";
import {computed, reactive, ref} from "vue";
import {addLayer, deleteLayer, fetchLayers, previewLayers, updateLayer} from "@/dataLayer/route/layer";
import {fileUpload} from "@/dataLayer/route/upload";
import Image from "@/components/Image/Image";
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

export default {
  name: 'App',
  components: {
    ViewportGrid,
    Viewport,
    Taskbar,
    DrawerNew,
    Image,
    Layer,
    Setting,
    Fullscreen
  },
  setup() {
    const itemsLeft = ref(taskbarItemLeft);
    const itemsRight = ref(taskbarItemRight);
    const activeItemLeft = computed(() => itemsLeft.value.find(item => item.active));
    const activeItemRight = computed(() => itemsRight.value.find(item => item.active));
    const fullscreenInfo = reactive({
      title: '',
      id: '',
      src: '',
      tile: false,
      zoom: false,
      tileSize: {x: 1, y: 1},
      tileSrc: ''
    })

    const taskbarEvent = (side, itemId) => {
      if (side === 'left') {
        itemsLeft.value.forEach((item) => {
          item.active = false;
          item.active = item.id === itemId;
        });
        if(activeItemLeft.value.event) {
          componentEvent(activeItemLeft.value.event)
          windowStates.drawerLeft.value = false
        } else {
          windowStates.drawerLeft.value = true
        }
      } else if (side === 'right') {
        itemsRight.value.forEach((item) => {
          item.active = false;
          item.active = item.id === itemId;
        });
        if(activeItemRight.value.event) {
          componentEvent(activeItemRight.value.event)
          windowStates.drawerRight.value = false
        } else {
          windowStates.drawerRight.value = true
        }
      }
    };

    const componentEvent = async (event, payload) => {
      try {
        if (event === "viewport-setup") {
          const data = {
            mode: payload.mode,
            title: payload.title,
            width: payload.width,
            height: payload.height,
            layer: payload.layer
          }
          const response = await viewportSetup(data)
          if (response) {
            localData.viewport.value = data
            windowStates.viewport = false
          }
        }
        if (event === "viewport-state") {
          if(typeof payload === 'boolean') {
            windowStates.viewport.value = payload;
          }
        }
        if (event === "viewport-settings") {
          const data = {
            mode: payload.mode,
            title: payload.title,
            width: payload.width,
            height: payload.height
          }
          if(data) {
            localData.viewport.value = data
          }
        }
        if (event === "apply-file") {
          localData.file.value = payload;
        }
        else if (event === "upload-file") {
          const response = await fileUpload(localData.file.value)
          if(response) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "apply-maps") {
          localData.selectedMaps.value = payload
        }
        else if(event === "update-dimension") {
          localData.dimension.value = payload
        }
        else if(event === "add-layer") {
          const data = {
            name: `Layer ${localData.layers.value.length + 1}`,
            width: localData.dimension.value.width,
            height: localData.dimension.value.height,
          }
          const response = await addLayer(data)
          if(response) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "update-layer") {
          const response = await updateLayer(payload)
          console.log(event, payload)
          if(response) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "fetch-layer") {
          const response = await fetchLayers()
          if(response) {
            localData.layers.value = response;
          }
        }
        else if(event === "delete-layer") {
          const response = await deleteLayer(payload)
          if(response) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "layer-state") {
          windowStates.layer.value = true;
          if(windowStates.layer.value) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "fetch-setting") {
          const response = await fetchOsSettings()
          if(response) {
            Object.assign(osSettings, response)
          }
        }
        else if(event === "save-setting") {
          const response = await saveOsSettings()
          if(response) {
            windowStates.setting.value = false
            await componentEvent('fetch-setting');
          }
        }
        else if(event === "setting-state") {
          if(payload !== undefined) {
            windowStates.setting.value = payload;
          } else {
            windowStates.setting.value = true;
            await componentEvent('fetch-setting');
          }
        }
        else if(event === "fullscreen-state") {
          if(typeof payload === 'boolean') {
            windowStates.fullscreen.value = payload;
          } else {
            fullscreenInfo.title = payload.title
            fullscreenInfo.id = payload.id
            fullscreenInfo.src = payload.src
            windowStates.fullscreen.value = true;
          }
        }
        else if(event === "tile-state") {
          if(typeof payload === 'boolean') {
            fullscreenInfo.tile = payload;
          } else {
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
        }
        else if(event === 'preview-layer') {
          const response = await previewLayers();
          if (response) {
            fullscreenInfo.title = response.title;
            fullscreenInfo.id = response.id
            fullscreenInfo.src = response.src
            windowStates.fullscreen.value = true;
            console.log(response)
          }
        }
      } catch (error) {
        console.error("Error adding layer:", error.response?.data || error.message);
      }
    };

    return {
      itemsLeft,
      itemsRight,
      activeItemLeft,
      activeItemRight,
      fullscreenInfo,
      componentEvent,
      taskbarEvent,
      localData,
      windowStates,
      osSettings
    };
  },
};
</script>

<style scoped>
</style>
