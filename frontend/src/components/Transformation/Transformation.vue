<template>
  <div class="transformation-panel" :class="{ compact }">
    <section class="transformation-section">
      <header class="transformation-header">
        <div>
          <strong>{{ activeLayer?.name || "Transformation" }}</strong>
          <small>{{ activeLayerTypeLabel }}</small>
        </div>

        <button
            type="button"
            class="transformation-reset"
            :disabled="!activeLayer"
            @click="resetMatrix"
        >
          <v-icon size="16">mdi-restore</v-icon>
        </button>
      </header>

      <div
          v-if="activeLayer"
          class="transformation-grid matrix"
      >
        <label
            v-for="field in matrixFields"
            :key="field.key"
            class="transformation-field"
        >
          <span>{{ field.label }}</span>
          <input
              :value="activeMatrix[field.key]"
              type="number"
              :step="field.step"
              @input="setMatrixField(field.key, $event.target.value)"
          />
        </label>
      </div>

      <div
          v-else
          class="transformation-empty"
      >
        <v-icon size="28">mdi-axis-arrow</v-icon>
        <span>Kein Layer ausgewaehlt</span>
      </div>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { transformationModel, transformationProps } from "@/models/canvas/transform/model";

export default defineComponent({
  name: "TransformationPanel",
  props: transformationProps,
  setup(props, { emit }) {
    return {
      ...transformationModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Transformation";
</style>