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
    />
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {
  layer3DModel,
  layer3DProps,
} from "@/models/layer/3D/model";

export default defineComponent({
  name: "Layer3D",
  props: layer3DProps,
  emits: [
    "click",
    "component-event",
  ],
  setup(props, { emit }) {
    return {
      ...layer3DModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer3D";
</style>