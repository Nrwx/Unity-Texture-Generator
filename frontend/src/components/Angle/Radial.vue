<template>
  <div style="width: 60%;margin-left: auto;">
    <v-label class="text-caption mb-1 d-block">Ausrichtung (°)</v-label>
    <div class="d-flex align-center" style="gap: 8px;">
      <!-- Eingabefeld -->
      <v-text-field
          v-model.number="angle"
          type="number"
          min="0"
          max="360"
          density="compact"
          hide-details
          style="max-width: 80px;"
          @update:modelValue="emitAngle"
      />

      <!-- Winkelrad -->
      <div class="angle-picker" @click="handleClick" :style="style">
        <svg viewBox="0 0 100 100" class="pie">
          <!-- Hintergrundkreis -->
          <circle cx="50" cy="50" r="48" fill="var(--app-primary-bg)" stroke="var(--app-primary-bg)" stroke-width="1" />

          <!-- Hilfsstriche (länger) -->
          <g stroke="#888" stroke-width="1">
            <line
                v-for="deg in [0, 45, 90, 135, 180, 225, 270, 315]"
                :key="deg"
                :x1="50 + 40 * Math.cos((deg - 90) * Math.PI / 180)"
                :y1="50 + 40 * Math.sin((deg - 90) * Math.PI / 180)"
                :x2="50 + 50 * Math.cos((deg - 90) * Math.PI / 180)"
                :y2="50 + 50 * Math.sin((deg - 90) * Math.PI / 180)"
            />
          </g>

          <!-- Richtungspfeil -->
          <line
              :x2="50 + 40 * Math.cos(radian)"
              :y2="50 + 40 * Math.sin(radian)"
              x1="50"
              y1="50"
              stroke="#1976d2"
              stroke-width="4"
              stroke-linecap="round"
          />
        </svg>
      </div>
    </div>
  </div>
</template>


<script>
import { defineComponent } from "vue";
import {angleModel, angleProps} from "@/models/angle/radial/model";

export default defineComponent({
  name: "RadialComponent",
  props: angleProps,
  setup(props, { emit }) {
    const {radian, style, emitAngle, handleClick } = angleModel(props, emit);
    return {
      radian,
      style,
      emitAngle,
      handleClick
    };
  },
});
</script>

<style scoped lang="scss">
@import './_Radial';
</style>
