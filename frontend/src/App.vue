<template>
  <v-app>
    <template v-if="windowStates.viewport.value">
      <!-- Viewport Dialog -->
      <viewport @component-event="componentEvent" :state="windowStates.viewport.value" :settings="localData.viewport.value"></viewport>
    </template>
    <template v-else>
      <!-- Settings Dialog -->
      <Setting @component-event="componentEvent" v-model:state="windowStates.setting.value" v-model:settings="osSettings" :loading="localData.loading.value"/>
      <!-- Fullscreen Dialog -->
      <Fullscreen @component-event="componentEvent" v-model:state="windowStates.fullscreen.value" v-model:data="fullscreenInfo" :loading="localData.loading.value"/>
      <!-- Linke Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('left', $event)" align="left" v-model:items="itemsLeft" />
      <!-- Linker Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerLeft.value" v-model:item="activeItemLeft" align="left" @component-event="componentEvent"/>
      <!-- Context Menu -->
      <Context :state="windowStates.context.value" :copy="contextStates.copy.value" :ref-id="contextConfig.contextRefId.value" :data="contextConfig.contextData.value" v-model:disabled="contextConfig.disabledData.value" @update:component-event="componentEvent"/>
      <!-- Main Content -->
      <v-main>
        <viewport-grid @component-event="componentEvent" v-model:layers="localData.layers.value" v-model:text-layer="textLayer" v-model:settings="localData.viewport.value" v-model:select="windowStates.select.value" v-model:select-mode="localData.selectedShape.value" :text="windowStates.text.value" style="position: relative;"/>
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
import {computed, onMounted, reactive, ref} from "vue";
import * as api from "@/dataLayer/route/route"
import Taskbar from './components/Taskbar/Taskbar.vue';
import {taskbarItemLeft, taskbarItemRight} from "@/models/taskbar/config/model";
import {localData} from "@/dataLayer/local";
import DrawerNew from "@/components/Drawer/DrawerNew";
import Layer from "@/components/Layer/Layer";
import {windowStates} from "@/dataLayer/state";
import Setting from "@/components/Setting/Setting";
import {osSettings} from "@/dataLayer/setting";
import Fullscreen from "@/components/Fullscreen/Fullscreen";
import {contextStates} from "@/dataLayer/state";
import Viewport from "@/view/page/Viewport/Viewport";
import ViewportGrid from "@/components/Viewport/Grid";
import {settings} from "@/dataLayer/parameter";
import Context from "@/components/Context/Context.vue";
import {textLayer} from "@/models/text/config/model";
import {createEventSystem} from "@/dataLayer/event";
import {contextConfig} from "@/models/context/config/model";

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
      title: '',
      id: '',
      src: '',
      tile: false,
      zoom: false,
      tileSize: {x: 1, y: 1},
      tileSrc: ''
    })

    const componentEvent = createEventSystem({
      api,
      windowStates,
      contextStates,
      contextConfig,
      localData,
      textLayer,
      settings,
      osSettings,
      fullscreenInfo
    });

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
      componentEvent,
      taskbarEvent,
      localData,
      windowStates,
      contextStates,
      contextConfig,
      osSettings,
      textLayer
    };
  },
};
</script>

<style lang="scss">
@import "./view/scss/Base.scss";
</style>
