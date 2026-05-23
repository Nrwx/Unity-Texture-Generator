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

      <div class="mem-particle-layer-tools">
        <v-select
            :model-value="state.particleSystem.active_layer_id"
            :items="particleLayers"
            item-title="name"
            item-value="id"
            label="Particle Layer"
            density="compact"
            hide-details
            @update:model-value="setActiveParticleLayer"
        />
        <v-btn variant="text" size="small" @click="addParticleLayer">
          Add
        </v-btn>
      </div>

      <div v-if="activeParticleLayer" class="mem-geometry-vector">
        <v-select
            :model-value="activeParticleLayer.texture_slot"
            :items="particleTextureSlotOptions"
            label="Layer Slot"
            density="compact"
            hide-details
            @update:model-value="updateActiveParticleLayerSlot"
        />
        <v-select
            :model-value="activeParticleLayer.layer_id"
            :items="textureLayerOptions"
            label="Texture Layer"
            density="compact"
            hide-details
            @update:model-value="updateActiveParticleTextureLayer"
        />
      </div>
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

      <v-select
          :model-value="state.particleSystem.root_animation"
          :items="particleRootAnimationOptions"
          label="Root Animation"
          density="compact"
          hide-details
          @update:model-value="setParticleValue('root_animation', $event)"
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

      <div class="mem-geometry-vector">
        <v-text-field :model-value="state.particleSystem.direction_x" label="Direction X" type="number" density="compact" hide-details @update:model-value="setParticleNumber('direction_x', $event)" />
        <v-text-field :model-value="state.particleSystem.direction_y" label="Direction Y" type="number" density="compact" hide-details @update:model-value="setParticleNumber('direction_y', $event)" />
        <v-text-field :model-value="state.particleSystem.direction_z" label="Direction Z" type="number" density="compact" hide-details @update:model-value="setParticleNumber('direction_z', $event)" />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Velocity</strong>
          <small>{{ state.particleSystem.velocity }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.velocity" :min="-2" :max="2" :step="0.01" hide-details thumb-label @update:model-value="setParticleNumber('velocity', $event)" />
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

      <div class="mem-control-card">
        <header>
          <strong>Dot Rotation</strong>
          <small>{{ state.particleSystem.rotation }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.rotation" :min="-180" :max="180" :step="1" hide-details thumb-label @update:model-value="setParticleNumber('rotation', $event)" />
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

      <div class="mem-geometry-vector">
        <v-text-field :model-value="state.particleSystem.size_x" label="Size X" type="number" density="compact" hide-details @update:model-value="setParticleNumber('size_x', $event)" />
        <v-text-field :model-value="state.particleSystem.size_y" label="Size Y" type="number" density="compact" hide-details @update:model-value="setParticleNumber('size_y', $event)" />
      </div>

      <label class="mem-toggle-card" :class="{ active: state.particleSystem.random_size }">
        <span class="mem-toggle-icon"><v-icon>mdi-dice-5-outline</v-icon></span>
        <span class="mem-toggle-text">
          <strong>Random Size</strong>
          <small>{{ state.particleSystem.random_size ? 'Kurve aktiv' : 'Aus' }}</small>
        </span>
        <v-switch :model-value="state.particleSystem.random_size" hide-details @update:model-value="setParticleBoolean('random_size', $event)" />
      </label>

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

    <section class="mem-geometry-card wide">
      <header>
        <strong>Interpolation</strong>
        <small>Eine Kurve pro Attribut; die Mittellinie ist 0.</small>
      </header>

      <div class="mem-particle-curve-head">
        <v-select
            :model-value="state.interpolationAttribute"
            :items="particleInterpolationAttributes"
            item-title="label"
            item-value="key"
            label="Interpolation Attribute"
            density="compact"
            hide-details
            @update:model-value="setInterpolationAttribute"
        />

        <v-btn variant="text" size="small" @click="resetInterpolation">
          Reset
        </v-btn>
      </div>

      <div class="mem-particle-curve-layout">
        <svg
            class="mem-particle-curve-box"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            @pointerdown="addInterpolationPoint"
            @contextmenu.prevent="handleInterpolationContext($event)"
        >
          <rect x="0" y="0" width="100" height="100" class="mem-particle-curve-bg" />
          <line v-for="x in [12.5, 25, 37.5, 50, 62.5, 75, 87.5]" :key="`curve-x-${x}`" :x1="x" y1="0" :x2="x" y2="100" class="mem-particle-curve-grid" />
          <line v-for="y in [10, 20, 30, 40, 60, 70, 80, 90]" :key="`curve-y-${y}`" x1="0" :y1="y" x2="100" :y2="y" class="mem-particle-curve-grid" />
          <line x1="0" y1="50" x2="100" y2="50" class="mem-particle-curve-zero" />
          <polyline :points="interpolationPolyline" class="mem-particle-curve-line" />
          <circle
              v-for="(point, index) in activeInterpolationPoints"
              :key="`${state.interpolationAttribute}-${index}`"
              :cx="(point.x / lifetimeWidth) * 100"
              :cy="50 - point.y"
              r="2.8"
              class="mem-particle-curve-point"
              @pointerdown.stop="startInterpolationPoint($event, index)"
              @contextmenu.stop.prevent="handleInterpolationContext($event, index)"
          />
        </svg>

        <div class="mem-particle-point-list">
          <div
              v-for="(point, index) in activeInterpolationPoints"
              :key="`list-${state.interpolationAttribute}-${index}`"
              class="mem-particle-point-item"
              @contextmenu.prevent="deleteInterpolationPoint(index)"
          >
            <strong>{{ index + 1 }}</strong>
            <v-text-field
                :model-value="point.y"
                label="Y Offset"
                type="number"
                density="compact"
                hide-details
                @click.stop
                @contextmenu.stop
                @update:model-value="updateInterpolationPointValue(index, $event)"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="mem-geometry-card wide">
      <header>
        <span>
          <strong>Path Follow</strong>
          <small>Globale XYZ-Chain mit separaten Lifetime-Keyframes.</small>
        </span>
        <v-btn variant="text" size="small" @click="resetPathFollow">
          Reset
        </v-btn>
      </header>

      <label class="mem-toggle-card" :class="{ active: state.particleSystem.path_follow?.enabled }">
        <span class="mem-toggle-icon"><v-icon>mdi-vector-curve</v-icon></span>
        <span class="mem-toggle-text">
          <strong>Path Follow</strong>
          <small>{{ state.particleSystem.path_follow?.enabled ? 'Aktiv' : 'Aus' }}</small>
        </span>
        <v-switch :model-value="state.particleSystem.path_follow?.enabled" hide-details @update:model-value="setPathFollowEnabled" />
      </label>

      <div class="mem-particle-path-layout">
        <div class="mem-particle-path-views">
          <div class="mem-particle-path-view timebar">
            <strong>Time</strong>
            <svg viewBox="0 0 100 24" preserveAspectRatio="xMidYMid meet" @pointerdown="addPathPoint($event, 'time')">
              <rect x="0" y="0" width="100" height="24" />
              <line x1="0" y1="12" x2="100" y2="12" />
              <polyline :points="pathTimePolyline" />
              <circle
                  v-for="point in pathFollowPoints"
                  :key="`time-${point.id}`"
                  :cx="(point.t / lifetimeWidth) * 100"
                  cy="12"
                  r="2.1"
                  :class="{ active: activePathPoint?.id === point.id }"
                  @click.stop="setActivePathPoint(point.id)"
                  @pointerdown.stop="startPathPointDrag($event, point.id, 'time')"
                  @contextmenu.stop.prevent="handlePathPointContext($event, point.id)"
              />
            </svg>
          </div>

          <div class="mem-particle-path-view">
            <strong>Side</strong>
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" @pointerdown="addPathPoint($event, 'side')">
              <rect x="0" y="0" width="100" height="100" />
              <line x1="50" y1="0" x2="50" y2="100" />
              <line x1="0" y1="50" x2="100" y2="50" />
              <polyline :points="pathSidePolyline" />
              <circle
                  v-for="point in pathFollowPoints"
                  :key="`side-${point.id}`"
                  :cx="50 + (point.translate?.x || 0) * 24"
                  :cy="50 - (point.translate?.y || 0) * 24"
                  r="3"
                  :class="{ active: activePathPoint?.id === point.id }"
                  @click.stop="setActivePathPoint(point.id)"
                  @pointerdown.stop="startPathPointDrag($event, point.id, 'side')"
                  @contextmenu.stop.prevent="handlePathPointContext($event, point.id)"
              />
            </svg>
          </div>

          <div class="mem-particle-path-view">
            <strong>Top</strong>
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" @pointerdown="addPathPoint($event, 'top')">
              <rect x="0" y="0" width="100" height="100" />
              <line x1="50" y1="0" x2="50" y2="100" />
              <line x1="0" y1="50" x2="100" y2="50" />
              <polyline :points="pathTopPolyline" />
              <circle
                  v-for="point in pathFollowPoints"
                  :key="`top-${point.id}`"
                  :cx="50 + (point.translate?.x || 0) * 24"
                  :cy="50 - (point.translate?.z || 0) * 24"
                  r="3"
                  :class="{ active: activePathPoint?.id === point.id }"
                  @click.stop="setActivePathPoint(point.id)"
                  @pointerdown.stop="startPathPointDrag($event, point.id, 'top')"
                  @contextmenu.stop.prevent="handlePathPointContext($event, point.id)"
              />
            </svg>
          </div>
        </div>

        <div class="mem-particle-path-list">
          <button
              v-for="point in pathFollowPoints"
              :key="point.id"
              type="button"
              class="mem-particle-path-item"
              :class="{ active: activePathPoint?.id === point.id }"
              @click="setActivePathPoint(point.id)"
              @contextmenu.prevent="handlePathPointContext($event, point.id, true)"
          >
            <strong>{{ Number(point.t).toFixed(2) }}</strong>
            <span>{{ Number(point.translate?.x || 0).toFixed(2) }}, {{ Number(point.translate?.y || 0).toFixed(2) }}, {{ Number(point.translate?.z || 0).toFixed(2) }}</span>
          </button>
        </div>
      </div>

      <div v-if="activePathPoint" class="mem-particle-path-editor">
        <v-text-field v-for="axis in ['x','y','z']" :key="`tr-${axis}`" :model-value="activePathPoint.translate?.[axis]" :label="axis.toUpperCase()" type="number" density="compact" hide-details @update:model-value="updatePathPoint(activePathPoint.id, 'translate', axis, $event)" />
      </div>
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
