<template>
  <div class="mem-view-head">
    <div>
      <strong>Particle System</strong>
      <span>Ersetzt die Mesh-Vorschau durch konfigurierbare Texture- oder Mesh-Partikel.</span>
    </div>
  </div>

  <div class="mem-geometry-layout">
    <section class="mem-geometry-card">
      <header>
        <strong>System</strong>
        <small>Render-Modus und Quelle.</small>
      </header>

      <label
          class="mem-toggle-card"
          :class="{ active: state.particleSystem.enabled }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-particle</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Particle Render</strong>
          <small>{{ state.particleSystem.enabled ? 'Ersetzt Mesh' : 'Mesh aktiv' }}</small>
        </span>

        <v-switch
            :model-value="state.particleSystem.enabled"
            hide-details
            @update:model-value="setParticleBoolean('enabled', $event)"
        />
      </label>

      <v-select
          :model-value="state.particleSystem.mode"
          :items="particleModeOptions"
          label="Mode"
          density="compact"
          hide-details
          @update:model-value="setParticleValue('mode', $event)"
      />

      <v-select
          :model-value="state.particleSystem.source"
          :items="particleSourceOptions"
          label="Source"
          density="compact"
          hide-details
          @update:model-value="setParticleValue('source', $event)"
      />

      <v-select
          :model-value="state.particleSystem.texture_slot"
          :items="particleTextureSlotOptions"
          label="Texture Slot"
          density="compact"
          hide-details
          @update:model-value="setParticleValue('texture_slot', $event)"
      />
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Emitter</strong>
        <small>Verteilung, Anzahl und deterministischer Seed.</small>
      </header>

      <v-select
          :model-value="state.particleSystem.emitter"
          :items="particleEmitterOptions"
          label="Emitter"
          density="compact"
          hide-details
          @update:model-value="setParticleValue('emitter', $event)"
      />

      <div class="mem-control-card">
        <header>
          <strong>Count</strong>
          <small>{{ state.particleSystem.count }}</small>
        </header>

        <v-slider
            :model-value="state.particleSystem.count"
            :min="1"
            :max="5000"
            :step="1"
            thumb-label
            hide-details
            @update:model-value="setParticleNumber('count', $event)"
        />
      </div>

      <v-text-field
          :model-value="state.particleSystem.seed"
          label="Seed"
          type="number"
          density="compact"
          hide-details
          @update:model-value="setParticleNumber('seed', $event)"
      />
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Motion</strong>
        <small>Lebenszeit, Velocity, Gravity und Orbit.</small>
      </header>

      <div class="mem-geometry-vector">
        <v-text-field
            :model-value="state.particleSystem.velocity_x"
            label="Velocity X"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setParticleNumber('velocity_x', $event)"
        />

        <v-text-field
            :model-value="state.particleSystem.velocity_y"
            label="Velocity Y"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setParticleNumber('velocity_y', $event)"
        />

        <v-text-field
            :model-value="state.particleSystem.velocity_z"
            label="Velocity Z"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setParticleNumber('velocity_z', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Lifetime</strong>
          <small>{{ state.particleSystem.lifetime }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.lifetime" :min="0.1" :max="20" :step="0.1" hide-details thumb-label @update:model-value="setParticleNumber('lifetime', $event)" />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Age</strong>
          <small>{{ state.particleSystem.age }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.age" :min="0" :max="20" :step="0.05" hide-details thumb-label @update:model-value="setParticleNumber('age', $event)" />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Gravity</strong>
          <small>{{ state.particleSystem.gravity }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.gravity" :min="-2" :max="2" :step="0.01" hide-details thumb-label @update:model-value="setParticleNumber('gravity', $event)" />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Orbit</strong>
          <small>{{ state.particleSystem.orbit }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.orbit" :min="-2" :max="2" :step="0.01" hide-details thumb-label @update:model-value="setParticleNumber('orbit', $event)" />
      </div>
    </section>

    <section class="mem-geometry-card wide">
      <header>
        <strong>Shape</strong>
        <small>Bounds, Sprite-Größe und Mesh-Referenz.</small>
      </header>

      <div class="mem-geometry-vector">
        <v-text-field :model-value="state.particleSystem.spread_x" label="Spread X" type="number" density="compact" hide-details @update:model-value="setParticleNumber('spread_x', $event)" />
        <v-text-field :model-value="state.particleSystem.spread_y" label="Spread Y" type="number" density="compact" hide-details @update:model-value="setParticleNumber('spread_y', $event)" />
        <v-text-field :model-value="state.particleSystem.spread_z" label="Spread Z" type="number" density="compact" hide-details @update:model-value="setParticleNumber('spread_z', $event)" />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Size</strong>
          <small>{{ state.particleSystem.size }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.size" :min="1" :max="120" :step="1" hide-details thumb-label @update:model-value="setParticleNumber('size', $event)" />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Size Randomness</strong>
          <small>{{ state.particleSystem.size_randomness }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.size_randomness" :min="0" :max="1" :step="0.01" hide-details thumb-label @update:model-value="setParticleNumber('size_randomness', $event)" />
      </div>

      <label class="mem-toggle-card" :class="{ active: state.particleSystem.use_mesh_reference }">
        <span class="mem-toggle-icon"><v-icon>mdi-vector-triangle</v-icon></span>
        <span class="mem-toggle-text">
          <strong>Use Mesh Reference</strong>
          <small>Partikel auf der aktuellen Mesh-OberflÃ¤che sampeln.</small>
        </span>
        <v-switch :model-value="state.particleSystem.use_mesh_reference" hide-details @update:model-value="setParticleBoolean('use_mesh_reference', $event)" />
      </label>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Material</strong>
        <small>Blend, Alpha und Tint.</small>
      </header>

      <v-select :model-value="state.particleSystem.blend" :items="particleBlendOptions" label="Blend" density="compact" hide-details @update:model-value="setParticleValue('blend', $event)" />

      <div class="mem-control-card">
        <header>
          <strong>Alpha</strong>
          <small>{{ state.particleSystem.alpha }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.alpha" :min="0" :max="1" :step="0.01" hide-details thumb-label @update:model-value="setParticleNumber('alpha', $event)" />
      </div>

      <div class="mem-geometry-vector">
        <v-text-field :model-value="state.particleSystem.color?.[0]" label="R" type="number" density="compact" hide-details @update:model-value="setParticleColor(0, $event)" />
        <v-text-field :model-value="state.particleSystem.color?.[1]" label="G" type="number" density="compact" hide-details @update:model-value="setParticleColor(1, $event)" />
        <v-text-field :model-value="state.particleSystem.color?.[2]" label="B" type="number" density="compact" hide-details @update:model-value="setParticleColor(2, $event)" />
      </div>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {
  particleSystemModel,
  particleSystemModelEmits,
  particleSystemModelProps,
} from "@/view/models/page/material/particleSystem/model";

export default defineComponent({
  name: "MaterialParticleSystem",
  props: particleSystemModelProps,
  emits: particleSystemModelEmits,
  setup(props, { emit }) {
    return {
      ...particleSystemModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Particle";
</style>

