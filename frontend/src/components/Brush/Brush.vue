<template>
  <div v-show="state" class="brush-canvas-wrapper">
    <canvas
        ref="canvas"
        class="brush-canvas"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
        @contextmenu.prevent="openContextMenu"
    ></canvas>

    <!-- Kontext-Menü -->
    <Menu
        :visible="visible"
        :menuPos="menuPos"
        :settings="data"
        @update:menu-event="emitEvent"
        ref="menu"
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
    const {canvas, onMouseDown, onMouseMove, onMouseUp, visible, menuPos, openContextMenu, onSavePreset, onUploadBrush, emitEvent} = brushModel(props, emit);

    return {
      canvas,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      visible,
      menuPos,
      openContextMenu,
      onSavePreset,
      onUploadBrush,
      emitEvent
    };
  }
});
</script>

<style scoped lang="scss">
@import "./_Brush";
</style>