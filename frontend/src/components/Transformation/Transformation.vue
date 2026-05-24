<template>
  <div class="transformation-panel" :class="{ compact }">
    <section class="transformation-section">
      <header>
        <div>
          <strong>{{ activeLayer?.name || "Transformation" }}</strong>
          <small>{{ activeLayerTypeLabel }}</small>
        </div>

        <v-btn
            icon
            size="x-small"
            variant="text"
            :disabled="!activeLayer"
            @click="resetMatrix"
        >
          <v-icon size="16">mdi-restore</v-icon>
        </v-btn>
      </header>

      <div v-if="activeLayer" class="transformation-grid matrix">
        <v-text-field
            v-for="field in matrixFields"
            :key="field.key"
            :model-value="activeMatrix[field.key]"
            :label="field.label"
            type="number"
            :step="field.step"
            density="compact"
            hide-details
            @update:model-value="setMatrixField(field.key, $event)"
        />
      </div>

      <div v-else class="transformation-empty">
        <v-icon size="28">mdi-axis-arrow</v-icon>
        <span>Kein Layer ausgewaehlt</span>
      </div>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {transformationModel, transformationProps} from "@/models/canvas/transform/model";

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