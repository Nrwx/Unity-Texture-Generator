<template>
  <section class="engine-camera-card engine-camera-card__views">
    <button v-for="view in views" :key="view.key" type="button" @click="$emit('view', view.key)">
      <v-icon size="14">{{ view.icon }}</v-icon>
      {{ view.label }}
    </button>
  </section>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "CameraViewsCard",
  props: {
    views: { type: Array, required: true },
  },
  emits: ["view"],
});
</script>
