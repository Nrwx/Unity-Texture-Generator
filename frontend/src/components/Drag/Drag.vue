<template>
  <div
      ref="dragRef"
      class="drag-container"
  >
    <slot name="default"></slot>
  </div>

  <teleport to="body">
    <template v-if="dragData.ghost.value">
      <div
          class="ghost-item"
          :style="{
          top: `${dragData.transform.value.y}px`,
          left: `${dragData.transform.value.x}px`
        }"
      >
        <div class="ghost-thumb">
          <img
              v-if="dragData.ghost.value.thumbnail || dragData.ghost.value.url"
              :src="dragData.ghost.value.thumbnail || dragData.ghost.value.url"
              :alt="dragData.ghost.value.name"
          />
          <v-icon v-else size="18">mdi-layers-outline</v-icon>
        </div>

        <span class="ghost-name">
          {{ dragData.ghost.value.name }}
        </span>
      </div>
    </template>
  </teleport>
</template>

<script>
import { defineComponent } from "vue";
import { dragModel, dragProps } from "@/models/drag/model";
import { dragData } from "@/models/drag/data/model";
import { windowStates } from "@/dataLayer/state";

export default defineComponent({
  name: "DragComponent",
  props: dragProps,
  setup(props, { emit }) {
    const { dragRef, emitEvent } = dragModel(props, emit);

    return {
      dragRef,
      emitEvent,
      dragData,
      windowStates,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Drag.scss";
</style>