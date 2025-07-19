<template>
  <v-dialog v-model="state" fullscreen persistent :theme="theme">
    <v-card class="fill-height d-flex flex-column" :theme="theme">

      <!-- Custom Header -->
      <div class="d-flex align-center justify-space-between px-6 py-4 border-bottom">
        <h2 class="text-h6 ma-0">Create New Viewport</h2>
        <v-btn icon @click="emitEvent('viewport-state', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Main Content -->
      <div class="flex-grow-1 pa-6" :class="theme.includes('dark') ? 'bg-dark' : 'bg-light'">
        <v-row dense>

          <!-- Presets (left) -->
          <v-col cols="4">
            <div class="pa-4 border rounded">
              <h3 class="text-subtitle-1 mb-2">Design Modes</h3>
              <v-divider class="mb-2" />
              <v-list density="compact" nav>
                <v-list-item
                    v-for="preset in presets"
                    :key="preset.title"
                    @click="selectPreset(preset)"
                    :class="{ 'selected-preset': preset.mode === settings.mode }"
                    class="rounded-lg"
                >
                  <v-list-item-icon>
                    <v-icon color="primary">mdi-monitor-cellphone</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{ preset.title }}</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </div>
          </v-col>

          <!-- Form (right) -->
          <v-col cols="8">
            <div class="pa-4 border rounded">
              <v-form :id="settings.id" @submit.prevent="emitEvent('viewport-setup', settings)">
                <div class="mb-4">
                  <v-text-field
                      v-model="settings.title"
                      label="Project Name (Optional)"
                      density="compact"
                  />
                </div>

                <div class="mb-4">
                  <v-text-field
                      v-model.number="settings.width"
                      label="Width"
                      type="number"
                      density="compact"
                  />
                </div>

                <div class="mb-4">
                  <v-text-field
                      v-model.number="settings.height"
                      label="Height"
                      type="number"
                      density="compact"
                  />
                </div>

                <v-btn type="submit" block>Create Viewport</v-btn>
              </v-form>
            </div>
          </v-col>

        </v-row>
      </div>
    </v-card>
  </v-dialog>
</template>


<script>
import { defineComponent } from "vue";
import {viewportModel, viewportProps} from "@/view/models/page/viewport/model";

export default defineComponent({
  name: "ViewportPage",
  props: viewportProps,
  setup(props, { emit }) {
    const { presets, emitEvent, selectPreset } = viewportModel(props, emit);
    return {
      presets,
      emitEvent,
      selectPreset,
    };
  },
});
</script>

<style scoped>
</style>