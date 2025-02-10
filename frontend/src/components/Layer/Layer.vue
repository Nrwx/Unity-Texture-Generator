<template>
  <v-card
      class="layer-system"
      :layers="layers"
      v-if="state"
      width="300"
  >
    <v-container class="layer-wrapper">
      <v-card
          class="overflow-hidden overflow-y-auto"
          max-height="300"
          height="300"
          elevation="0"
          rounded="0"
          border="0"
      >
        <!-- Layer-Liste -->
        <v-list two-line class="layer-list" v-if="layers.length > 0" bg-color="transparent">
          <v-list-item-group>
            <v-list-item
                v-for="(layer, index) in layers"
                :key="index"
                class="layer-item"
                :class="{ selected: selectedLayers.includes(layer.id) }"
            >
              <v-list-item-content class="d-flex align-baseline">
                <v-text-field
                    v-model="layer.name"
                    clearable
                    :disabled="selectedLayers.includes(layer.id)"
                    variant="outlined"
                    clear-icon="mdi-broom"
                    :hide-details="validRule(layer.name).isValid"
                    :rules="[validRule(layer.name).rule]"
                    @blur="validRule(layer.name).isValid ? emitEvent('update-layer', layer) : ''"
                    @click:clear="layer.name = ''"
                >
                  <template v-slot:prepend-inner>
                    <v-tooltip location="bottom">
                      <template v-slot:activator="{ props }">
                        <v-avatar v-bind="props" rounded="0" variant="elevated">
                          <v-img
                              :src="layer?.url"
                              :alt="layer.name"
                          />
                        </v-avatar>
                      </template>

                      {{layer.name}}
                    </v-tooltip>
                  </template>
                </v-text-field>
                <v-checkbox
                    v-model="selectedLayers"
                    :value="layer.id"
                    class="layer-checkbox"
                    hide-details
                ></v-checkbox>
              </v-list-item-content>
            </v-list-item>
          </v-list-item-group>
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
            @click="emitEvent('preview-layer')"
        >
          <v-icon color="black">mdi-eye</v-icon>
        </v-btn>
        <v-btn
            icon
            color="#FF516D"
            size="x-small"
            @click="emitEvent('delete-layer', selectedLayers)"
            @click.stop="selectedLayers = []"
            :disabled="selectedLayers.length === 0"
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

export default defineComponent({
  name: "TaskbarItem",
  props: layerProps,
  setup(props, { emit }) {
    const { emitEvent, validRule, selectedLayers } = layerModel(props, emit);
    return {
      selectedLayers,
      emitEvent,
      validRule,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer";
</style>