<template>
  <div class="radial-wrap d-inline-block" :style="{ width: size + 'px', height: size + 'px' }" role="img" :aria-label="label">

    <template v-if="textPosition.includes('up')">
      <div class="radial-caption mb-2">
        <div class="title">{{ title }}</div>
        <div class="desc">{{ description }}</div>
      </div>
    </template>

    <svg :width="size" :height="size" viewBox="0 0 100 100">
      <defs>
        <linearGradient :id="gradId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#6dd3ff" />
          <stop offset="100%" stop-color="#6a5cff" />
        </linearGradient>
      </defs>

      <!-- background circle -->
      <circle class="bg" cx="50" cy="50" r="40" />

      <!-- animated stroke -->
      <circle
          class="progress"
          cx="50"
          cy="50"
          r="40"
          :style="progressStyle"
      />

      <!-- center label -->
      <g transform="translate(50,50)">
        <text class="value" y="-2" text-anchor="middle">{{ displayValue }}</text>
        <text class="label" y="14" text-anchor="middle">{{ smallLabel }}</text>
      </g>
    </svg>

    <template v-if="textPosition.includes('bottom')">
      <div class="radial-caption text-center mt-2">
        <div class="title">{{ title }}</div>
        <div class="desc mt-1">{{ description }}</div>
      </div>
    </template>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {radialModel, radialProps} from "@/models/bars/radial/model";

export default defineComponent({
  name: "RadialComponent",
  props: radialProps,
  setup(props, { emit }) {
    return radialModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@use "./_Radial";
</style>