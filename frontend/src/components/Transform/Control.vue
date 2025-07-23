<template>
  <v-card variant="flat" :theme="theme" class="viewport-controller">
    <!-- Reset Button -->
    <div class="control-header">
      <v-btn
          icon
          density="compact"
          variant="plain"
          width="24"
          height="24"
          @click="onReset"
      >
        <v-icon size="16">mdi-restore</v-icon>
      </v-btn>
    </div>

    <svg :width="size" :height="size" viewBox="0 0 125 125">
      <!-- X Ruler -->
      <g class="x-translate" @click="onClickX">
        <rect x="20" y="5" width="80" height="10" rx="2" ry="2" fill="url(#xGradient)" />
        <g v-for="i in 9" :key="'xtick-' + i">
          <line :x1="20 + i * 8" y1="5" :x2="20 + i * 8" y2="15" stroke="#444" stroke-width="0.5" />
        </g>
        <circle :cx="20 + normalizedX * 80" cy="10" r="3" fill="#66ccff" stroke="#0cf" stroke-width="1" />
      </g>

      <!-- Y Ruler -->
      <g class="y-translate" @click="onClickY">
        <rect x="5" y="20" width="10" height="80" rx="2" ry="2" fill="url(#yGradient)" />
        <g v-for="i in 9" :key="'ytick-' + i">
          <line x1="5" :y1="20 + i * 8" x2="15" :y2="20 + i * 8" stroke="#444" stroke-width="0.5" />
        </g>
        <circle cx="10" :cy="20 + normalizedY * 80" r="3" fill="#66ccff" stroke="#0cf" stroke-width="1" />
      </g>

      <!-- Compass -->
      <g class="compass" @click="onClickRotation">
        <circle cx="60" cy="60" r="20" fill="url(#compassGradient)" stroke="#666" stroke-width="1.5" />
        <circle cx="60" cy="60" r="18" fill="none" stroke="#000" stroke-opacity="0.2" stroke-width="1" />
        <line
            :x1="60"
            :y1="60"
            :x2="60 + 15 * Math.cos(toRad(data.rotation - 90))"
            :y2="60 + 15 * Math.sin(toRad(data.rotation - 90))"
            stroke="#ffcc00"
            stroke-width="2"
        />
        <text x="60" y="34" text-anchor="middle" fill="#ccc" font-size="6">N</text>
        <text x="60" y="90" text-anchor="middle" fill="#ccc" font-size="7">S</text>
        <text x="87" y="63" text-anchor="middle" fill="#ccc" font-size="7">E</text>
        <text x="33" y="63" text-anchor="middle" fill="#ccc" font-size="6">W</text>
      </g>

      <!-- Scale / Tacho -->
      <g class="scale" @click="onClickScale">
        <path
            d="M100,40 A20,20 0 0,1 100,80"
            fill="none"
            stroke="#444"
            stroke-width="4"
        />
        <line
            x1="100"
            y1="60"
            :x2="100 + 10 * Math.cos(toRad(scaleAngle))"
            :y2="60 + 10 * Math.sin(toRad(scaleAngle))"
            stroke="#00ff99"
            stroke-width="2"
        />
        <!-- Inner circle to highlight center -->
        <circle cx="100" cy="60" r="2" fill="#0f0" />
        <!-- Scale Min/Max Labels -->
        <text x="100" y="35" text-anchor="middle" font-size="8" fill="#ccc">-</text>
        <text x="100" y="90" text-anchor="middle" font-size="8" fill="#ccc">+</text>
      </g>

      <!-- SVG Gradients -->
      <defs>
        <linearGradient id="xGradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#2e2e2e" />
          <stop offset="100%" stop-color="#1e1e1e" />
        </linearGradient>
        <linearGradient id="yGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#2e2e2e" />
          <stop offset="100%" stop-color="#1e1e1e" />
        </linearGradient>
        <radialGradient id="compassGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#444" />
          <stop offset="100%" stop-color="#2a2a2a" />
        </radialGradient>
        <linearGradient id="scaleGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00ffaa" />
          <stop offset="100%" stop-color="#007766" />
        </linearGradient>
      </defs>
    </svg>
  </v-card>
</template>


<script>
import { defineComponent } from "vue";
import {controlModel, controlProps} from "@/models/transform/control/model";

export default defineComponent({
  name: "SelectionComponent",
  props: controlProps,
  setup(props, { emit }) {
    const { normalizedX, normalizedY, progressArcPath, size, toRad, scaleAngle, onClickX, onClickY, onClickScale, onClickRotation, onReset} = controlModel(props, emit);
    return {
      normalizedX,
      normalizedY,
      size,
      toRad,
      progressArcPath,
      scaleAngle,
      onReset,
      onClickX,
      onClickY,
      onClickScale,
      onClickRotation
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Control";
</style>
