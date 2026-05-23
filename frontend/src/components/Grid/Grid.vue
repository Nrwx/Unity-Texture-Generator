<template>
  <div ref="grid.wrapper.ref" :id="grid.wrapper.id" class="viewport-wrapper" :style="brush && !ui.brush.menu.active && cursorVector?.paths?.length ? 'cursor: none !important' : ''">
    <!-- Hauptcontainer: Zentriert das Canvas -->
    <div class="main-layer" ref="grid.main.ref" :id="grid.main.id">
      <!-- Lineale -->
      <Guide
          :guides="guides"
          :settings="settings"
          :container="grid.container.matrix"
          :canvas-id="grid.container.id"
          :main-id="grid.main.id"
          @update:guides-event="emitEvent"
      />

      <!-- Canvas Container -->
      <div class="canvas-row" style="position: relative;">
        <div
            ref="grid.container.ref"
            class="canvas-container d-flex align-center justify-center"
            :style="grid.container.style"
            :id="grid.container.id"
        >

          <!-- Zentrale Inhalte im Canvas -->
          <div class="canvas-content overflow-hidden transparent">

            <Animator
                v-if="orbit"
                :engine-session="engineSession"
                :editor-config="engineData.editor.value"
                :camera-config="engineData.camera.value"
                :orbit-config="engineData.orbit.value"
                :control-config="engineData.controls.value"
                :gizmo-config="engineData.gizmo.value"
                :edit-config="engineData.edit.value"
                :sculpt-config="engineData.sculpt.value"
                :grid-config="engineData.grid.value"
                :view-config="engineData.view.value"
                :keyboard="engineData.keyboard"
                :mesh-states="meshStates"
                :viewport="viewport"
                :selected-layers="selectedLayer"
                :timeline-time="time"
                @update:component-event="emitEvent"
            />


            <Image
                v-else
                :layers="layers"
                :color="color"
                :selected-layer="selectedLayer"
                :fill-state="fillState"
                @update:image-event="emitEvent"
                @update:select-layer="toggleSelection"
                :timeline="timeline"
                :mini-timeline="miniTimeline"
                :timeline-play="timelinePlay"
                :timeline-time="time"
                :export-state="exportState"
                :export-time-seconds="exportTimeSeconds"
            />

            <template v-if="!exportState && ! orbit">
              <div v-if="!selectedLayer.length" class="center-crosshair"></div>

              <Text :state="text" @update:component-event="emitEvent" :layer="textLayer"/>

              <Edit :state="editText" :layer="editTextLayer" @update:component-event="emitEvent"/>
              <!-- Formzeichnung -->
              <Path :viewport="viewport" :state="pathDrag" :selected="selectedPath" :mouse="cursor" @update:component-event="emitEvent"/>
              <!-- Zeichnung -->
              <Brush @update:write-ui="writeUi" :wrapper="grid.main.id" :selected-layer="selectedLayer[selectedLayer.length - 1]" :brush-menu="ui.brush.menu.active" :current-brush="ui.brush.cursor.current" :eraser="eraser" :canvas-id="brushCanvasId" :mouse="cursor" :cursor="brushCursor" :viewport="viewport" :brushes="brushes" :state="brush" :drawing="drawing" :data="brushSettings" @update:component-event="emitEvent"/>
              <!-- Pfadzeichnung -->
              <Pen :mouse="cursor" :bezier="bezier" :viewport="viewport" :state="pen" :path-import="pathImport" :path-layer="pathLayer" :loading="loading" :path-state="penPathState" :theme="theme" @update:component-event="emitEvent"/>
            </template>
          </div>

          <template v-if="!orbit && !exportState">
            <SelectVector
                v-if="selectedLayer.length && !editText"
                :frameBox="frameBox"
                :anchor="anchorScreen"
                @resize="startResize"
                @rotate="startRotate"
                @anchor="startAnchorDrag"
            />

            <!-- Brush-Cursor -->
            <Cursor
                v-if="brush && cursorVector?.paths?.length"
                :brush="brush"
                :brush-settings="brushSettings"
                :cursor-vector="cursorVector"
                :position="ui.brush.cursor.position"
            />
          </template>
        </div>

        <!-- Brush-Menu -->
        <Menu
            :visible="ui.brush.menu.active"
            :menuPos="ui.brush.menu.position"
            :settings="brushSettings"
            :brushes="brushes"
            @update:menu-event="emitEvent"
        />
      </div>

      <!-- Koordinatenanzeige -->
      <div class="cursor-coordinates">
        {{ `X: ${cursor.x}, Y: ${cursor.y}, DPI: ${settings.dpi}, Maß: ${settings.unit.toUpperCase()}`  }}
      </div>

      <Status
          :items="status"
          :always-show="true"
          :docked="false"
      />
      <!-- Selection Box -->
      <Selection
          :state="select"
          :shape="selectMode"
          :main-id="grid.main.id"
          :container-id="grid.container.id"
          @update:component-event="emitEvent"
      />
      <div
          v-if="!select && selectBox"
          ref="panel"
          class="absolute w-h"
          style="pointer-events: none;"
          tabIndex="0"
      >
        <Box
            :box="selectBox"
            :shape="selectMode"
        />
      </div>

    </div>

    <slot style="width: 100%;"/>

    <CameraPanel
        v-if="orbit"
        :selected-layers="selectedLayer"
        :editor-config="engineData.editor.value"
        :camera-config="engineData.camera.value"
        :orbit-config="engineData.orbit.value"
        :gizmo-config="engineData.gizmo.value"
        :edit-config="engineData.edit.value"
        :sculpt-config="engineData.sculpt.value"
        :grid-config="engineData.grid.value"
        :view-config="engineData.view.value"
        :keyboard="engineData.keyboard"
        :mesh-states="meshStates"
        compact
        @update:component-event="emitEvent"
    />

    <!-- Container Control -->
    <Control
        v-else
        :state="containerStates.control.value"
        :data="{...grid.container.matrix, width: grid.wrapper.width, height: grid.wrapper.height}"
        :theme="theme"
        @update:position="onPositionUpdate"
        @update:scale="onScaleUpdate"
        @update:rotation="onRotationUpdate"
        @reset="onReset"
    />

  </div>
</template>

<script>
import { defineComponent } from "vue";
import {gridModel, gridProps} from "@/models/grid/model";
import SelectVector from "@/components/Layer/Select";
import Guide from "@/components/Guide/Guide";
import Brush from "@/components/Brush/Brush";
import Text from "@/components/Text/Text";
import Image from "@/components/Image/Image";
import Selection from "@/components/Selection/Selection";
import Pen from "@/components/Pen/Pen";
import Control from "@/components/Transform/Control";
import Path from "@/components/Path/Drag";
import Status from "@/components/Status/Status";
import Menu from "@/components/Brush/Menu";
import Box from "@/components/Selection/Box";
import Cursor from "@/components/Brush/Cursor";
import Edit from "@/components/Text/Edit";
import Animator from "@/view/page/Material/Animator/Animator";
import CameraPanel from "@/view/page/Material/Camera/CameraPanel";

export default defineComponent({
  name: "GridComponent",
  props: gridProps,
  components: {
    Path,
    Pen,
    SelectVector,
    Guide,
    Brush,
    Cursor,
    Text,
    Edit,
    Image,
    Selection,
    Control,
    Status,
    Menu,
    Box,
    Animator,
    CameraPanel
  },
  setup(props, { emit }) {
    const model = gridModel(props, emit);
    return {...model};
  },
});
</script>

<style scoped lang="scss">
@import 'Grid.scss';
</style>
