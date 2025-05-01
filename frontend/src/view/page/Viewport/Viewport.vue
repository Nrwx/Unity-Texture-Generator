<template>
  <v-dialog v-model="state" fullscreen persistent>
    <v-card>
      <v-app-bar color="primary" dark>
        <v-toolbar-title>Create New Viewport</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon @click="emitEvent('viewport-state', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-app-bar>

      <v-card-text class="d-flex align-center justify-center">
        <v-container fluid>
          <v-row>
            <!-- Category Card -->
            <v-col cols="4">
              <v-card class="pa-4" outlined>
                <v-card-title class="text-h6">Design Modes</v-card-title>
                <v-divider class="my-2"></v-divider>
                <v-list dense>
                  <v-list-item
                      v-for="preset in presets"
                      :key="preset.title"
                      @click="selectPreset(preset)"
                      :class="{ 'selected-preset': preset.mode === settings.mode }"
                  >
                    <v-icon color="primary">mdi-monitor-cellphone</v-icon>
                    <v-list-item-title>{{ preset.title }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>

            <!-- Form Card -->
            <v-col cols="8">
              <v-card class="pa-4" outlined>
                <v-form :id="settings.id" @submit.prevent="emitEvent('viewport-setup', settings)">
                  <v-text-field
                      v-model="settings.title"
                      label="Project Name (Optional)"
                      class="mb-4"
                  />

                  <v-text-field
                      v-model.number="settings.width"
                      label="Width"
                      type="number"
                      class="mb-4"
                  />

                  <v-text-field
                      v-model.number="settings.height"
                      label="Height"
                      type="number"
                      class="mb-4"
                  />

                  <v-btn type="submit" color="primary" block>Create Viewport</v-btn>
                </v-form>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { defineComponent } from "vue";
import {viewportModel, viewportProps} from "@/view/models/page/viewport/model";

export default defineComponent({
  name: "ViewportComponent",
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
.v-container {
  background-color: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.selected-preset {
  background-color: #e3f2fd;
  border-radius: 8px;
  transition: background-color 0.3s ease;
}
.selected-preset:hover {
  background-color: #bbdefb;
}
</style>