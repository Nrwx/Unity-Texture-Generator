<template>
  <canvas
      v-show="state"
      ref="canvas"
      :id="id"
      class="d-block"
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
