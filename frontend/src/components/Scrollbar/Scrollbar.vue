<template>
  <div ref="tr" :id="trId" class="scrollbar-track" :data-active="active">
    <div ref="th" :id="thId" class="scrollbar-thumb" :class="{ wave: 'wave' }"></div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {scrollbarModel, scrollbarProps} from "@/models/scrollbar/model";

export default defineComponent({
  name: "ScrollbarComponent",
  props: scrollbarProps,
  setup(props, { emit }) {
    const model = scrollbarModel(props, emit);
    return { ...model };
  },
});
</script>

<style scoped lang="scss">
@use "./_Scrollbar";
</style>
