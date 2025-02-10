<template>
  <div style="width: 100%; height: 100vh; background: #eee;" class="d-flex align-center justify-center">
    <div class="viewport-wrapper d-block overflow-hidden overflow-x-auto overflow-y-auto pa-8">
      <div class="ruler x-axis" :style="settings.width && settings.height ? `width: ${settings.width}px;` : ''">
        <div v-for="x in columnPositions" :key="x" class="ruler-mark" :style="{ left: `${x}px`}">
          {{ x }}
        </div>
        <div class="ruler-indicator x-indicator" :style="xIndicatorStyle"></div>
      </div>
      <div class="ruler y-axis" :style="settings.width && settings.height ? `height: ${settings.height}px` : ''">
        <div v-for="y in rowPositions" :key="y" class="ruler-mark" :style="{ top: `${y}px` }">
          {{ y }}
        </div>
        <div class="ruler-indicator y-indicator" :style="yIndicatorStyle"></div>
      </div>
      <div class="cursor-coordinates" :style="cursorStyle">
        {{ `X: ${cursorPosition.x}, Y: ${cursorPosition.y}` }}
      </div>
      <div @mousemove="updateCursorPosition" ref="canvasContainer" class="viewport-container" :style="settings.width && settings.height ? `width: ${settings.width}px; height: ${settings.height}px` : ''">
        <v-card style="position: relative" :width="settings.width" :height="settings.height">
          <template v-if="$slots.canvas">
            <slot name="canvas">{{ $slots.canvas }}</slot>
          </template>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {gridModel, gridProps} from "@/models/viewport/grid/model";

export default defineComponent({
  name: "ViewportGridComponent",
  props: gridProps,
  setup(props, { emit }) {
    const { emitEvent, canvasContainer, canvasStyle, columnPositions, rowPositions, handleZoom, layerStyle, updateCursorPosition, cursorPosition, cursorStyle, xIndicatorStyle, yIndicatorStyle, } = gridModel(props, emit);
    return {
      emitEvent,
      canvasContainer,
      canvasStyle,
      columnPositions,
      rowPositions,
      handleZoom,
      layerStyle,
      updateCursorPosition,
      cursorPosition,
      cursorStyle,
      xIndicatorStyle,
      yIndicatorStyle,

    };
  },
});
</script>

<style scoped lang="scss">
@import '_Grid.scss';
</style>