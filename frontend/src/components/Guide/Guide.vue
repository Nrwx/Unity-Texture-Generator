<template>
  <!-- X-Achse Ruler -->
  <div
      class="ruler x-axis d-flex justify-center align-center"
      @mousedown="startGuide('horizontal', $event)"
  >
    <div
        class="ruler-track x-track"
        :style="{
          width: `${settings.width * container.a}px`,
          transform: `translateX(${container.x}px)`
        }"
    >
      <div
          v-for="mark in columnPositions"
          :key="`x-${mark.value}`"
          class="ruler-mark x-mark"
          :class="{
            'is-major': mark.major,
            'is-minor': !mark.major
          }"
          :style="{
            left: `${mark.value * container.a}px`
          }"
      >
        <span v-if="mark.label">{{ mark.label }}</span>
      </div>
    </div>
  </div>

  <!-- Y-Achse Ruler -->
  <div
      class="ruler y-axis d-flex justify-center align-center"
      @mousedown="startGuide('vertical', $event)"
  >
    <div
        class="ruler-track y-track"
        :style="{
          height: `${settings.height * container.d}px`,
          transform: `translateY(${container.y}px)`
        }"
    >
      <div
          v-for="mark in rowPositions"
          :key="`y-${mark.value}`"
          class="ruler-mark y-mark"
          :class="{
            'is-major': mark.major,
            'is-minor': !mark.major
          }"
          :style="{
            top: `${mark.value * container.d}px`
          }"
      >
        <span v-if="mark.label">{{ mark.label }}</span>
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
import { guideProps, guideModel } from "@/models/guide/model";

export default defineComponent({
  name: "GuideComponent",
  props: guideProps,
  setup(props, { emit }) {
    const model = guideModel(props, emit);

    return {
      ...model
    };
  }
});
</script>

<style lang="scss">
@import "_Guide.scss";
</style>