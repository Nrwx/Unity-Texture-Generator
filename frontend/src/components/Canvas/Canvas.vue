<template>
  <canvas
      v-show="config.preview"
      ref="container"
      :width="viewport.width"
      :height="viewport.height"
      :id="target"
      class="relative"
  ></canvas>
  <canvas
      v-show="state && !config.preview"
      ref="canvas"
      :width="viewport.width"
      :height="viewport.height"
      :id="id"
      class="relative"
  ></canvas>
</template>

<script>
import { defineComponent } from "vue";
import {canvasModel, canvasProps} from "@/models/canvas/model";

export default defineComponent({
  name: "CanvasComponent",
  props: canvasProps,
  setup(props, { emit }) {
    const model = canvasModel(props, emit);
    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Canvas";
</style>
