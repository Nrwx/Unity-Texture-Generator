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
          :model-value="geometry.primitive"
          :items="PRIMITIVE_OPTIONS"
          label="Primitive"
          density="compact"
          hide-details
          @update:model-value="setGeometryValue('primitive', $event)"
      />

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="geometry.width"
            label="Width"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('width', $event)"
        />

        <v-text-field
            :model-value="geometry.height"
            label="Height"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('height', $event)"
        />

        <v-text-field
            :model-value="geometry.depth"
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
          <small>{{ geometry.bevel }}</small>
        </header>

        <v-slider
            :model-value="geometry.bevel"
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
          <small>{{ geometry.bevel_segments }}</small>
        </header>

        <v-slider
            :model-value="geometry.bevel_segments"
            :min="1"
            :max="12"
            :step="1"
            thumb-label
            hide-details
            @update:model-value="setGeometryNumber('bevel_segments', $event)"
        />
      </div>

      <v-select
          :model-value="geometry.subdivision_type"
          :items="SUBDIVISION_TYPE_OPTIONS"
          label="Subdivision Type"
          density="compact"
          hide-details
          @update:model-value="setGeometryValue('subdivision_type', $event)"
      />

      <div class="mem-control-card">
        <header>
          <strong>Subdivision</strong>
          <small>{{ geometry.subdivision }}</small>
        </header>

        <v-slider
            :model-value="geometry.subdivision"
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
          :class="{ active: geometry.shade_smooth }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-blur</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Shade Smooth</strong>
          <small>Glättet die sichtbare Flächeninterpolation.</small>
        </span>

        <v-switch
            :model-value="geometry.shade_smooth"
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
          :model-value="geometry.uv_fit"
          :items="UV_FIT_OPTIONS"
          label="UV Fit"
          density="compact"
          hide-details
          @update:model-value="setGeometryValue('uv_fit', $event)"
      />

      <div class="mem-control-card">
        <header>
          <strong>UV Density</strong>
          <small>{{ geometry.uv_density }}</small>
        </header>

        <v-slider
            :model-value="geometry.uv_density"
            :min="0.1"
            :max="10"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setGeometryNumber('uv_density', $event)"
        />
      </div>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Volume</strong>
        <small>Mesh-basiertes Innenvolumen fuer Shader und Partikelbindung.</small>
      </header>

      <label class="mem-toggle-card" :class="{ active: geometry.volume?.enabled }">
        <span class="mem-toggle-icon">
          <v-icon>mdi-cube-scan</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Geometry Volume</strong>
          <small>Bindet ein berechnetes Volumen an die aktuelle Mesh-Geometrie.</small>
        </span>

        <v-switch
            :model-value="geometry.volume?.enabled"
            hide-details
            @update:model-value="setVolumeBoolean('enabled', $event)"
        />
      </label>

      <v-select
          :model-value="geometry.volume?.mode"
          :items="VOLUME_MODE_OPTIONS"
          label="Volume Mode"
          density="compact"
          hide-details
          @update:model-value="setVolumeValue('mode', $event)"
      />

      <div class="mem-geometry-vector">
        <v-text-field :model-value="geometry.volume?.resolution" label="Resolution" type="number" :min="4" :max="256" density="compact" hide-details @update:model-value="setVolumeNumber('resolution', $event)" />
        <v-text-field :model-value="geometry.volume?.density" label="Density" type="number" :min="0" density="compact" hide-details @update:model-value="setVolumeNumber('density', $event)" />
        <v-text-field :model-value="geometry.volume?.shell_thickness" label="Shell" type="number" :min="0" density="compact" hide-details @update:model-value="setVolumeNumber('shell_thickness', $event)" />
      </div>

      <v-select
          :model-value="geometry.volume?.falloff"
          :items="VOLUME_FALLOFF_OPTIONS"
          label="Falloff"
          density="compact"
          hide-details
          @update:model-value="setVolumeValue('falloff', $event)"
      />

      <div class="mem-geometry-switch-row">
        <v-switch :model-value="geometry.volume?.particle_bind" label="Particle Bind" hide-details @update:model-value="setVolumeBoolean('particle_bind', $event)" />
        <v-switch :model-value="geometry.volume?.shader_bind" label="Shader Bind" hide-details @update:model-value="setVolumeBoolean('shader_bind', $event)" />
      </div>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Fluid Dynamics</strong>
        <small>Volumenfeld fuer Smoke, Fire, Mist, Liquid und Particle Advection.</small>
      </header>

      <label class="mem-toggle-card" :class="{ active: geometry.fluid?.enabled }">
        <span class="mem-toggle-icon">
          <v-icon>mdi-waves</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Fluid Field</strong>
          <small>Aktiviert ein Fluid-Feld innerhalb des Mesh-Volumes.</small>
        </span>

        <v-switch
            :model-value="geometry.fluid?.enabled"
            :disabled="!geometry.volume?.enabled"
            hide-details
            @update:model-value="setFluidBoolean('enabled', $event)"
        />
      </label>

      <div class="mem-geometry-vector compact">
        <v-select :model-value="geometry.fluid?.type" :items="FLUID_TYPE_OPTIONS" label="Fluid" density="compact" hide-details @update:model-value="setFluidValue('type', $event)" />
        <v-select :model-value="geometry.fluid?.solver" :items="FLUID_SOLVER_OPTIONS" label="Solver" density="compact" hide-details @update:model-value="setFluidValue('solver', $event)" />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field :model-value="geometry.fluid?.viscosity" label="Viscosity" type="number" :min="0" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('viscosity', $event)" />
        <v-text-field :model-value="geometry.fluid?.buoyancy" label="Buoyancy" type="number" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('buoyancy', $event)" />
        <v-text-field :model-value="geometry.fluid?.vorticity" label="Vorticity" type="number" :min="0" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('vorticity', $event)" />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field :model-value="geometry.fluid?.turbulence" label="Turbulence" type="number" :min="0" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('turbulence', $event)" />
        <v-text-field :model-value="geometry.fluid?.diffusion" label="Diffusion" type="number" :min="0" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('diffusion', $event)" />
        <v-text-field :model-value="geometry.fluid?.particle_coupling" label="Particle Coupling" type="number" :min="0" :max="1" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('particle_coupling', $event)" />
      </div>

      <div class="mem-geometry-vector compact">
        <v-text-field :model-value="geometry.fluid?.surface_flow" label="Surface Flow" type="number" :min="0" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('surface_flow', $event)" />
        <v-text-field :model-value="geometry.fluid?.advection" label="Advection" type="number" :min="0" :step="0.01" density="compact" hide-details @update:model-value="setFluidNumber('advection', $event)" />
      </div>

      <div class="mem-geometry-switch-row">
        <v-switch :model-value="geometry.fluid?.mesh_collision" label="Mesh Collision" hide-details @update:model-value="setFluidBoolean('mesh_collision', $event)" />
        <v-switch :model-value="geometry.fluid?.particle_collision" label="Particle Collision" hide-details @update:model-value="setFluidBoolean('particle_collision', $event)" />
      </div>
    </section>

    <section class="mem-geometry-card wide">
      <header>
        <strong>Transform</strong>
        <small>Pivot, Rotation und Skalierung der Material-Geometrie.</small>
      </header>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="geometry.pivot_x"
            label="Pivot X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('pivot_x', $event)"
        />

        <v-text-field
            :model-value="geometry.pivot_y"
            label="Pivot Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('pivot_y', $event)"
        />

        <v-text-field
            :model-value="geometry.pivot_z"
            label="Pivot Z"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('pivot_z', $event)"
        />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="geometry.rotation_x"
            label="Rot X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('rotation_x', $event)"
        />

        <v-text-field
            :model-value="geometry.rotation_y"
            label="Rot Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('rotation_y', $event)"
        />

        <v-text-field
            :model-value="geometry.rotation_z"
            label="Rot Z"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('rotation_z', $event)"
        />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="geometry.scale_x"
            label="Scale X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('scale_x', $event)"
        />

        <v-text-field
            :model-value="geometry.scale_y"
            label="Scale Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setGeometryNumber('scale_y', $event)"
        />

        <v-text-field
            :model-value="geometry.scale_z"
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
import {geometryModel, geometryModelProps} from "@/view/models/page/material/geometry/model";

export default defineComponent({
  name: "GeometryEditor",
  props: geometryModelProps,
  setup(props, { emit }) {
    const model = geometryModel(props, emit);
    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Geometry";
</style>
