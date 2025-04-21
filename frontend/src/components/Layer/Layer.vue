<template>
  <v-card
      v-if="state"
      class="layer-system"
      width="340"
  >
    <v-container class="layer-wrapper">
      <!-- Schließen-Button -->
      <v-btn icon size="small" class="rounded-0" elevation="0" @click="emitEvent('layer-state', false)">
        <v-icon>mdi-window-close</v-icon>
      </v-btn>
      <v-tabs
          v-model="tabIndex"
          class="tab-navigation"
          background-color="primary"
          dark
          grow
          height="32px"
          align="center"
      >
        <v-tab min-width="16" min-height="16" height="24" width="16" max-width="16" max-height="24" v-for="(tab, index) in tabs" :key="tab.index" @click="handleTabEmit(index)">
          <v-icon size="16">{{ tab.icon }}</v-icon>
          <span class="text-subtitle-2">{{ tab.name }}</span>
        </v-tab>
      </v-tabs>
      <!-- Global Opacity Control -->
      <v-row
          class="px-4 pt-2"
          align="center"
          dense
      >
        <v-col cols="auto" class="text-caption font-weight-medium">Deckkraft:</v-col>
        <v-col cols="6">
          <v-slider
              v-model="globalOpacity"
              min="0"
              max="100"
              step="1"
              :disabled="!selectedLayer.length"
              density="compact"
              hide-details
              @click.stop="updateOpacity"
          />
        </v-col>
        <v-col cols="auto" class="text-caption">{{ globalOpacity }}%</v-col>
      </v-row>
      <v-card
          class="overflow-hidden overflow-y-auto"
          max-height="300"
          height="300"
          elevation="0"
          rounded="0"
          border="0"
      >
        <div v-for="(tab, index) in tabs" :key="tab.name" v-show="tabIndex === index">
          <!-- Layer-Liste -->
          <v-list density="comfortable" two-line class="layer-list overflow-hidden" v-if="tabIndex === 0 && layers.length > 0" bg-color="transparent">
            <Drag :items="layers" :on-drop="handleDrop">
              <template #default>
                <v-list-item
                    v-for="(layer) in layers"
                    :key="layer.id"
                    :disabled="windowStates.drag.value && dragId === layer.id"
                    :data-id="layer.id"
                    class="layer-item"
                    :class="{selected: selectedLayer.includes(layer.id),dragging: windowStates.drag.value && dragId === layer.id,'not-dragging': windowStates.drag.value && dragId !== layer.id}"
                    @click="toggleLayerSelection(layer.id, layer.opacity)"
                >
                  <template v-slot:prepend>
                    <v-icon color="grey" size="x-small" @click.stop="emitEvent('hide-layer', layer)">
                      {{ layer?.hidden === 1 ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                  </template>

                  <template v-slot:append>
                    <v-icon class="cursor" color="grey">
                      {{ windowStates.drag.value && dragId === layer.id ? 'mdi-drag-variant' : 'mdi-drag' }}</v-icon>
                  </template>

                  <div class="d-flex align-baseline">
                    <v-text-field
                        v-model="layer.name"
                        clearable
                        variant="outlined"
                        clear-icon="mdi-broom"
                        min-width="160"
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
          <Channel v-if="tabIndex === 1 && channel.length > 0" :data="channel"/>
        </div>
      </v-card>
      <!-- Navigation -->
      <div class="navigation-bar d-flex justify-space-between align-center px-4" v-if="tabIndex === 0">
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
import Channel from "@/components/Channel/Channel.vue";
import channel from "@/components/Channel/Channel.vue";

export default defineComponent({
  name: "LayerComponent",
  computed: {
    channel() {
      return channel
    },
    windowStates() {
      return windowStates
    }
  },
  props: layerProps,
  components: {
    Drag,
    Channel
  },
  setup(props, { emit }) {
    const { emitEvent, validRule, selectedLayer, toggleLayerSelection, handleDrop, dragId, hiddenState, tabs, tabIndex, handleTabEmit, globalOpacity, updateOpacity } = layerModel(props, emit);
    return {
      emitEvent,
      validRule,
      selectedLayer,
      toggleLayerSelection,
      handleDrop,
      dragId,
      hiddenState,
      tabs,
      tabIndex,
      handleTabEmit,
      globalOpacity,
      updateOpacity
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer";
</style>