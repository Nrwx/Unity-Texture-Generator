<template>
  <Dialog
      :state="state"
      :loading="loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <div class="dsm-header">
        <div class="dsm-title">
          <v-icon size="18">mdi-wave</v-icon>

          <div>
            <strong>Verzerrung</strong>
            <span>{{ layer?.name || layer?.id || "Ebene" }}</span>
          </div>
        </div>

        <div
            class="dsm-status"
            :class="{ active: hasCustomFalloff || modifier.values.falloff_preset !== 'constant' }"
        >
          <span />
          {{ loadingPreview ? "Preview..." : falloffLabel }}
        </div>
      </div>
    </template>

    <template #content>
      <div class="dsm-content">
        <section class="dsm-preview">
          <div class="dsm-preview-head">
            <div>
              <span>Backend Preview</span>
              <strong>{{ imageSizeLabel }}</strong>
            </div>

            <button
                type="button"
                class="dsm-ghost-btn"
                :disabled="loadingPreview"
                @click="requestPreviewNow"
            >
              Aktualisieren
            </button>
          </div>

          <div class="dsm-stage">
            <div class="dsm-checker">
              <div
                  ref="falloffSurface"
                  class="dsm-image"
                  @dblclick.prevent="addCustomPointFromEvent"
                  @pointerdown.prevent="grabFalloffCenter"
                  @pointermove="moveFalloffCenter"
                  @pointerup="releaseFalloffCenter"
                  @pointerleave="releaseFalloffCenter"
              >
                <canvas
                    ref="previewCanvas"
                    class="dsm-canvas"
                />

                <div
                    v-if="!hasCustomFalloff"
                    class="dsm-falloff-field"
                    :class="[
                        `preset-${modifier.values.falloff_preset}`,
                        { inverted: modifier.values.falloff_inverted }
                    ]"
                >
                  <div
                      class="dsm-falloff-radius"
                      :style="{
                          width: `${modifier.values.falloff_radius}%`,
                          height: `${modifier.values.falloff_radius}%`,
                          left: `${modifier.values.falloff_center_x * 100}%`,
                          top: `${modifier.values.falloff_center_y * 100}%`,
                      }"
                  />

                  <div
                      class="dsm-falloff-center"
                      :class="{ dragging: draggingFalloffCenter }"
                      :style="{
                          left: `${modifier.values.falloff_center_x * 100}%`,
                          top: `${modifier.values.falloff_center_y * 100}%`,
                      }"
                  >
                    <span />
                  </div>
                </div>

                <svg
                    v-if="hasCustomFalloff"
                    class="dsm-custom-falloff-layer"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                  <polyline
                      v-if="modifier.values.falloff_custom_points.length > 1"
                      class="dsm-custom-falloff-line"
                      :points="customFalloffPolyline"
                  />

                  <circle
                      v-for="point in modifier.values.falloff_custom_points"
                      :key="`${point.id}-custom-radius`"
                      class="dsm-custom-falloff-radius"
                      :cx="point.x * 100"
                      :cy="point.y * 100"
                      :r="modifier.values.falloff_radius / 2"
                  />

                  <g
                      v-for="(point, index) in modifier.values.falloff_custom_points"
                      :key="point.id"
                      class="dsm-custom-point"
                      :class="{ active: activeCustomPointId === point.id }"
                      @pointerdown.prevent.stop="grabCustomPoint(point.id)"
                      @dblclick.prevent.stop="removeCustomPoint(point.id)"
                  >
                    <circle
                        class="dsm-custom-point-core"
                        :cx="point.x * 100"
                        :cy="point.y * 100"
                        r="2.8"
                    />

                    <circle
                        class="dsm-custom-point-ring"
                        :cx="point.x * 100"
                        :cy="point.y * 100"
                        r="4.4"
                    />

                    <text
                        class="dsm-custom-point-label"
                        :x="point.x * 100"
                        :y="point.y * 100 - 6"
                    >
                      {{ index + 1 }}
                    </text>
                  </g>
                </svg>

                <div class="dsm-falloff-hint">
                  <v-icon size="17">mdi-crosshairs-gps</v-icon>
                  {{ hasCustomFalloff ? "Doppelklick: Punkt · Drag: Verschieben" : "Drag Falloff Center" }}
                </div>

                <div
                    v-if="loadingPreview"
                    class="dsm-preview-loading"
                >
                  <v-progress-circular
                      indeterminate
                      size="28"
                  />

                  <span>Preview wird gerendert…</span>
                </div>
              </div>
            </div>
          </div>

          <div class="dsm-meta">
            <div>
              <span>Effect</span>
              <strong>{{ activeEffectLabel }}</strong>
            </div>

            <div>
              <span>Falloff</span>
              <strong>{{ falloffLabel }}</strong>
            </div>

            <div>
              <span>Stack</span>
              <strong>{{ operationSummary }}</strong>
            </div>
          </div>
        </section>

        <section class="dsm-workspace overflow-y-auto">
          <nav class="dsm-tools">
            <button
                v-for="item in distortItems"
                :key="item.key"
                type="button"
                class="dsm-tool"
                :class="{ active: modifier.values.distort_effect === item.key }"
                @click="selectEffect(item.key)"
            >
              <v-icon size="18">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </button>
          </nav>

          <div class="dsm-view">
            <div class="dsm-view-head">
              <div>
                <strong>{{ activeEffectLabel }}</strong>
                <span>{{ activeEffectDescription }}</span>
              </div>

              <button
                  type="button"
                  class="dsm-ghost-btn"
                  @click="resetValues"
              >
                Reset
              </button>
            </div>

            <div class="dsm-section">
              <template v-if="modifier.values.distort_effect === 'distort'">
                <div class="dsm-control-card">
                  <header>
                    <strong>Distortion Factor</strong>
                    <small>{{ modifier.values.distortion_factor }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.distortion_factor"
                      label="Verzerrung"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      thumb-label
                      hide-details
                  />
                </div>
              </template>

              <template v-else-if="modifier.values.distort_effect === 'wave'">
                <div class="dsm-control-card">
                  <header>
                    <strong>Wave Strength</strong>
                    <small>{{ modifier.values.wave_strength }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.wave_strength"
                      label="Wave Strength"
                      :min="0"
                      :max="100"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dsm-control-card">
                  <header>
                    <strong>Wave Frequency</strong>
                    <small>{{ modifier.values.wave_frequency }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.wave_frequency"
                      label="Wave Frequency"
                      :min="1"
                      :max="200"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dsm-mode-card">
                  <strong>Wave Axis</strong>
                  <small>Richtung der Wellenverschiebung.</small>

                  <div class="dsm-mode-grid">
                    <button
                        v-for="axis in waveAxisItems"
                        :key="axis.value"
                        type="button"
                        class="dsm-mode"
                        :class="{ active: modifier.values.wave_axis === axis.value }"
                        @click="modifier.values.wave_axis = axis.value"
                    >
                      <v-icon size="18">{{ axis.icon }}</v-icon>
                      <span>{{ axis.title }}</span>
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="dsm-control-card">
                  <header>
                    <strong>Max Shift Ratio</strong>
                    <small>{{ modifier.values.max_shift_ratio }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.max_shift_ratio"
                      label="Versatz"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      thumb-label
                      hide-details
                  />
                </div>
              </template>

              <div class="dsm-divider" />

              <div class="dsm-falloff-card">
                <header>
                  <div>
                    <strong>Falloff Editor</strong>
                    <small>{{ falloffLabel }}</small>
                  </div>

                  <div class="dsm-mini-actions">
                    <button
                        type="button"
                        class="dsm-mini-btn"
                        @click="modifier.values.falloff_inverted = !modifier.values.falloff_inverted"
                    >
                      <v-icon size="16">mdi-invert-colors</v-icon>
                      {{ modifier.values.falloff_inverted ? "Inverted" : "Normal" }}
                    </button>

                    <button
                        v-if="hasCustomFalloff"
                        type="button"
                        class="dsm-mini-btn"
                        @click="clearCustomFalloff"
                    >
                      <v-icon size="16">mdi-vector-point-minus</v-icon>
                      Clear
                    </button>
                  </div>
                </header>

                <div class="dsm-falloff-grid">
                  <button
                      v-for="preset in falloffPresets"
                      :key="preset.value"
                      type="button"
                      class="dsm-falloff-preset"
                      :class="{
                          active:
                              preset.value === 'custom'
                                  ? hasCustomFalloff
                                  : modifier.values.falloff_preset === preset.value
                      }"
                      @click="selectFalloffPreset(preset.value)"
                  >
                    <v-icon size="18">
                      {{ preset.icon || 'mdi-chart-bell-curve' }}
                    </v-icon>

                    <span>{{ preset.title }}</span>
                  </button>
                </div>

                <div class="dsm-control-card compact">
                  <header>
                    <strong>Radius</strong>
                    <small>{{ modifier.values.falloff_radius }}%</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.falloff_radius"
                      label="Falloff Radius"
                      :min="1"
                      :max="200"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dsm-control-card compact">
                  <header>
                    <strong>Strength</strong>
                    <small>{{ modifier.values.falloff_strength }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.falloff_strength"
                      label="Falloff Strength"
                      :min="0"
                      :max="3"
                      :step="0.05"
                      thumb-label
                      hide-details
                  />
                </div>

                <div
                    v-if="modifier.values.falloff_preset === 'random'"
                    class="dsm-control-card compact"
                >
                  <header>
                    <strong>Random Seed</strong>
                    <small>{{ modifier.values.falloff_random_seed }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.falloff_random_seed"
                      label="Seed"
                      :min="1"
                      :max="999999"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dsm-center-grid">
                  <v-text-field
                      v-model.number="modifier.values.falloff_center_x"
                      type="number"
                      label="Center X"
                      density="compact"
                      :step="0.01"
                      :min="0"
                      :max="1"
                      hide-details
                  />

                  <v-text-field
                      v-model.number="modifier.values.falloff_center_y"
                      type="number"
                      label="Center Y"
                      density="compact"
                      :step="0.01"
                      :min="0"
                      :max="1"
                      hide-details
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template #action>
      <div class="dsm-actions">
        <v-btn
            variant="text"
            class="dsm-cancel"
            @click="emitEvent(config.emit, false)"
        >
          Abbrechen
        </v-btn>

        <v-spacer />

        <span class="dsm-action-state">
          {{ operationSummary }}
        </span>

        <v-btn
            class="dsm-apply"
            :loading="loading"
            @click="submit"
        >
          <v-icon size="18" class="mr-1">mdi-check</v-icon>
          Anwenden
        </v-btn>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import Dialog from "@/components/Dialog/Dialog.vue";
import {
  modifierDistortModel,
  modifierDistortProps,
} from "@/view/models/page/modifier/distort/model";

export default defineComponent({
  name: "DistortModifierDialog",
  components: {
    Dialog,
  },
  props: modifierDistortProps,
  setup(props, { emit }) {
    return {
      ...modifierDistortModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "_Distort";
</style>