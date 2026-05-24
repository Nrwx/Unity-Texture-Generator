<template>
  <section class="engine-camera-card engine-camera-card__row engine-camera-card__row--projection">
    <button type="button" :class="{ active: camera.projection === 'perspective' }" @click="$emit('projection', 'perspective')">
      <v-icon size="14">mdi-perspective-more</v-icon>
      Persp
    </button>
    <button type="button" :class="{ active: camera.projection === 'orthographic' }" @click="$emit('projection', 'orthographic')">
      <v-icon size="14">mdi-cube-outline</v-icon>
      Ortho
    </button>
    <button type="button" @click="$emit('action', 'frame')">
      <v-icon size="14">mdi-image-filter-center-focus</v-icon>
      Frame
    </button>
    <button type="button" @click="$emit('action', 'reset')">
      <v-icon size="14">mdi-restore</v-icon>
      Reset
    </button>
  </section>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "CameraProjectionCard",
  props: {
    camera: { type: Object, required: true },
  },
  emits: ["projection", "action"],
});
</script>
