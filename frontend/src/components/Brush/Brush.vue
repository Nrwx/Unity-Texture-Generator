<template>
  <div v-show="state" class="brush-canvas-wrapper">
    <canvas
        ref="canvas"
        class="brush-canvas"
        :id="canvasId"
        :width="selectedLayer?.width || 0"
        :height="selectedLayer?.height || 0"
        :style="{
            opacity: selectedLayer?.opacity || 0,
            zIndex: selectedLayer?.order || 0,
            position: 'absolute',
            transform: buildMatrix(selectedLayer?.matrix || {})
          }"
    />
    <Menu
        :visible="visible"
        :menuPos="menuPos"
        :settings="data"
        :brushes="brushes"
        @update:menu-event="emitEvent"
    />
    <img
        v-if="cursor !== ''"
        :src="cursor"
        alt="Maskierter Pinsel"
        class="custom-cursor"
        :style="setCursor"
    />
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import { brushModel, brushProps } from '@/models/brush/model';
import Menu from "@/components/Brush/Menu";

export default defineComponent({
  name: 'BrushComponent',
  components: { Menu },
  props: brushProps,
  setup(props, { emit }) {
    const { canvas, canvasStyle, visible, menuPos, emitEvent, buildMatrix, setCursor} = brushModel(props, emit);

    return {
      canvas,
      canvasStyle,
      visible,
      menuPos,
      emitEvent,
      buildMatrix,
      setCursor
    };
  }
});
</script>

<style scoped lang="scss">
@import "./_Brush";
</style>