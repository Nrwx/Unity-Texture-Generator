<template>
  <div v-show="state" class="pen-canvas-wrapper" @click="onWrapperClick">
    <canvas
        ref="canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @click="onCanvasClick"
        class="border border-gray-400 rounded-lg"
    ></canvas>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import {penModel, penProps} from '@/models/pen/model';

export default defineComponent({
  name: 'PenComponent',
  props: penProps,
  setup(props, { emit }) {
    const {
      canvas,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onCanvasClick,
      onWrapperClick,
    } = penModel(props, emit);

    return {
      canvas,
      onWrapperClick,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onCanvasClick,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Pen";
</style>
