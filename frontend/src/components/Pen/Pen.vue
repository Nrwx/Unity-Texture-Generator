<template>
  <div v-show="state" ref="wrapper" class="pen-canvas-wrapper">
    <canvas
        ref="canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @click="onCanvasClick"
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
      wrapper,
      canvas,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onCanvasClick,
    } = penModel(props, emit);

    return {
      wrapper,
      canvas,
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
