<template>
  <div class="mem-view-head">
    <div>
      <strong>Particle System</strong>
      <span>Ersetzt die Mesh-Vorschau durch konfigurierbare Texture- oder Mesh-Partikel.</span>
    </div>
  </div>

  <div class="mem-geometry-layout mem-particle-workbench">
    <div class="mem-particle-settings">
    <section class="mem-geometry-card">
      <header>
        <strong>Material</strong>
        <small>Blend und Lifetime ColorRamp.</small>
      </header>

      <v-select :model-value="state.particleSystem.blend" :items="particleBlendOptions" label="Blend" density="compact" hide-details @update:model-value="setParticleValue('blend', $event)" />

      <div class="mem-particle-gradient-editor">
        <button
            type="button"
            class="mem-particle-gradient-bar"
            :style="colorRampStyle"
            @click="addColorRampStopAt"
        >
          <span
              v-for="stop in colorRampStops"
              :key="stop.id"
              class="mem-particle-gradient-marker"
              :class="{ active: activeColorRampStop?.id === stop.id }"
              :style="colorRampMarkerStyle(stop)"
              @click.stop="selectColorRampStop(stop.id)"
              @pointerdown.stop="startColorRampStopDrag($event, stop.id)"
              @contextmenu.stop.prevent="removeColorRampStop(stop.id)"
          />
        </button>

        <div v-if="activeColorRampStop" class="mem-particle-gradient-controls">
          <v-text-field
              :model-value="activeColorRampStop.t"
              label="Life"
              type="number"
              :min="0"
              :max="1"
              :step="0.01"
              density="compact"
              hide-details
              @update:model-value="updateColorRampStop({ t: $event })"
          />

          <v-color-picker
              :model-value="activeColorRampColor"
              mode="rgb"
              hide-inputs
              canvas-height="90"
              @update:model-value="updateColorRampStop({ color: $event })"
          />
        </div>
      </div>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>System</strong>
        <small>Render-Modus.</small>
      </header>

      <v-select
          :model-value="state.particleSystem.mode"
          :items="particleModeOptions"
          label="Mode"
          density="compact"
          hide-details
          @update:model-value="setParticleValue('mode', $event)"
      />

    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Emitter</strong>
        <small>Animation, Anzahl und deterministischer Seed.</small>
      </header>

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
        <small>Lebenszeit, Orbit und Dot-Rotation.</small>
      </header>

      <div class="mem-control-card">
        <header>
          <strong>Lifetime</strong>
          <small>{{ state.particleSystem.lifetime }}</small>
        </header>
        <v-slider :model-value="state.particleSystem.lifetime" :min="0.1" :max="20" :step="0.1" hide-details thumb-label @update:model-value="setParticleNumber('lifetime', $event)" />
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

    <section class="mem-geometry-card wide mem-particle-shape-card">
      <header>
        <strong>Shape</strong>
        <small>Bounds, Sprite-Größe und Radius.</small>
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
        <v-text-field :model-value="state.particleSystem.radius" label="Radius" type="number" :min="0" density="compact" hide-details @update:model-value="setParticleNumber('radius', $event)" />
      </div>

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
              :cy="interpolationPointY(point)"
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
                :label="interpolationInputRange.label"
                type="number"
                :min="interpolationInputRange.min"
                :max="interpolationInputRange.max"
                :step="interpolationInputRange.step"
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

    <section v-if="state.particleSystem.path_follow?.enabled" class="mem-geometry-card wide">
      <header>
        <span>
          <strong>Path Follow</strong>
          <small>Globale XYZ-Chain mit separaten Lifetime-Keyframes.</small>
        </span>
        <v-btn variant="text" size="small" @click="resetPathFollow">
          Reset
        </v-btn>
      </header>

      <v-btn-toggle
          :model-value="state.pathGridMode"
          density="compact"
          class="mem-particle-path-toggle"
          mandatory
          @update:model-value="setPathGridMode"
      >
        <v-btn
            v-for="item in pathGridModes"
            :key="item.value"
            :value="item.value"
        >
          {{ item.title }}
        </v-btn>
      </v-btn-toggle>

      <div class="mem-particle-path-layout" :class="{ 'all-views': state.pathGridMode === 'all' }">
        <div class="mem-particle-path-views">
          <div class="mem-particle-path-view timebar">
            <strong>Time</strong>
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" @pointerdown="addPathPoint($event, 'time')">
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

          <div
              v-for="(view, index) in pathViewItems"
              :key="`path-view-${index}-${view.key}`"
              class="mem-particle-path-view"
          >
            <header class="mem-particle-path-view-header">
              <strong>{{ view.label }}</strong>
              <v-select
                  v-if="state.pathGridMode === 'normal'"
                  :model-value="view.key"
                  :items="pathViewOptions"
                  density="compact"
                  hide-details
                  variant="outlined"
                  @update:model-value="setPathViewSlot(index, $event)"
              />
            </header>
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width="100" height="100" />
              <line x1="50" y1="0" x2="50" y2="100" />
              <line x1="0" y1="50" x2="100" y2="50" />
              <polyline :points="pathViewPolyline(view.key)" />
              <circle
                  v-for="point in pathFollowPoints"
                  :key="`${view.key}-${point.id}`"
                  :cx="pathViewPoint(point, view.key).x"
                  :cy="pathViewPoint(point, view.key).y"
                  r="3"
                  :class="{ active: activePathPoint?.id === point.id }"
                  @click.stop="setActivePathPoint(point.id)"
                  @pointerdown.stop="startPathPointDrag($event, point.id, view.key)"
                  @contextmenu.stop.prevent="handlePathPointContext($event, point.id)"
              />
            </svg>
          </div>
        </div>

        <div v-if="state.pathGridMode !== 'all'" class="mem-particle-path-list">
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

      <div v-if="activePathPoint && state.pathGridMode !== 'all'" class="mem-particle-path-editor">
        <v-text-field v-for="axis in ['x','y','z']" :key="`tr-${axis}`" :model-value="activePathPoint.translate?.[axis]" :label="axis.toUpperCase()" type="number" density="compact" hide-details @update:model-value="updatePathPoint(activePathPoint.id, 'translate', axis, $event)" />
      </div>
    </section>

    </div>

    <aside class="mem-particle-layer-column">
      <header>
        <div>
          <strong>Particle Layers</strong>
          <span>Aktiver Layer und Texture-Referenz.</span>
        </div>

        <v-btn icon="mdi-plus" variant="text" size="small" @click="addParticleLayer" />
      </header>

      <div class="mem-particle-layer-list">
        <button
            v-for="(layer, index) in particleLayers"
            :key="layer.id"
            type="button"
            class="mem-particle-layer-item"
            :class="{ active: activeParticleLayer?.id === layer.id }"
            draggable="true"
            @click="setActiveParticleLayer(layer.id)"
            @dragstart="startParticleLayerDrag($event, layer.id)"
            @dragover.prevent
            @drop="dropParticleLayer($event, layer.id)"
        >
          <span class="mem-particle-layer-icon">
            {{ index + 1 }}
          </span>

          <span class="mem-particle-layer-text">
            <strong>{{ layer.name }}</strong>
            <small>{{ layer.layer_id ? 'Texture gesetzt' : 'Keine Texture' }}</small>
          </span>

          <v-btn
              icon="mdi-close"
              variant="text"
              size="x-small"
              :disabled="particleLayers.length <= 1"
              @click.stop="removeParticleLayer(layer.id)"
          />
        </button>
      </div>

      <section v-if="activeParticleLayer" class="mem-particle-layer-inspector">
        <header>
          <strong>{{ activeParticleLayer.name }}</strong>
          <small>Diffuse Particle Texture</small>
        </header>

        <v-select
            :model-value="activeParticleLayer.layer_id"
            :items="textureLayerOptions"
            label="Texture Layer"
            density="compact"
            hide-details
            @update:model-value="updateActiveParticleTextureLayer"
        />
      </section>
    </aside>
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
