<template>
  <div class="mem-view-head">
    <div>
      <strong>Geometry</strong>
      <span>Form, Proportionen, Bevel, Subdivision, UV-Dichte und Transform.</span>
    </div>
  </div>

  <div class="mem-geometry-layout">
    <section class="mem-geometry-card">
      <header>
        <strong>Primitive</strong>
        <small>Basisform und globale Abmessungen.</small>
      </header>

      <v-select
          :model-value="state.geometry.primitive"
          :items="primitiveOptions"
          label="Primitive"
          density="compact"
          hide-details
          @update:model-value="setGeometryValue('primitive', $event)"
      />

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="state.geometry.width"
            label="Width"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('width', $event)"
        />

        <v-text-field
            :model-value="state.geometry.height"
            label="Height"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('height', $event)"
        />

        <v-text-field
            :model-value="state.geometry.depth"
            label="Depth"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('depth', $event)"
        />
      </div>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Bevel & Subdivision</strong>
        <small>Kanten, Glättung und geometrische Auflösung.</small>
      </header>

      <div class="mem-control-card">
        <header>
          <strong>Bevel</strong>
          <small>{{ state.geometry.bevel }}</small>
        </header>

        <v-slider
            :model-value="state.geometry.bevel"
            :min="0"
            :max="0.5"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setGeometryNumber('bevel', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Bevel Segments</strong>
          <small>{{ state.geometry.bevel_segments }}</small>
        </header>

        <v-slider
            :model-value="state.geometry.bevel_segments"
            :min="1"
            :max="12"
            :step="1"
            thumb-label
            hide-details
            @update:model-value="setGeometryNumber('bevel_segments', $event)"
        />
      </div>

      <v-select
          :model-value="state.geometry.subdivision_type"
          :items="subdivisionTypeOptions"
          label="Subdivision Type"
          density="compact"
          hide-details
          @update:model-value="setGeometryValue('subdivision_type', $event)"
      />

      <div class="mem-control-card">
        <header>
          <strong>Subdivision</strong>
          <small>{{ state.geometry.subdivision }}</small>
        </header>

        <v-slider
            :model-value="state.geometry.subdivision"
            :min="0"
            :max="6"
            :step="1"
            thumb-label
            hide-details
            @update:model-value="setGeometryNumber('subdivision', $event)"
        />
      </div>

      <label
          class="mem-toggle-card"
          :class="{ active: state.geometry.shade_smooth }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-blur</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Shade Smooth</strong>
          <small>Glättet die sichtbare Flächeninterpolation.</small>
        </span>

        <v-switch
            :model-value="state.geometry.shade_smooth"
            hide-details
            @update:model-value="setGeometryBoolean('shade_smooth', $event)"
        />
      </label>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>UV Geometry Binding</strong>
        <small>Wie UV-Daten auf die Geometrie verteilt werden.</small>
      </header>

      <v-select
          :model-value="state.geometry.uv_fit"
          :items="uvFitOptions"
          label="UV Fit"
          density="compact"
          hide-details
          @update:model-value="setGeometryValue('uv_fit', $event)"
      />

      <div class="mem-control-card">
        <header>
          <strong>UV Density</strong>
          <small>{{ state.geometry.uv_density }}</small>
        </header>

        <v-slider
            :model-value="state.geometry.uv_density"
            :min="0.1"
            :max="10"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setGeometryNumber('uv_density', $event)"
        />
      </div>
    </section>

    <section class="mem-geometry-card wide">
      <header>
        <strong>Transform</strong>
        <small>Pivot, Rotation und Skalierung der Material-Geometrie.</small>
      </header>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="state.geometry.pivot_x"
            label="Pivot X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('pivot_x', $event)"
        />

        <v-text-field
            :model-value="state.geometry.pivot_y"
            label="Pivot Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('pivot_y', $event)"
        />

        <v-text-field
            :model-value="state.geometry.pivot_z"
            label="Pivot Z"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('pivot_z', $event)"
        />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="state.geometry.rotation_x"
            label="Rot X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('rotation_x', $event)"
        />

        <v-text-field
            :model-value="state.geometry.rotation_y"
            label="Rot Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('rotation_y', $event)"
        />

        <v-text-field
            :model-value="state.geometry.rotation_z"
            label="Rot Z"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('rotation_z', $event)"
        />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="state.geometry.scale_x"
            label="Scale X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('scale_x', $event)"
        />

        <v-text-field
            :model-value="state.geometry.scale_y"
            label="Scale Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('scale_y', $event)"
        />

        <v-text-field
            :model-value="state.geometry.scale_z"
            label="Scale Z"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('scale_z', $event)"
        />
      </div>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {
  geometryModel,
  geometryModelEmits,
  geometryModelProps,
} from "@/view/models/page/material/geometry/model";

export default defineComponent({
  name: "GeometryEditor",
  props: geometryModelProps,
  emits: geometryModelEmits,
  setup(props, { emit }) {
    return {
      ...geometryModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Geometry";
</style>