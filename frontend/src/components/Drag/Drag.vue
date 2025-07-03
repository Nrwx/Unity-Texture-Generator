<template>
  <div
      ref="dragRef"
      class="drag-container d-flex flex-wrap flex-column-reverse"
  >
    <!-- Ghost Element -->
    <template v-if="dragData.ghost.value">
      <div class="ghost-item d-flex align-center" :style="{top: `${dragData.transform.value.y}px`,left: `${dragData.transform.value.x}px`}">
        <v-avatar rounded="0" variant="elevated" class="mr-2">
          <v-img :src="dragData.ghost.value.url" :alt="dragData.ghost.value.name" />
        </v-avatar>
        <span class="ghost-name">{{ dragData.ghost.value.name }}</span>
      </div>
    </template>
    <slot name="default"></slot>
  </div>
</template>

<script>
import {defineComponent} from "vue";
import {dragModel, dragProps} from "@/models/drag/model";
import {dragData} from "@/models/drag/data/model";
import {windowStates} from "@/dataLayer/state";

export default defineComponent({
  name: "DragComponent",
  props: dragProps,
  setup(props, { emit }) {
    const {dragRef, emitEvent } = dragModel(props, emit);
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
