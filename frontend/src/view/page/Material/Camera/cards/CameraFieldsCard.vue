<template>
  <section class="engine-camera-card engine-camera-card__fields">
    <label v-for="field in fields" :key="field.key">
      <span>{{ field.label }}</span>
      <input
          type="number"
          :step="field.step"
          :min="field.min"
          :max="field.max"
          :value="fieldValue(field.key)"
          @input="$emit('field', field.key, $event.target.value)"
      />
    </label>
  </section>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "CameraFieldsCard",
  props: {
    fields: { type: Array, required: true },
    fieldValue: { type: Function, required: true },
  },
  emits: ["field"],
});
</script>
