<template>
  <svg
      class="selection-vector-box"
      :style="svgStyle"
      :viewBox="viewBox"
      preserveAspectRatio="none"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#9ecfff" />
        <stop offset="50%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#9ecfff" />
      </linearGradient>

      <linearGradient :id="reverseGradientId" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="50%" stop-color="#6bb6ff" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>

      <linearGradient :id="shineGradientId" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="transparent" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.9)" />
        <stop offset="100%" stop-color="transparent" />
      </linearGradient>

      <linearGradient :id="reverseShineGradientId" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="transparent" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.6)" />
        <stop offset="100%" stop-color="transparent" />
      </linearGradient>
    </defs>

    <component
        :is="vectorTag"
        v-bind="shadowAttrs"
    />

    <component
        :is="vectorTag"
        v-bind="baseAttrs"
    />

    <component
        :is="vectorTag"
        v-bind="reverseAttrs"
    />

    <component
        :is="vectorTag"
        v-bind="shineAttrs"
    />

    <component
        :is="vectorTag"
        v-bind="reverseShineAttrs"
    />
  </svg>
</template>

<script>
import { defineComponent } from "vue";
import {
  selectionVectorBoxModel,
  selectionVectorBoxProps,
} from "@/models/selection/box/model";

export default defineComponent({
  name: "SelectionVectorBox",
  props: selectionVectorBoxProps,
  setup(props) {
    const model = selectionVectorBoxModel(props);

    return {
      ...model,
    };
  },
});
</script>

<style scoped lang="scss">
.selection-vector-box {
  pointer-events: none;
  overflow: visible;
}
</style>