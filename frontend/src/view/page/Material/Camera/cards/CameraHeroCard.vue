<template>
  <section class="engine-camera-card engine-camera-card--hero">
    <div class="engine-camera-card__title">
      <v-icon size="20">mdi-video-3d</v-icon>
      <div>
        <strong>{{ activeLayer?.name || "Engine View" }}</strong>
        <span>{{ camera.projection }} · {{ Math.round(Number(camera.fov || 0)) }}° · R {{ Number(orbit.radius || camera.radius || 0).toFixed(2) }}</span>
      </div>
    </div>

    <button type="button" class="engine-camera-card__status" :class="{ active: !!activeLayer }" @click="$emit('action', 'apply')">
      <span />
      {{ activeLayer ? "Save" : "No Layer" }}
    </button>
  </section>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "CameraHeroCard",
  props: {
    activeLayer: { type: Object, required: false, default: null },
    camera: { type: Object, required: true },
    orbit: { type: Object, required: true },
  },
  emits: ["action"],
});
</script>
