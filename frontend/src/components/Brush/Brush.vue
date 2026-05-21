<template>
  <div v-show="state" class="brush-canvas-wrapper absolute inset w-h">
    <div
        class="brush-layer-wrapper absolute"
        :style="{
            width: `${selectedLayer?.width || 0}px`,
            height: `${selectedLayer?.height || 0}px`,
            opacity: selectedLayer?.opacity || 0,
            zIndex: selectedLayer?.order || 0,
            transform: buildMatrix(selectedLayer?.matrix || {}),
            transformOrigin: 'center center'
        }"
    >
      <canvas
          ref="canvas"
          class="brush-canvas absolute"
          :id="canvasId"
          :width="selectedLayer?.width || 0"
          :height="selectedLayer?.height || 0"
          :style="{
              left: '0px',
              top: '0px',
              width: `${selectedLayer?.width || 0}px`,
              height: `${selectedLayer?.height || 0}px`
          }"
      />
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import { brushModel, brushProps } from '@/models/brush/model';

export default defineComponent({
  name: 'BrushComponent',
  props: brushProps,
  setup(props, { emit }) {
    const model = brushModel(props, emit);

    return {
      ...model
    };
  }
});
</script>

<style scoped lang="scss">
@use "./_Brush";
</style>