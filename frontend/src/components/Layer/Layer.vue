<template>
  <section
      v-if="state"
      class="layer-system"
      :data-theme="theme"
  >
    <div class="layer-wrapper">
      <nav class="layer-tabs">
        <button
            v-for="(tab, index) in tabs"
            :key="tab.name"
            type="button"
            class="layer-tab"
            :class="{ active: tabIndex === index }"
            @click="handleTabEmit(index)"
        >
          <v-icon size="15">{{ tab.icon }}</v-icon>
          <span>{{ tab.name }}</span>
        </button>
      </nav>

      <section
          v-if="tabIndex === 0"
          class="layer-controls"
      >
        <div class="layer-blend">
          <Form
              @component-event="updateBlend"
              v-model:operation="methods"
              v-model:item="config"
          />
        </div>

        <label class="layer-opacity">
          <span>Deckkraft</span>
          <input
              type="range"
              v-model="globalOpacity"
              min="0"
              max="100"
              step="1"
              :disabled="!selectedLayer.length"
              @change="updateOpacity"
          />
          <strong>{{ globalOpacity }}%</strong>
        </label>
      </section>

      <section class="layer-content">
        <div
            v-for="(tab, index) in tabs"
            :key="tab.name"
            v-show="tabIndex === index"
            class="layer-panel"
        >
          <div
              v-show="tabIndex === 0 && visibleLayers.length > 0"
              class="layer-list"
          >
            <Drag
                :items="visibleLayers"
                :on-drop="handleDrop"
                @update:drag-event="emitEvent"
            >
              <template #default>
                <div
                    v-for="layer in visibleLayers"
                    v-show="shouldShowLayer(layer)"
                    :key="layer.time"
                    :data-id="layer.id"
                    class="layer-item"
                    :class="{
                    selected: selectedLayer.find(x => x.id === layer.id),
                    dragging: windowStates.drag.value && dragId === layer.id,
                    'not-dragging': windowStates.drag.value && dragId !== layer.id
                  }"
                    @click="layer.type === 4 ? '' : toggleLayerSelection(layer)"
                >
                  <button
                      v-if="layer.type === 4"
                      type="button"
                      class="layer-icon-btn"
                      @click.stop="groupCollapse[layer.id] = !groupCollapse[layer.id]"
                  >
                    <v-icon size="16">
                      {{ groupCollapse[layer.id] ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                    </v-icon>
                  </button>

                  <button
                      v-else
                      type="button"
                      class="layer-icon-btn"
                      @click.stop="emitEvent('hide-layer', layer)"
                  >
                    <v-icon size="15">
                      {{ layer?.hidden === 1 ? 'mdi-eye-off' : 'mdi-eye' }}
                    </v-icon>
                  </button>

                  <div class="layer-thumb">
                    <template v-if="layer?.mask && layer.type !== 4">
                      <img
                          class="layer-thumb__mask"
                          :src="layer.mask"
                          :alt="'Mask ' + layer.name"
                      />
                    </template>

                    <template v-if="layer?.type === 1">
                      <v-icon size="18">mdi-format-text</v-icon>
                    </template>

                    <template v-else-if="layer?.type === 2">
                      <img
                          :src="layer?.thumbnail || layer?.url || layer?.svg"
                          :alt="layer.name"
                      />
                    </template>

                    <template v-else-if="layer.type === 4">
                      <v-icon size="18">mdi-folder</v-icon>
                    </template>

                    <template v-else-if="layer?.type === 5">
                      <v-icon size="18" color="#70dfb4">mdi-cube-outline</v-icon>
                    </template>

                    <template v-else>
                      <img
                          v-if="layer?.thumbnail || layer?.url"
                          :src="layer?.thumbnail || layer?.url"
                          :alt="layer.name"
                      />
                    </template>
                  </div>

                  <input
                      class="layer-name"
                      v-model="layer.name"
                      :class="{ invalid: !validRule(layer.name).isValid }"
                      @blur="validRule(layer.name).isValid ? emitEvent('update-layer', layer) : ''"
                      @click.stop
                  />

                  <button
                      type="button"
                      class="layer-icon-btn layer-icon-btn--drag"
                  >
                    <v-icon size="16">
                      {{ windowStates.drag.value && dragId === layer.id ? 'mdi-drag-variant' : 'mdi-drag' }}
                    </v-icon>
                  </button>
                </div>
              </template>
            </Drag>
          </div>

          <Channel
              v-show="!orbit && tabIndex === 1 && channel.length > 0"
              :selected-channel="selectedChannel"
              :data="channel"
              :settings="channelSettings"
              :theme="theme"
              @update:componentEvent="emitEvent"
          />

          <Path
              v-show="!orbit && tabIndex === 2 && paths.length > 0"
              :data="paths"
              @update:componentEvent="emitEvent"
          />

          <div
              v-show="(!orbit && tabIndex === 3) || (orbit && tabIndex === 1)"
              class="layer-transform-panel"
          >
            <Transformation
                :layers="layers"
                :selected-layers="selectedLayer"
                :compact="true"
                @component-event="emitEvent"
            />
          </div>
        </div>
      </section>

      <footer class="navigation-bar">
        <template v-if="tabIndex === 0">
          <button
              type="button"
              class="layer-action add"
              @click="emitEvent('add-layer')"
          >
            <v-icon size="15">mdi-plus</v-icon>
          </button>

          <button
              type="button"
              class="layer-action"
              :disabled="selectedLayer.length !== 2"
              @click="emitEvent('mask-layer', { id: selectedLayer[0].id, id2: selectedLayer[1].id })"
          >
            <v-icon size="15">mdi-vector-intersection</v-icon>
          </button>

          <button
              type="button"
              class="layer-action"
              :disabled="!visibleLayers.length"
              @click="emitEvent('renderer:preview')"
          >
            <v-icon size="15">mdi-printer</v-icon>
          </button>

          <button
              type="button"
              class="layer-action link"
              :disabled="!groupAble"
              @click="emitEvent('group-layer', allInSameGroup ? { ids: selectedLayer, group: selectedLayer[0].group, reset: true } : { ids: selectedLayer, group: null, reset: false })"
          >
            <v-icon size="15">
              {{ allInSameGroup ? 'mdi-link-off' : 'mdi-link' }}
            </v-icon>
          </button>

          <button
              type="button"
              class="layer-action danger"
              :disabled="!selectedLayer.length"
              @click="emitEvent('delete-layer', selectedLayer)"
          >
            <v-icon size="15">mdi-delete</v-icon>
          </button>
        </template>

        <template v-if="!orbit && tabIndex === 2">
          <button
              type="button"
              class="layer-action add"
              :disabled="!selectedChannel.length"
              @click="emitEvent('add-channel', selectedChannel)"
          >
            <v-icon size="15">mdi-plus</v-icon>
          </button>

          <button
              type="button"
              class="layer-action link"
              :disabled="!selectedChannel.length"
              @click="emitEvent('activate-channel', selectedChannel)"
          >
            <v-icon size="15">mdi-check-bold</v-icon>
          </button>

          <button
              type="button"
              class="layer-action danger"
              :disabled="!selectedChannel.length"
              @click="emitEvent('delete-channel', selectedChannel)"
          >
            <v-icon size="15">mdi-delete</v-icon>
          </button>

          <button
              type="button"
              class="layer-action add"
              @click="emitEvent('renderer:preview', selectedChannel.length ? selectedChannel : channel)"
          >
            <v-icon size="15">mdi-printer</v-icon>
          </button>
        </template>
      </footer>
    </div>
  </section>
</template>

<script>
import { defineComponent } from "vue";
import { layerModel, layerProps } from "@/models/layer/model";
import Drag from "@/components/Drag/Drag.vue";
import { windowStates } from "@/dataLayer/state";
import Channel from "@/components/Channel/Channel.vue";
import Form from "@/components/Form/Form.vue";
import Path from "@/components/Path/Path";
import Transformation from "@/components/Transformation/Transformation";

export default defineComponent({
  name: "LayerComponent",
  props: layerProps,
  components: {
    Transformation,
    Path,
    Form,
    Drag,
    Channel,
  },
  setup(props, { emit }) {
    const model = layerModel(props, emit);

    return {
      ...model,
      windowStates,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Layer";
</style>