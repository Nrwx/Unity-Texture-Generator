<template>
  <div class="viewport-wrapper" @mousedown="resetSelection">
    <!-- Hauptcontainer: Zentriert das Canvas -->
    <div class="main-layer">
      <!-- Lineale -->
      <Guide
          :guides="guides"
          :settings="settings"
          :zoomFaktor="zoomFaktor"
          :offset="offset"
          @update:guides-event="emitEvent"
      />

      <!-- Canvas Container -->
      <div class="canvas-row" style="position: relative;">
        <div
            ref="canvasContainer"
            class="canvas-container d-flex align-center justify-center"
            :style="canvasContainerStyle"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
        >
          <!-- Zentrale Inhalte im Canvas -->
          <div class="canvas-content overflow-hidden">
            <Image
                :layers="layers"
                :color="color"
                :selected-layer="selectedLayer"
                :fill-state="fillState"
                @update:image-event="emitEvent"
                @update:select-layer="toggleSelection"
            />
            <div v-if="!selectedLayer.length" class="center-crosshair"></div>

            <Text :state="text" @update:component-event="emitEvent" :layer="textLayer"/>

            <Brush :selected="selectedLayer" :mouse="cursor" :cursor="brushCursor" :viewport="viewport" :brushes="brushes" :state="brush" :drawing="drawing" :data="brushLayer" @update:component-event="emitEvent"></Brush>
            <Pen :mouse="cursor" :viewport="viewport" :state="pen" :path-layer="pathLayer" @update:component-event="emitEvent"/>
          </div>
          <SelectVector
              v-if="selectedLayer.length"
              :frameBox="frameBox"
              @resize="startResize"
              @rotate="startRotate"
          />
        </div>
      </div>

      <!-- Koordinatenanzeige -->
      <div class="cursor-coordinates">
        {{ `X: ${cursor.x}, Y: ${cursor.y}` }}
      </div>

      <!-- Selection Box -->
      <Selection
          :state="select"
          :shape="selectMode"
          @update:component-event="emitEvent"
      />
    </div>
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

export default defineComponent({
  name: "GridComponent",
  props: gridProps,
  components: {
    Pen,
    SelectVector,
    Guide,
    Brush,
    Text,
    Image,
    Selection
  },
  setup(props, { emit }) {
    const { canvasContainer, offset, cursor, canvasContainerStyle, handleMouseDown, handleMouseMove, zoomFaktor, emitEvent, toggleSelection, resetSelection, startRotate, startResize, updateLayer, frameBox} = gridModel(props, emit);
    return {
      canvasContainer,
      offset,
      cursor,
      canvasContainerStyle,
      handleMouseDown,
      handleMouseMove,
      zoomFaktor,
      emitEvent,
      toggleSelection,
      resetSelection,
      startRotate,
      startResize,
      updateLayer,
      frameBox
    };
  },
});
</script>

<style scoped lang="scss">
@import 'Grid.scss';
</style>