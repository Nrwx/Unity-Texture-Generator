<template>
  <!-- X-Achse Ruler -->
  <div class="ruler x-axis d-flex" @mousedown="startGuide('horizontal', $event)" :style="{ width: `calc(100% + ${settings.width * zoomFaktor}px)` }">
    <div class="d-flex align-center ma-auto" style="height: 100%;" :style="{ width: `${settings.width * zoomFaktor}px`, transform: `translateX(${offset.x}px)` }">
      <div
          v-for="x in columnPositions"
          :key="x"
          class="ruler-mark"
          :style="{ width: `${50 * zoomFaktor}px` }"
      >
        {{ Math.round(x) }}
      </div>
    </div>
  </div>

  <!-- Y-Achse Ruler -->
  <div class="ruler y-axis d-flex" @mousedown="startGuide('vertical', $event)" :style="{ height: `calc(100% + ${settings.height * zoomFaktor}px)` }">
    <div class="d-flex flex-column align-center ma-auto" style="width: 100%;" :style="{ height: `${settings.height * zoomFaktor}px`, transform: `translateY(${offset.y}px)` }">
      <div
          v-for="y in rowPositions"
          :key="y"
          class="ruler-mark"
          :style="{ height: `${50 * zoomFaktor}px` }"
      >
        {{ Math.round(y) }}
      </div>
    </div>
  </div>

  <!-- Guides -->
  <div
      v-for="guide in guides"
      :key="guide.id"
      class="guide"
      :style="getGuideStyle(guide)"
      @mousedown="startDraggingGuide(guide, $event)"
  ></div>
</template>

<script>
import { defineComponent } from "vue";
import {guideProps, guideModel} from "@/models/guide/model";

export default defineComponent({
  name: "GuideComponent",
  props: guideProps,
  setup(props, { emit }) {
    const {rowPositions, columnPositions, startGuide, startDraggingGuide, getGuideStyle} = guideModel(props, emit);
    return {
      rowPositions,
      columnPositions,
      startGuide,
      startDraggingGuide,
      getGuideStyle
    };
  },
});
</script>

<style lang="scss">
@import '_Guide.scss';
</style>