<template>
  <v-card
      v-if="state"
      class="layer-system"
      width="300"
  >
    <v-container class="layer-wrapper">
      <!-- Schließen-Button -->
      <v-btn icon size="small" class="rounded-0" elevation="0" @click="emitEvent('layer-state', false)">
        <v-icon>mdi-window-close</v-icon>
      </v-btn>
      <v-card
          class="overflow-hidden overflow-y-auto"
          max-height="300"
          height="300"
          elevation="0"
          rounded="0"
          border="0"
      >
        <!-- Layer-Liste -->
        <v-list two-line class="layer-list overflow-hidden" v-if="layers.length > 0" bg-color="transparent">
          <Drag :items="layers" :on-drop="handleDrop">
            <template #default>
              <v-list-item
                  v-for="(layer) in layers"
                  :key="layer.id"
                  :data-id="layer.id"
                  class="layer-item"
                  :class="{ selected: selectedLayer.includes(layer.id), 'dragging': windowStates.drag.value, 'not-dragging': !windowStates.drag.value }"
                  @click="toggleLayerSelection(layer.id)"
              >
                <template v-slot:append>
                  <v-icon class="cursor mr-2" :key="layer.id" color="grey" :style="!windowStates.drag.value ? 'cursor: grab;' : 'cursor: pointer;'">
                    {{ !windowStates.drag.value ? 'mdi-drag' : 'mdi-drag-variant' }}</v-icon>
                </template>

                <div class="d-flex align-baseline">
                  <v-text-field
                      v-model="layer.name"
                      clearable
                      variant="outlined"
                      clear-icon="mdi-broom"
                      :hide-details="validRule(layer.name).isValid"
                      :rules="[validRule(layer.name).rule]"
                      @blur="validRule(layer.name).isValid ? emitEvent('update-layer', layer) : ''"
                      @click.stop
                      @click:clear="layer.name = ''"
                  >
                    <template v-slot:prepend-inner>
                      <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                          <v-avatar v-bind="props" rounded="0" variant="elevated">
                            <v-img :src="layer?.url" :alt="layer.name" />
                          </v-avatar>
                        </template>
                        {{ layer.name }}
                      </v-tooltip>
                    </template>
                  </v-text-field>
                </div>
              </v-list-item>
            </template>
          </Drag>
        </v-list>
      </v-card>
      <!-- Navigation -->
      <div class="navigation-bar d-flex justify-space-between align-center px-4">
        <v-btn
            icon
            color="#DCFDD4"
            size="x-small"
            @click="emitEvent('add-layer')"
        >
          <v-icon color="black">mdi-plus</v-icon>
        </v-btn>
        <v-btn
            icon
            color="#DCFDD4"
            size="x-small"
            :disabled="!layers.length"
            @click="emitEvent('preview-layer')"
        >
          <v-icon color="black">mdi-printer</v-icon>
        </v-btn>
        <v-btn
            icon
            color="#FF516D"
            size="x-small"
            @click="emitEvent('delete-layer', selectedLayer)"
            @click.stop="selectedLayer = []"
            :disabled="!selectedLayer.length"
        >
          <v-icon color="white">mdi-delete</v-icon>
        </v-btn>
      </div>
    </v-container>
  </v-card>
</template>

<script>
import {defineComponent} from "vue";
import {layerModel, layerProps} from "@/models/layer/model";
import Drag from "@/components/Drag/Drag.vue";
import {windowStates} from "@/dataLayer/state";

export default defineComponent({
  name: "LayerComponent",
  computed: {
    windowStates() {
      return windowStates
    }
  },
  props: layerProps,
  components: {
    Drag
  },
  setup(props, { emit }) {
    const { emitEvent, validRule, selectedLayer, toggleLayerSelection, handleDrop } = layerModel(props, emit);
    return {
      emitEvent,
      validRule,
      selectedLayer,
      toggleLayerSelection,
      handleDrop,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer";
</style>