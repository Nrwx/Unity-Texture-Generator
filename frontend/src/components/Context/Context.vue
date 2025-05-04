<template>
  <div ref="wrapper"
       v-if="state"
       style="position: fixed; z-index: 1;"
       :style="{ top: `${position.y}px`, left: `${position.x}px` }"
  >
    <List
        :data="data"
        @select="handleSelect"
        :parent-coords="position"
    />
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
    const { emitEvent, handleSelect, position, wrapper } = contextModel(props, emit);
    return {
      wrapper,
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
