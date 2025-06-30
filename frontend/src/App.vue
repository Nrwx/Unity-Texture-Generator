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
      <Fullscreen @component-event="componentEvent" v-model:state="windowStates.fullscreen.value" v-model:data="localData.fullscreenData" :loading="localData.loading.value"/>
      <!-- Linke Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('left', $event)" align="left" v-model:items="itemsLeft" />
      <!-- Linker Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerLeft.value" v-model:item="activeItemLeft" align="left" @component-event="componentEvent"/>
      <!-- Context Menu -->
      <Context :state="windowStates.context.value" :copy="contextStates.copy.value" :ref-id="contextConfig.contextRefId.value" :data="contextConfig.contextData.value" v-model:disabled="contextConfig.disabledData.value" @update:component-event="componentEvent"/>
      <!-- Main Content -->
      <v-main>
        <viewport-grid @component-event="componentEvent" v-model:layers="localData.layers.value" v-model:selected-layer="localData.selectedLayer.value" v-model:text-layer="textLayer" v-model:brush-cursor="localData.cursor.value" v-model:settings="localData.viewport.value" v-model:fill-state="modifierStates.fill.value" v-model:select="windowStates.select.value" v-model:select-mode="localData.selectedShape.value" v-model:text="windowStates.text.value" v-model:brushes="localData.brush.value" v-model:brush-layer="brushSettings" v-model:brush="windowStates.brush.value" v-model:drawing="windowStates.drawing.value" :viewport="{width: localData.viewport.value.width, height: localData.viewport.value.height}" style="position: relative;"/>
      </v-main>
      <Layer style="position: absolute; top: 40px; right: 70px;" :state="windowStates.layer.value" v-model:layers="localData.layers.value" v-model:selected-layer="localData.selectedLayer.value" v-model:channel="localData.channel.value" @component-event="componentEvent"/>
      <!-- Rechte Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('right', $event)" align="right" v-model:items="itemsRight" />
      <!-- Rechter Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerRight.value" v-model:item="activeItemRight" align="right" @component-event="componentEvent"/>
    </template>
  </v-app>
</template>

<script>
import {computed, nextTick, onMounted, ref} from "vue";
import * as api from "@/dataLayer/route/route"
import Taskbar from './components/Taskbar/Taskbar.vue';
import {taskbarItemLeft, taskbarItemRight} from "@/models/taskbar/config/model";
import {localData} from "@/dataLayer/local";
import DrawerNew from "@/components/Drawer/DrawerNew";
import Layer from "@/components/Layer/Layer";
import {backupStates, modifierStates, windowStates} from "@/dataLayer/state";
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
import {brushSettings} from "@/models/brush/config/model";

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

    const componentEvent = createEventSystem({
      api,
      windowStates,
      backupStates,
      brushSettings,
      modifierStates,
      contextStates,
      contextConfig,
      localData,
      textLayer,
      settings,
      osSettings
    });

    const taskbarEvent = async (side, itemId) => {
      if (side === 'left') {
        itemsLeft.value.forEach(item => item.active = false);

        const activeItem = itemsLeft.value.find(item => item.id === itemId);
        if (activeItem) activeItem.active = !activeItem.active;

        if (activeItem?.event) {
          await componentEvent(activeItem.event, activeItem.active);
          await nextTick()
          windowStates.drawerLeft.value = !activeItem.active;
        } else {
          windowStates.drawerLeft.value = activeItem.active;
        }
      } else if (side === 'right') {
        itemsRight.value.forEach(item => item.active = false);

        const activeItem = itemsRight.value.find(item => item.id === itemId);
        if (activeItem) activeItem.active = !activeItem.active;

        if (activeItem?.event) {
          await componentEvent(activeItem.event, activeItem.active);
          await nextTick()
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
      if(!localData.fonts.value.length) {
        await componentEvent('fetch-fonts');
      }
      if(!localData.brush.value.length) {
        await componentEvent('fetch-brush');
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
      componentEvent,
      taskbarEvent,
      localData,
      windowStates,
      modifierStates,
      contextStates,
      brushSettings,
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
