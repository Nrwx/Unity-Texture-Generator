<template>
  <div
      class="canvas-material-layer"
      :hidden="hidden"
      :class="{ selected }"
      @click="$emit('click', $event)"
  >
    <canvas
        ref="canvasRef"
        class="canvas-material-canvas"
        v-show="activeRenderer !== 'WEBGL2'"
    />
    <canvas
        ref="webglCanvasRef"
        class="canvas-material-canvas"
        v-show="activeRenderer === 'WEBGL2'"
    />

    <div
        v-if="lightOverlay.visible"
        class="canvas-material-light-overlay"
        :style="lightOverlay.style"
    >
      <div class="canvas-material-light-range" />
      <div class="canvas-material-light-line" />
      <div v-if="lightOverlay.isSpot" class="canvas-material-light-cone"><span /></div>
      <div class="canvas-material-light-glyph" :class="`type-${lightOverlay.type}`"><span /></div>
      <div class="canvas-material-light-origin" />
      <div class="canvas-material-light-metrics">
        <small v-for="metric in lightOverlay.metrics" :key="metric">{{ metric }}</small>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {layer3DModel, layer3DProps} from "@/models/layer/3D/model";

export default defineComponent({
  name: "Layer3D",
  props: layer3DProps,
  setup(props, { emit }) {
    return { ...layer3DModel(props, emit) };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer3D";
</style>
