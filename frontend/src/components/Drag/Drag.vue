<template>
  <div
      class="drag-container d-flex flex-wrap flex-column-reverse"
      @touchstart.passive="startDrag"
      @touchend="endDrag"
      @mousedown="startDrag"
      @mouseup="endDrag"
  >
    <slot name="default"></slot>
  </div>
</template>

<script>
import {defineComponent} from "vue";
import {dragModel, dragProps} from "@/models/drag/model";

export default defineComponent({
  name: "DragComponent",
  props: dragProps,
  setup(props, { emit }) {
    const { emitEvent, startDrag, endDrag } = dragModel(props, emit);
    return {
      emitEvent,
      startDrag,
      endDrag
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Drag.scss";
</style>
