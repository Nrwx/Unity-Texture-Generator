<template>
  <div class="gradient-container relative w-h overflow-hidden">
    <!-- SVG-Farbverlauf -->
    <svg class="gradient-svg absolute w-h cursor-none" viewBox="0 0 50 50" preserveAspectRatio="none">
      <defs>
        <linearGradient
            :id="gradientId"
            x1="100%" y1="0%" x2="0%" y2="0%"
            gradientUnits="userSpaceOnUse"
        >
          <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="100 0"
              to="-100 0"
              dur="8s"
              repeatCount="indefinite"
          />
          <stop
              v-for="(color, i) in lightSteps"
              :key="i"
              :offset="`${(i / (lightSteps.length - 1)) * 100}%`"
          >
            <animate
                attributeName="stop-color"
                :values="getAnimatedStops(color, 'light')"
                dur="6s"
                repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
        <linearGradient :id="gradientId" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop v-for="(color, i) in lightSteps" :key="i" :offset="`${(i / (lightSteps.length - 1)) * 100}%`">
            <animate
                attributeName="stop-color"
                :values="getAnimatedStops(color, 'light')"
                dur="6s"
                repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" :fill="`url(#${gradientId})`" />
    </svg>

    <!-- Dunkler SVG-Verlauf, schnellere Animation -->
    <svg class="gradient-svg dark" viewBox="0 0 50 50" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`${gradientId}-dark`" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop v-for="(color, i) in darkSteps" :key="i" :offset="`${(i / (darkSteps.length - 1)) * 100}%`">
            <animate
                attributeName="stop-color"
                :values="getAnimatedStops(color, 'dark')"
                dur="3s"
                repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" :fill="`url(#${gradientId}-dark)`" />
    </svg>

    <!-- Overlay (Deckkraftverlauf) -->
    <div class="overlay-gradient absolute"></div>

    <!-- Slot für Card-Inhalt -->
    <div class="card-content relative">
      <slot />
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {gradientModel, gradientProps} from "@/models/background/gradient/model";

export default defineComponent({
  name: "GradientComponent",
  props: gradientProps,
  setup(props) {
    const { gradientId, lightSteps, darkSteps, getAnimatedStops } = gradientModel(props);
    return {
      gradientId,
      lightSteps,
      darkSteps,
      getAnimatedStops
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Gradient";
</style>