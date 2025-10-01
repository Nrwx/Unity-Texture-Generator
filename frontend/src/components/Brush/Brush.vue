<template>
  <div  v-show="state" class="brush-canvas-wrapper">
    <canvas
        ref="canvas"
        class="brush-canvas"
        :id="canvasId"
        :width="layer?.width || 0"
        :height="layer?.height || 0"
        :style="{
            opacity: layer?.opacity || 0,
            zIndex: layer?.order || 0,
            position: 'absolute',
            top: '0',
            left: '0',
            transform: `matrix(${layer?.matrix?.a || 0}, ${layer?.matrix?.b || 0}, ${layer?.matrix?.c || 0}, ${layer?.matrix?.d || 0}, ${layer?.matrix?.x || 0}, ${layer?.matrix?.y || 0}) rotate(${layer?.matrix?.rotate || 0}deg)`
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
    const { canvas, visible, menuPos, emitEvent, setCursor} = brushModel(props, emit);

    return {
      canvas,
      visible,
      menuPos,
      emitEvent,
      setCursor
    };
  }
});
</script>

<style scoped lang="scss">
@import "./_Brush";
</style>