<template>
  <div class="abar w-100">
    <div class="abar-head d-flex justify-space-between align-center">
      <div class="title">{{ title }}</div>
      <div class="right d-flex align-center ga-2">
        <div v-if="suffix" class="suffix">{{ suffix }}</div>
        <div class="percent">{{ Math.round(percent) }}%</div>
      </div>
    </div>

    <div class="abar-track relative overflow-hidden mt-2" role="progressbar" :aria-valuenow="Math.round(percent)" aria-valuemin="0" aria-valuemax="100">
      <div class="abar-fill h-100" :style="fillStyle"></div>
      <div class="spark absolute" :style="sparkStyle"></div>
    </div>

    <div class="abar-meta d-flex justify-space-between mt-2">
      <div class="desc">{{ description }}</div>
      <div class="meta-right">{{ metaText }}</div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {barModel, barProps} from "@/models/bars/bar/model";

export default defineComponent({
  name: "BarComponent",
  props: barProps,
  setup(props, { emit }) {
    return barModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@use "./_Bar";
</style>
