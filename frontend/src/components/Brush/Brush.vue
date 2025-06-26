<template>
  <div v-show="state" class="brush-canvas-wrapper">
    <canvas
        ref="canvas"
        class="brush-canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
        @contextmenu.prevent="openContextMenu"
    />
    <Menu
        :visible="visible"
        :menuPos="menuPos"
        :settings="data"
        :brushes="brushes"
        @update:menu-event="emitEvent"
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
    const { canvas, visible, menuPos, onPointerDown, onPointerMove, onPointerUp, openContextMenu, onSavePreset, onUploadBrush, emitEvent,} = brushModel(props, emit);

    return {
      canvas,
      visible,
      menuPos,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      openContextMenu,
      onSavePreset,
      onUploadBrush,
      emitEvent,
    };
  }
});
</script>

<style scoped lang="scss">
@import "./_Brush";
</style>