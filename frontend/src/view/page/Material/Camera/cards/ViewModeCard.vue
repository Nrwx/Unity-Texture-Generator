<template>
  <section class="engine-camera-card engine-camera-card__section">
    <header>
      <strong>View</strong>
      <small>{{ view.mode }}</small>
    </header>
    <div class="engine-camera-card__row">
      <button v-for="mode in modes" :key="mode.key" type="button" :class="{ active: view.mode === mode.key }" @click="$emit('mode', mode.key)">
        {{ mode.label }}
      </button>
    </div>
  </section>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "ViewModeCard",
  props: {
    view: { type: Object, required: true },
    modes: { type: Array, required: true },
  },
  emits: ["mode"],
});
</script>
