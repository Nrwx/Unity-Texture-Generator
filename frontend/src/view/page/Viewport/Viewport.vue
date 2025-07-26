<template>
  <Dialog @update:component-event="emitEvent" :state="state" :data="config" :loading="loading" :theme="theme">
    <template #content>
      <v-card class="fill-height d-flex flex-column">

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
    </template>
  </Dialog>
</template>


<script>
import { defineComponent } from "vue";
import {viewportModel, viewportProps} from "@/view/models/page/viewport/model";
import Dialog from "@/components/Dialog/Dialog";

export default defineComponent({
  name: "ViewportPage",
  props: viewportProps,
  components: {
    Dialog
  },
  setup(props, { emit }) {
    const { config, presets, loading, emitEvent, selectPreset } = viewportModel(props, emit);
    return {
      config,
      presets,
      loading,
      emitEvent,
      selectPreset,
    };
  },
});
</script>

<style scoped>
</style>