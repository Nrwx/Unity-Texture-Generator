<template>
  <div ref="wrapper" class="fixed top-0 left-0 z-[9999] pointer-events-none">
    <v-scale-transition>
      <div
          v-if="visible"
          class="absolute pointer-events-auto"
          :style="{ top: `${position.y}px`, left: `${position.x}px` }"
      >
        <List
            :data="data"
            @select="handleSelect"
            :parent-coords="position"
        />
      </div>
    </v-scale-transition>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {contextModel, contextProps} from "@/models/context/model";
import List from './List.vue'

export default defineComponent({
  name: "ContextComponent",
  props: contextProps,
  components: {
    List
  },
  setup(props, { emit }) {
    const { emitEvent, handleSelect, visible, position } = contextModel(props, emit);
    return {
      visible,
      position,
      emitEvent,
      handleSelect,
    };
  },
});
</script>

<style lang="scss">
@import '_Context.scss';
</style>
