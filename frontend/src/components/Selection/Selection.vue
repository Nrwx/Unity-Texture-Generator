<template>
  <div
      class="absolute w-h"
      v-if="state"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      tabindex="0"
  >
    <!-- Auswahlrahmen via SVG -->
    <svg v-if="svgStyle.left" class="absolute pointer-events-none" :style="svgStyle">
      <defs>
        <!-- 1. Hauptfarbverlauf Basislinie -->
        <linearGradient id="static-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#9ecfff" />
          <stop offset="50%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#9ecfff" />
        </linearGradient>

        <!-- 2. Gegendrehende Basislinie -->
        <linearGradient id="static-gradient-reverse" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="50%" stop-color="#6bb6ff" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>

        <!-- 3. Shine 1 -->
        <linearGradient id="shine-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="transparent" />
          <stop offset="50%" stop-color="rgba(255,255,255,0.9)" />
          <stop offset="100%" stop-color="transparent" />
        </linearGradient>

        <!-- 4. Shine 2 (invertiert) -->
        <linearGradient id="shine-gradient-2" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="transparent" />
          <stop offset="50%" stop-color="rgba(255,255,255,0.6)" />
          <stop offset="100%" stop-color="transparent" />
        </linearGradient>
      </defs>

      <!-- Basis-Schattenrahmen unten drunter -->
      <component
          :is="shapeTag"
          v-bind="shapeAttrs"
          fill="none"
          stroke="rgba(0, 0, 0, 0.7)"
          stroke-width="2"
          stroke-linecap="round"
      />

      <!-- Basislinie -->
      <component
          :is="shapeTag"
          v-bind="shapeAttrs"
          fill="none"
          stroke="url(#static-gradient)"
          stroke-width="2"
          stroke-dasharray="3 8"
          :stroke-dashoffset="dashOffset"
          stroke-linecap="round"
      />

      <!-- Gegendrehende Basislinie -->
      <component
          :is="shapeTag"
          v-bind="shapeAttrs"
          fill="none"
          stroke="url(#static-gradient-reverse)"
          stroke-width="2"
          stroke-dasharray="3 8"
          :stroke-dashoffset="reverseDashOffset"
          stroke-linecap="round"
          style="opacity: 0.7;"
      />

      <!-- Shine 1 -->
      <component
          :is="shapeTag"
          v-bind="shapeAttrs"
          fill="none"
          stroke="url(#shine-gradient-1)"
          stroke-width="2"
          stroke-dasharray="2 14"
          :stroke-dashoffset="shineOffset"
      />

      <!-- Shine 2 -->
      <component
          :is="shapeTag"
          v-bind="shapeAttrs"
          fill="none"
          stroke="url(#shine-gradient-2)"
          stroke-width="2"
          stroke-dasharray="2 14"
          :stroke-dashoffset="reverseShineOffset"
      />
    </svg>
    <slot />
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {selectionModel, selectionProps} from "@/models/selection/model";

export default defineComponent({
  name: "SelectionComponent",
  props: selectionProps,
  setup(props, { emit }) {
    const { emitEvent, isCircleOrEllipse, boxStyle, selecting, onMouseDown, onMouseMove, onMouseUp, onKeyDown, onKeyUp, svgStyle, shapeTag, shapeAttrs, shineOffset, dashOffset,reverseDashOffset, reverseShineOffset} = selectionModel(props, emit);
    return {
      emitEvent,
      isCircleOrEllipse,
      boxStyle,
      selecting,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onKeyDown,
      onKeyUp,
      svgStyle,
      shapeTag,
      shapeAttrs,
      shineOffset,
      dashOffset,
      reverseDashOffset,
      reverseShineOffset,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Selection.scss";
</style>
