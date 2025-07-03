<template>
  <svg
      :width="frameBox.width"
      :height="frameBox.height"
      :style="{
      position: 'absolute',
      top: frameBox.top + 'px',
      left: frameBox.left + 'px',
      pointerEvents: 'none',
      zIndex: 9999
    }"
  >
    <rect
        x="0"
        y="0"
        :width="frameBox.width"
        :height="frameBox.height"
        fill="none"
        stroke="#00aaff"
        stroke-width="4"
        stroke-dasharray="4"
    />

    <!-- Resize Handles -->
    <circle class="resize-handle" cx="0" cy="0" r="8" @mousedown="onResize('top-left', $event)" />
    <circle class="resize-handle" :cx="frameBox.width" cy="0" r="8" @mousedown="onResize('top-right', $event)" />
    <circle class="resize-handle" cx="0" :cy="frameBox.height" r="8" @mousedown="onResize('bottom-left', $event)" />
    <circle class="resize-handle" :cx="frameBox.width" :cy="frameBox.height" r="8" @mousedown="onResize('bottom-right', $event)" />

    <!-- Rotate Handles -->
    <circle class="rotate-handle" :cx="frameBox.width / 2" cy="0" r="6" @mousedown="onRotate('top', $event)" />
    <circle class="rotate-handle" :cx="frameBox.width / 2" :cy="frameBox.height" r="6" @mousedown="onRotate('bottom', $event)" />
    <circle class="rotate-handle" cx="0" :cy="frameBox.height / 2" r="6" @mousedown="onRotate('left', $event)" />
    <circle class="rotate-handle" :cx="frameBox.width" :cy="frameBox.height / 2" r="6" @mousedown="onRotate('right', $event)" />

    <!-- Center -->
    <circle class="center-crosshair" :cx="frameBox.width / 2" :cy="frameBox.height / 2" r="6" fill="#00aaff" />
  </svg>
</template>

<script>
import { defineComponent } from "vue";
import {selectVectorModel, selectVectorProps} from "@/models/layer/select/model";

export default defineComponent({
  name: "LayerSelectVector",
  props: selectVectorProps,
  setup(props, { emit }) {
    const { onResize, onRotate} = selectVectorModel(props, emit);
    return {
      onResize,
      onRotate
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Select';
</style>