<template>
  <v-card
      v-if="state"
      class="layer-system"
      width="360"
      :theme="theme"
  >
    <v-container class="layer-wrapper">
      <!-- Schließen-Button -->
      <v-btn icon size="small" class="rounded-0" variant="flat" @click="emitEvent('layer-state', false)">
        <v-icon>mdi-window-close</v-icon>
      </v-btn>
      <v-tabs
          v-model="tabIndex"
          class="tab-navigation"
          background-color="primary"
          dark
          grow
          height="32"
          align="center"
      >
        <v-tab min-width="16" min-height="16" height="24" width="16" max-width="16" max-height="24" v-for="(tab, index) in tabs" :key="tab.index" @click="handleTabEmit(index)">
          <v-icon size="16">{{ tab.icon }}</v-icon>
          <span class="text-subtitle-2">{{ tab.name }}</span>
        </v-tab>
      </v-tabs>
      <!-- Layer-Controller -->
      <v-row
          v-if="tabIndex === 0"
          class="pt-2"
          align="center"
          dense

      >
        <v-col cols="6">
          <Form @component-event="updateBlend" v-model:operation="methods" v-model:item="config"/>
        </v-col>
        <v-col cols="6" class="d-flex align-center flex-wrap">
          <div class="text-caption font-weight-medium">Deckkraft:</div>
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
          <div class="text-caption ml-2">{{ globalOpacity }}%</div>
        </v-col>
      </v-row>
      <v-card
          class="overflow-hidden overflow-y-auto"
          max-height="300"
          height="300"
          rounded="0"
          border="0"
          variant="flat"
      >
        <div v-for="(tab, index) in tabs" :key="tab.name" v-show="tabIndex === index">
          <!-- Layer-Liste -->
          <v-list density="comfortable" two-line class="layer-list overflow-hidden" v-show="tabIndex === 0 && layers.length > 0" bg-color="transparent">
            <Drag :items="layers" :on-drop="handleDrop" @update:drag-event="emitEvent">
              <template #default>
                <v-list-item
                    v-for="(layer) in layers"
                    v-show="shouldShowLayer(layer)"
                    :key="layer.id"
                    :disabled="windowStates.drag.value && dragId === layer.id"
                    :data-id="layer.id"
                    class="layer-item"
                    :class="{selected: selectedLayer.find(x => x.id === layer.id),dragging: windowStates.drag.value && dragId === layer.id,'not-dragging': windowStates.drag.value && dragId !== layer.id}"
                    @click="layer.type === 4 ? '' : toggleLayerSelection(layer)"
                >
                  <template v-slot:prepend>
                    <v-icon v-if="layer.type === 4" @click="groupCollapse[layer.id] = !groupCollapse[layer.id]">
                      {{ groupCollapse[layer.id] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                    </v-icon>
                    <v-icon v-else color="grey" size="x-small" @click.stop="emitEvent('hide-layer', layer)">
                      {{ layer?.hidden === 1 ? 'mdi-eye-off' : 'mdi-eye' }}
                    </v-icon>
                  </template>

                  <template v-slot:append>
                    <v-icon color="grey">
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
                            <v-tooltip v-if="layer?.mask && layer.type !== 4" location="bottom">
                              <template v-slot:activator="{ props }">
                                <v-avatar class="mr-2 transparent thumbnail" v-bind="props" rounded="0" variant="elevated">
                                  <v-img :cover="false" :src="layer?.mask" :alt="'Mask ' + layer.name" />
                                </v-avatar>
                              </template>
                              {{ 'Mask ' + layer.name }}
                            </v-tooltip>
                            <v-avatar v-bind="props" rounded="0" variant="elevated" :class="layer.type !== 1 && layer.type !== 4 ? 'transparent thumbnail' : ''">
                              <template v-if="layer?.type === 1">
                                <v-icon>mdi-format-text</v-icon>
                              </template>
                              <template v-else-if="layer?.type === 2">
                                <v-img
                                    :src="layer?.thumbnail || layer?.url || layer?.svg"
                                    :alt="layer.name"
                                    style="width: 100%; height: 100%; object-fit: contain;"
                                    cover
                                />
                              </template>
                              <template v-else-if="layer.type === 4">
                                <v-icon>mdi-folder</v-icon>
                              </template>
                              <template v-else>
                                <v-img :cover="false" :src="layer?.thumbnail || layer?.url" :alt="layer.name" />
                              </template>
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
          <Channel v-show="tabIndex === 1 && channel.length > 0" :data="channel" @update:componentEvent="emitEvent"/>
          <Path v-show="tabIndex === 2 && paths.length > 0" :data="paths" @update:componentEvent="emitEvent"/>
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
            :disabled="selectedLayer.length !== 2"
            @click="emitEvent('mask-layer', {id: selectedLayer[0].id, id2: selectedLayer[1].id})"
        >
          <v-icon color="black">mdi-vector-intersection</v-icon>
        </v-btn>
        <v-btn
            icon
            color="#DCFDD4"
            size="x-small"
            :disabled="!layers.length"
            @click="emitEvent('renderer:preview')"
        >
          <v-icon color="black">mdi-printer</v-icon>
        </v-btn>
        <v-btn
            icon
            color="#C2F0FF"
            size="x-small"
            :disabled="!groupAble"
            @click="emitEvent('group-layer', allInSameGroup ? {ids: selectedLayer, group: selectedLayer[0].group, reset: true} : {ids: selectedLayer, group: null, reset: false})"
        >
          <v-icon color="black">
            {{ allInSameGroup ? 'mdi-link-off' : 'mdi-link' }}
          </v-icon>
        </v-btn>
        <v-btn
            icon
            color="#FF516D"
            size="x-small"
            @click="emitEvent('delete-layer', selectedLayer)"
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
import Form from "@/components/Form/Form.vue";
import Path from "@/components/Path/Path";

export default defineComponent({
  name: "LayerComponent",
  props: layerProps,
  components: {
    Path,
    Form,
    Drag,
    Channel
  },
  setup(props, { emit }) {
    const {
      groupCollapse,
      shouldShowLayer,
      toggleGroupCollapse,
      groupAble,
      allInSameGroup, emitEvent, validRule, toggleLayerSelection, handleDrop, dragId, hiddenState, tabs, tabIndex, handleTabEmit, globalOpacity, updateOpacity, methods, config, updateBlend } = layerModel(props, emit);
    return {
      groupCollapse,
      shouldShowLayer,
      toggleGroupCollapse,
      groupAble,
      allInSameGroup,
      emitEvent,
      validRule,
      toggleLayerSelection,
      handleDrop,
      dragId,
      hiddenState,
      tabs,
      tabIndex,
      handleTabEmit,
      globalOpacity,
      updateOpacity,
      windowStates,
      methods,
      config,
      updateBlend,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer";
</style>