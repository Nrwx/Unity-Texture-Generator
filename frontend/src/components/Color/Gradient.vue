<template>
  <v-menu
      v-model="menu"
      :close-on-content-click="false"
      max-width="420"
      @update:modelValue="handleMenuToggle"
  >
    <!-- Vorschau-Button -->
    <template #activator="{ props }">
      <v-card class="pa-0 mb-2" variant="flat">
        <v-card-subtitle>Gradient</v-card-subtitle>
        <v-card-actions>
          <v-btn
              v-bind="props"
              block
              class="rounded border mx-auto"
              :style="{ background: previewGradient, color: '#fff' }"
              height="40"
          >
            {{ previewLabel }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>

    <!-- Editor Inhalt -->
    <v-sheet elevation="0" class="px-4 py-4" max-height="400" style="overflow-y: auto;">
      <!-- Typ + Winkel als Pie inline -->
      <div class="d-flex align-center mb-4" style="gap: 8px;">
        <div class="d-flex align-center flex-wrap" style="width: 100%; max-width: 50%">
          <v-label style="width: 100%;" class="text-caption mb-1 d-block">Typ</v-label>
          <v-select
              v-model="modelValue.type"
              :items="gradientTypes"
              @update:modelValue="emitEvent(modelValue)"
              hide-details
              density="compact"
          />
        </div>
        <div style="width: 100%; max-width: 50%">
          <!-- Winkel Button (nur wenn linear) -->
          <radial
              v-if="modelValue.type === 'linear'"
              :angle="modelValue.angle"
              @update:angle="val => { modelValue.angle = val; emitEvent(modelValue); }"
          />
        </div>
      </div>

      <!-- Tabelle -->
      <div class="gradient-table mb-4">
        <!-- Tabellenkopf -->
        <div class="gradient-row gradient-header">
          <div>Farbe</div>
          <div>Offset</div>
          <div>Opacity</div>
          <div></div>
        </div>

        <!-- Datenzeilen -->
        <div
            v-for="(stop, index) in modelValue.stops"
            :key="index"
            class="gradient-row align-center"
        >
          <!-- Color -->
          <div>
            <input
                type="color"
                v-model="stop.color"
                @input="emitEvent(modelValue)"
                style="width: 36px; height: 36px; border: none;"
            />
          </div>

          <!-- Offset -->
          <div>
            <v-slider
                v-model="stop.offset"
                :min="0"
                :max="100"
                step="1"
                hide-details
                @update:modelValue="emitEvent(modelValue)"
            />
          </div>

          <!-- Opacity -->
          <div>
            <v-slider
                v-model="stop.opacity"
                :min="0"
                :max="1"
                step="0.05"
                hide-details
                @update:modelValue="emitEvent(modelValue)"
            />
          </div>

          <!-- Remove -->
          <div class="d-flex justify-end">
            <v-btn size="x-small" icon variant="text" @click="removeStop(index)">
              <v-icon size="small">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Add Button -->
      <v-btn
          size="small"
          variant="outlined"
          prepend-icon="mdi-plus"
          @click="addStop"
          block
          class="mb-4"
      >
        Farbe hinzufügen
      </v-btn>

      <!-- Vorschau -->
      <div
          class="rounded border"
          style="width: 100%; height: 40px; border: 1px solid #ccc;"
          :style="{ background: previewGradient }"
      ></div>
    </v-sheet>
  </v-menu>
</template>

<script>
import { defineComponent } from "vue";
import {gradientEditorModel, gradientEditorProps} from "@/models/color/gradient/model";
import Radial from "@/components/Angle/Radial";

export default defineComponent({
  name: "GradientEditorPage",
  props: gradientEditorProps,
  components: {
    Radial
  },
  setup(props, { emit }) {
    const {menu, previewGradient, previewLabel, handleMenuToggle, gradientTypes, addStop, removeStop, emitEvent} = gradientEditorModel(props, emit);
    return {
      menu,
      previewGradient,
      previewLabel,
      handleMenuToggle,
      gradientTypes,
      addStop,
      removeStop,
      emitEvent
    };
  },
});
</script>

<style scoped>
.gradient-table {
  display: grid;
  grid-template-columns: 80px 1fr 1fr 50px;
  gap: 8px;
}

.gradient-row {
  display: contents;
}

.gradient-header > div {
  font-weight: 500;
  padding-bottom: 4px;
}
</style>