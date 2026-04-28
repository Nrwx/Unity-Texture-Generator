<template>
  <div v-show="state" class="brush-canvas-wrapper absolute inset w-h">
    <canvas
        ref="canvas"
        class="brush-canvas absolute"
        :id="canvasId"
        :width="selectedLayer?.width || 0"
        :height="selectedLayer?.height || 0"
        :style="{
            opacity: selectedLayer?.opacity || 0,
            zIndex: selectedLayer?.order || 0,
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
        class="brush-cursor absolute cursor-none"
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