<template>
  <div ref="wrapper" :id="wrapperId" v-show="state" class="path-canvas-wrapper">
    <canvas ref="canvas" :id="canvasId" class="preview-canvas" />
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {pathDragModel, pathDragProps} from "@/models/path/drag/model";

export default defineComponent({
  name: "PathDragComponent",
  props: pathDragProps,
  setup(props, { emit }) {
    const { wrapper, wrapperId, canvas, canvasId } = pathDragModel(props, emit);
    return {
      wrapper,
      wrapperId,
      canvas,
      canvasId,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Drag";
</style>
