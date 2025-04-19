<template>
  <div ref="wrapper" class="pointer-events-auto"
       v-if="visible"
       style="position: fixed; z-index: 9999;"
       :style="{ top: `${position.y}px`, left: `${position.x}px` }"
  >
    <v-scale-transition>
      <List
          :data="data"
          @select="handleSelect"
          :parent-coords="position"
      />
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
    const { emitEvent, handleSelect, visible, position, wrapper } = contextModel(props, emit);
    return {
      wrapper,
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
