<template>
  <HeaderStatusMetric :config="ui.header"/>

  <div class="mem-section">
    <div class="mem-name-card">
      <strong>Material Name</strong>

      <v-text-field
          :model-value="state.name"
          label="Name"
          density="compact"
          hide-details
          @update:model-value="setName"
      />
    </div>

    <div class="mem-layer-bank">
      <header>
        <strong>Bitmap Layers</strong>
        <small>In einen Surface-Slot ziehen.</small>
      </header>

      <div class="mem-layer-bank-list">
        <button
            v-for="item in textureLayers"
            :key="item.id"
            type="button"
            class="mem-layer-source-item"
            draggable="true"
            @dragstart="handleLayerDragStart($event, item)"
        >
          <span class="mem-layer-thumb">
            <v-img
                v-if="item.masked || item.thumbnail || item.url || item.svg"
                :src="item.masked || item.thumbnail || item.url || item.svg"
                :alt="item.name"
                cover
            />

            <v-icon v-else size="18">
              {{ item.type === 5 ? "mdi-cube-outline" : "mdi-image-outline" }}
            </v-icon>
          </span>

          <span class="mem-layer-source-main">
            <strong>{{ item.name || item.id }}</strong>
            <small>type {{ item.type }}</small>
          </span>
        </button>
      </div>
    </div>

    <div
        v-for="group in surfaceGroups"
        :key="group.key"
        class="mem-surface-row"
        :class="{ active: getMapSlot(group.key)?.enabled }"
        @dragover.prevent
        @drop="handleMapDrop($event, group.key)"
    >
      <header>
        <strong>{{ group.label }}</strong>
        <small>{{ group.relation }}</small>
      </header>

      <template v-if="group.field.type === 'color'">
        <div class="mem-color-line">
          <input
              type="color"
              :value="getSurfaceColor(group.key)"
              @input="setSurfaceColor(group.key, $event.target.value)"
          />

          <span>{{ getSurfaceColor(group.key) }}</span>
        </div>
      </template>

      <template v-else-if="group.field.type === 'vector3'">
        <div class="mem-vector-row">
          <v-text-field
              :model-value="state.surface[group.key]?.[0]"
              label="X"
              density="compact"
              hide-details
              @update:model-value="setVectorValue(group.key, 0, $event)"
          />

          <v-text-field
              :model-value="state.surface[group.key]?.[1]"
              label="Y"
              density="compact"
              hide-details
              @update:model-value="setVectorValue(group.key, 1, $event)"
          />

          <v-text-field
              :model-value="state.surface[group.key]?.[2]"
              label="Z"
              density="compact"
              hide-details
              @update:model-value="setVectorValue(group.key, 2, $event)"
          />
        </div>
      </template>

      <template v-else>
        <v-slider
            :model-value="state.surface[group.key]"
            :min="group.field.min"
            :max="group.field.max"
            :step="group.field.step"
            thumb-label
            hide-details
            @update:model-value="setSurfaceValue(group.key, $event)"
        />
      </template>

      <div class="mem-surface-map-slot d-flex ga-2 align-center">
        <div class="w-70 d-flex ga-2 flex-wrap align-center">
          <button
              type="button"
              class="mem-map-pill w-100"
              :class="{
              active: isSurfaceSlotConnected(group.key),
              multitexture: getMapSlot(group.key)?.source_type === 'multitexture',
              shader: getMapSlot(group.key)?.source_type === 'shader'
            }"
              @click="clearMapSlot(group.key)"
          >
            <v-icon size="15">
              {{ getSurfaceSlotIcon(group.key) }}
            </v-icon>

            <span class="mem-map-pill-text">
            <strong>{{ getSurfaceSlotLabel(group.key) }}</strong>
            <small>{{ getSurfaceSlotDetail(group.key) }}</small>
          </span>
          </button>
        </div>

        <div class="w-30 mem-surface-offset-sync d-flex ga-2 align-center flex-wrap">
          <v-select
              :model-value="getMapSlot(group.key)?.channel || 'rgba'"
              :items="textureChannelOptions"
              label="Image"
              density="compact"
              hide-details
              @update:model-value="setSurfaceSlotChannel(group.key, $event)"
          />

          <v-select
              :model-value="getMapSlot(group.key)?.color_mode || 'color'"
              :items="textureColorModeOptions"
              label="Color"
              density="compact"
              hide-details
              @update:model-value="setSurfaceTextureSetting(group.key, 'color_mode', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {surfaceEditorEmits, surfaceEditorModel, surfaceEditorProps} from "@/view/models/page/material/surface/model";
import HeaderStatusMetric from "@/view/components/Header/Metric/Metric";

export default defineComponent({
  name: "SurfaceEditor",
  components: {HeaderStatusMetric},
  props: surfaceEditorProps,
  emits: surfaceEditorEmits,
  setup(props, { emit }) {
    return {
      ...surfaceEditorModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Surface";
</style>
