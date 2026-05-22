<template>
  <v-app :id="tempData.appId.value">
    <template v-if="windowStates.boot.value">
      <!-- App Loader -->
      <Boot v-model:state="windowStates.boot.value" :auto-start="true" @component-event="componentEvent"/>
    </template>
    <template v-if="windowStates.viewport.value">
      <!-- Viewport Setup -->
      <Viewport @component-event="componentEvent" :state="windowStates.viewport.value" v-model:loading="loadingStates.viewport.value" :settings="localData.viewport.value" v-model:theme="appData.theme.value"/>
    </template>
    <template v-if="!windowStates.boot.value && !windowStates.viewport.value">
      <!-- Settings Dialog -->
      <Setting @component-event="componentEvent" v-model:project-id="localData.viewport.value.id" v-model:state="windowStates.setting.value" v-model:setting="osSettings" v-model:category="settingCategory" v-model:meta="osSettings.meta" v-model:tasks="localData.tasks.value" v-model:tasks-meta="localData.tasksMeta.value" v-model:task-edit="windowStates.taskEdit.value" v-model:task-edit-loading="loadingStates.taskEdit.value" :loading="localData.loading.value" v-model:plugins="localData.plugins.value" v-model:theme="appData.theme.value"/>
      <!-- Fullscreen Dialog -->
      <Fullscreen @component-event="componentEvent" v-model:state="windowStates.fullscreen.value" v-model:data="localData.fullscreenData" :loading="localData.loading.value" v-model:theme="appData.theme.value"/>
      <!-- Linke Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('left', $event)" @component-event="componentEvent" align="left" v-model:items="itemsLeft" v-model:theme="appData.theme.value" />
      <!-- Linker Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerLeft.value" v-model:item="activeItemLeft" align="left" v-model:theme="appData.theme.value" @component-event="componentEvent"/>
      <!-- Context Menu -->
      <Context :state="windowStates.context.value" :copy="contextStates.copy.value" :ref-id="contextConfig.contextRefId.value" v-model:data="contextConfig.contextData.value" v-model:disabled="contextConfig.disabledData.value"  v-model:theme="appData.theme.value" @update:component-event="componentEvent"/>
      <!-- Main Content -->
      <v-main>
        <!-- Grid -->
        <Grid v-model:edit-text="windowStates.textEdit.value" v-model:edit-text-layer="tempData.editTextLayer.value" v-model:status="statusBarItems" v-model:cursor-vector="localData.cursorVector.value" v-model:select-box="localData.selectItemsBox.value" v-model:eraser="windowStates.eraser.value"  v-model:layer-states="layerStates" v-model:brush-canvas-id="tempData.brushCanvasId.value" v-model:canvas-id="tempData.canvasId.value" v-model:rule="ruleStates.form.value" v-model:timeline="windowStates.timeline.value" v-model:mini-timeline="windowStates.miniTimeline.value" v-model:timeline-play="timelineStates.play.value" v-model:time="timelineData.time" v-model:timeline-record="timelineStates.record.value" v-model:path-drag="windowStates.pathDrag.value" v-model:selected-path="localData.selectedPath.value" v-model:container-states="containerStates" v-model:backup="backupStates.action.value" v-model:form-rule="ruleStates.form.value" @component-event="componentEvent" v-model:path-import="windowStates.pathImport.value" v-model:bezier="localData.bezier.value" v-model:layers="localData.layers.value" v-model:selected-layer="localData.selectedLayer.value" v-model:text-layer="textLayer" v-model:brush-cursor="localData.cursor.value" v-model:color="localData.color.value" v-model:settings="localData.viewport.value" v-model:guides="localData.guides.value" v-model:fill-state="modifierStates.fill.value" v-model:select="windowStates.select.value" v-model:select-mode="localData.selectedShape.value" v-model:text="windowStates.text.value" v-model:brushes="localData.brush.value" v-model:brush-settings="brushSettings" v-model:brush="windowStates.brush.value" v-model:drawing="windowStates.drawing.value" v-model:pen="windowStates.pen.value" v-model:path-layer="pathLayer" :viewport="{width: localData.viewport.value.width, height: localData.viewport.value.height}" :theme="appData.theme.value" :loading="localData.loading.value" :pen-path-state="windowStates.path.value" style="position: relative;">
          <!-- Mittige Taskbar -->
          <TaskbarCenter  v-model:items="itemsCenter" v-model:expanded="windowStates.drawerCenter.value" :active="activeItemCenter" @component-event="componentEvent" @taskbar-event="taskbarEvent('center', $event)" v-model:theme="appData.theme.value"/>
          <!-- Key-Event Log System -->
          <Key v-model:keys="tempData.keys.value" v-model:held-keys="tempData.heldKeys.value"/>
          <!-- Mini Timeline -->
          <Mini @component-event="componentEvent" v-model:config="timelineData" v-model:state="windowStates.miniTimeline.value" v-model:timeline="windowStates.timeline.value" v-model:play-state="timelineStates.play.value"/>
        </Grid>
      </v-main>
      <!-- Layer -->
      <Layer style="position: absolute; top: 40px; right: 70px;" :state="windowStates.layer.value" v-model:selected-channel="localData.selectedChannel.value" v-model:channel-settings="localData.channelSettings.value" v-model:layers="localData.layers.value" v-model:paths="localData.paths.value" v-model:selected-layer="localData.selectedLayer.value" v-model:channel="localData.channel.value" v-model:theme="appData.theme.value" @component-event="componentEvent"/>
      <!-- Channel Mixer -->
      <Mixer v-model:viewport="localData.viewport.value" v-model:data="mixerConfig" v-model:shader="localData.shader.value" :blend-mode="blendMode" v-model:channel="localData.channel.value" v-model:state="windowStates.mixer.value" v-model:loading="loadingStates.mixer.value" v-model:theme="appData.theme.value" @component-event="componentEvent"/>
      <!-- Cut/Crop/Resize Modifier -->
      <ResizeModifier v-model:state="modifierStates.resize.value" v-model:viewport="localData.viewport.value" v-model:layer="tempData.activeLayer.value" v-model:select-mask="localData.selectMaskBox.value" v-model:select-mask-shape="localData.selectedShape.value" v-model:theme="appData.theme.value" @component-event="componentEvent"/>
      <!-- Color/Lookup/Invert/Brightness Modifier -->
      <ColorModifier v-model:state="modifierStates.color.value" v-model:loading="loadingStates.modifierColor.value" v-model:loading-preview="loadingStates.modifierColorPreview.value" v-model:layer="tempData.activeLayer.value" v-model:select-mask="localData.selectMaskBox.value" v-model:select-mask-shape="localData.selectedShape.value"  v-model:preview-src="tempData.preview.value.src" v-model:theme="appData.theme.value" @component-event="componentEvent"/>
      <!-- Rechte Taskbar -->
      <Taskbar @taskbar-event="taskbarEvent('right', $event)" align="right"  @component-event="componentEvent" v-model:items="itemsRight" v-model:theme="appData.theme.value" />
      <!-- Rechter Drawer -->
      <DrawerNew v-model:taskbar-menu="windowStates.drawerRight.value" v-model:item="activeItemRight" align="right" v-model:theme="appData.theme.value" @component-event="componentEvent"/>
    </template>

    <!-- Message System -->
    <Notify v-model:data="localData.messages.value" v-model:state="windowStates.notify.value" @component-event="componentEvent" v-model:theme="appData.theme.value" v-model:wait="windowStates.queue.value" />
    <!-- Response Message System -->
    <Queue @component-event="componentEvent" v-model:queue="localData.queue.value" v-model:wait="localData.queueWait.value" v-model:theme="appData.theme.value" v-model:state="windowStates.queue.value"/>
  </v-app>
</template>

<script>
import {computed, nextTick, onMounted, ref} from "vue";
import * as api from "@/dataLayer/route/route"
import Taskbar from './components/Taskbar/Taskbar.vue';
import {taskbarItemCenter, taskbarItemLeft, taskbarItemRight} from "@/models/taskbar/config/model";
import {appData, localData, screenshotData, tempData} from "@/dataLayer/local";
import DrawerNew from "@/components/Drawer/DrawerNew";
import Layer from "@/components/Layer/Layer";
import {
  backupStates,
  containerStates, loadingStates,
  modifierStates,
  ruleStates,
  timelineStates,
  layerStates,
  windowStates
} from "@/dataLayer/state";
import Setting from "@/components/Setting/Setting";
import {osSettings} from "@/dataLayer/setting";
import Fullscreen from "@/components/Fullscreen/Fullscreen";
import {contextStates} from "@/dataLayer/state";
import Viewport from "@/view/page/Viewport/Viewport";
import Grid from "@/components/Grid/Grid";
import {settings} from "@/dataLayer/parameter";
import Context from "@/components/Context/Context.vue";
import {textLayer} from "@/models/text/config/model";
import { createEventSystem } from '@/dataLayer/event';
import {contextConfig} from "@/models/context/config/model";
import {brushSettings} from "@/models/brush/config/model";
import Queue from "@/components/Queue/Queue";
import {pathLayer} from "@/models/pen/config/model";
import TaskbarCenter from "@/components/Taskbar/TaskbarCenter";
import Notify from "@/components/Notify/Notify";
import {notifyMessage} from "@/models/notify/config/model";
import Key from "@/components/Key/Key";
import {exportData, previewData} from "@/models/export/config/model";
import {initLocalization} from "@/utils/dayJs";
import {timelineData} from "@/models/timeline/config/model";
import {settingCategory, settingMeta} from "@/models/setting/config/model";
import Boot from "@/components/Boot/Boot.vue";
import Mixer from "@/components/Channel/Mixer.vue";
import {mixerConfig} from "@/models/channel/config/model";
import {blendMode} from "@/models/canvas/blend/model";
import Mini from "@/components/Timeline/Mini";
import {statusBarItems} from "@/models/status/config/model";
import ResizeModifier from "@/view/page/Modifier/Resize/Resize";
import ColorModifier from "@/view/page/Modifier/Color/Color";

export default {
  name: 'App',
  components: {
    Mixer,
    Boot,
    Notify,
    TaskbarCenter,
    Queue,
    Grid,
    Viewport,
    Taskbar,
    DrawerNew,
    Layer,
    Setting,
    Fullscreen,
    Context,
    Key,
    Mini,
    ResizeModifier,
    ColorModifier
  },
  setup() {
    const itemsLeft = ref(taskbarItemLeft);
    const itemsRight = ref(taskbarItemRight);
    const itemsCenter = ref(taskbarItemCenter);
    const activeItemLeft = computed(() => itemsLeft.value.find(item => item.active));
    const activeItemCenter = computed(() => itemsCenter.value.find(item => item.active));
    const activeItemRight = computed(() => itemsRight.value.find(item => item.active));

    const componentEvent = createEventSystem({
      api,
      appData,
      localData,
      windowStates,
      ruleStates,
      layerStates,
      containerStates,
      backupStates,
      brushSettings,
      modifierStates,
      contextStates,
      contextConfig,
      textLayer,
      pathLayer,
      notifyMessage,
      settings,
      osSettings,
      tempData,
      screenshotData,
      exportData,
      previewData,
      timelineData,
      timelineStates,
      loadingStates,
      mixerConfig
    });

    const taskbarEvent = async (side, itemId) => {
      const list = side === 'left'
          ? itemsLeft.value
          : side === 'right'
              ? itemsRight.value
              : side === 'center'
                  ? itemsCenter.value
                  : [];

      const windowState = side === 'left'
          ? windowStates.drawerLeft
          : side === 'right'
              ? windowStates.drawerRight
              : side === 'center'
                  ? windowStates.drawerCenter
                  : null;

      // Fallback bei unbekanntem Side-Wert
      if (!list.length || !windowState) {
        console.warn(`Unbekannter side-Parameter: ${side}`);
        return;
      }

      // Prüfe zuerst, ob das itemId ein SubItem (menuItem) ist
      const parentItem = list.find(item => item.menuItems?.some(mi => mi.id === itemId));

      if (parentItem) {
        // SubItem-Modus (menuItem)
        parentItem.menuItems.forEach(mi => mi.active = false);

        const activeMenuItem = parentItem.menuItems.find(mi => mi.id === itemId);
        if (activeMenuItem) activeMenuItem.active = !activeMenuItem.active;

        if (activeMenuItem?.active && activeMenuItem.icon) {
          parentItem.icon = activeMenuItem.icon;
        }

        if (!parentItem.menuItems.some(mi => mi.active)) {
          parentItem.icon = parentItem.menuItems[0]?.icon || null;
        }

        if (activeMenuItem?.event) {
          await componentEvent(activeMenuItem.event, activeMenuItem.val);
        }

        return;
      }

      // Standard Taskbar-Item
      list.forEach(item => item.active = false);

      const activeItem = list.find(item => item.id === itemId);
      if (activeItem) activeItem.active = !activeItem.active;

      if (activeItem?.event) {
        await componentEvent(activeItem.event, activeItem.active);
        await nextTick();
        windowState.value = !activeItem.active;
      } else {
        windowState.value = !!activeItem?.active;
      }
    };



    const init = async () => {
      initLocalization();
      tempData.app.value = document.getElementById(tempData.appId.value);
      if (tempData.app.value) {
        await componentEvent('app:apply-theme', appData.theme.value);
      }
      if(!localData.fonts.value.length) {
        await componentEvent('fetch-fonts');
      }
      if(!localData.brush.value.length) {
        await componentEvent('fetch-brush');
      }
      if(!osSettings.value.init) {
        await componentEvent('fetch-setting');
      }
      if(!localData.tasks.value.length) {
        await componentEvent('task:fetch-list');
      }
      if(!localData.tasksMeta.value) {
        await componentEvent('task:fetch-meta', {meta: true});
      }
      if(!localData.paths.value.length) {
        await componentEvent("path:fetch")
        await componentEvent("select:path-layer", localData.paths.value[1]);
      }
      if(!localData.shader.value.length) {
        await componentEvent('fetch-shader');
      }
    };

    onMounted(async () => {
      await init()
    });
    return {
      itemsLeft,
      itemsCenter,
      itemsRight,
      activeItemLeft,
      activeItemCenter,
      activeItemRight,
      componentEvent,
      taskbarEvent,
      appData,
      ruleStates,
      localData,
      windowStates,
      modifierStates,
      containerStates,
      contextStates,
      brushSettings,
      contextConfig,
      osSettings,
      textLayer,
      pathLayer,
      tempData,
      layerStates,
      backupStates,
      timelineData,
      timelineStates,
      settingCategory,
      settingMeta,
      loadingStates,
      mixerConfig,
      blendMode,
      statusBarItems
    };
  },
};
</script>

<style lang="scss">
@import "./view/scss/Base.scss";
</style>
