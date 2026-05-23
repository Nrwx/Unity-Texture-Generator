<template>
  <Dialog
      :state="state"
      :loading="loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <div class="efm-header">
        <div class="efm-title">
          <v-icon size="18">mdi-creation</v-icon>

          <div>
            <strong>Effekte</strong>
            <span>{{ layer?.name || layer?.id || "Ebene" }}</span>
          </div>
        </div>

        <div
            class="efm-status"
            :class="{ active: modifier.values.falloff_preset !== 'constant' }"
        >
          <span />
          {{ loadingPreview ? "Preview..." : falloffLabel }}
        </div>
      </div>
    </template>

    <template #content>
      <div class="efm-content">
        <section class="efm-preview">
          <div class="efm-preview-head">
            <div>
              <span>Backend Preview</span>
              <strong>{{ imageSizeLabel }}</strong>
            </div>

            <button
                type="button"
                class="efm-ghost-btn"
                :disabled="loadingPreview"
                @click="requestPreviewNow"
            >
              Aktualisieren
            </button>
          </div>

          <div class="efm-stage">
            <div class="efm-checker">
              <div
                  ref="falloffSurface"
                  class="efm-image"
                  @dblclick.prevent="addCustomPointFromEvent"
                  @pointerdown.prevent="grabFalloffCenter"
                  @pointermove="moveFalloffCenter"
                  @pointerup="releaseFalloffCenter"
                  @pointerleave="releaseFalloffCenter"
              >
                <canvas
                    ref="previewCanvas"
                    class="efm-canvas"
                />

                <div
                    v-if="!hasCustomFalloff"
                    class="efm-falloff-field"
                    :class="[
                        `preset-${modifier.values.falloff_preset}`,
                        { inverted: modifier.values.falloff_inverted }
                    ]"
                >
                  <div
                      class="efm-falloff-radius"
                      :style="{
                          width: `${modifier.values.falloff_radius}%`,
                          height: `${modifier.values.falloff_radius}%`,
                          left: `${modifier.values.falloff_center_x * 100}%`,
                          top: `${modifier.values.falloff_center_y * 100}%`,
                      }"
                  />

                  <div
                      class="efm-falloff-center"
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
                    class="efm-custom-falloff-layer"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                  <polyline
                      v-if="modifier.values.falloff_custom_points.length > 1"
                      class="efm-custom-falloff-line"
                      :points="customFalloffPolyline"
                  />

                  <circle
                      v-for="point in modifier.values.falloff_custom_points"
                      :key="`${point.id}-custom-radius`"
                      class="efm-custom-falloff-radius"
                      :cx="point.x * 100"
                      :cy="point.y * 100"
                      :r="modifier.values.falloff_radius / 2"
                  />

                  <g
                      v-for="(point, index) in modifier.values.falloff_custom_points"
                      :key="point.id"
                      class="efm-custom-point"
                      :class="{ active: activeCustomPointId === point.id }"
                      @pointerdown.prevent.stop="grabCustomPoint(point.id)"
                      @dblclick.prevent.stop="removeCustomPoint(point.id)"
                  >
                    <circle
                        class="efm-custom-point-core"
                        :cx="point.x * 100"
                        :cy="point.y * 100"
                        r="2.8"
                    />

                    <circle
                        class="efm-custom-point-ring"
                        :cx="point.x * 100"
                        :cy="point.y * 100"
                        r="4.4"
                    />

                    <text
                        class="efm-custom-point-label"
                        :x="point.x * 100"
                        :y="point.y * 100 - 6"
                    >
                      {{ index + 1 }}
                    </text>
                  </g>
                </svg>

                <div class="efm-falloff-hint">
                  <v-icon size="17">mdi-crosshairs-gps</v-icon>
                  {{ hasCustomFalloff ? "Doppelklick: Punkt · Drag: Verschieben" : "Drag Falloff Center" }}
                </div>

                <div
                    v-if="loadingPreview"
                    class="efm-preview-loading"
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

          <div class="efm-meta">
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

        <section class="efm-workspace overflow-y-auto">
          <nav class="efm-tools">
            <button
                v-for="item in effectItems"
                :key="item.key"
                type="button"
                class="efm-tool"
                :class="{ active: modifier.values.effects_effect === item.key }"
                @click="selectEffect(item.key)"
            >
              <v-icon size="18">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </button>
          </nav>

          <div class="efm-view">
            <div class="efm-view-head">
              <div>
                <strong>{{ activeEffectLabel }}</strong>
                <span>{{ activeEffectDescription }}</span>
              </div>

              <button
                  type="button"
                  class="efm-ghost-btn"
                  @click="resetValues"
              >
                Reset
              </button>
            </div>

            <div class="efm-section">
              <template v-if="modifier.values.effects_effect === 'noise'">
                <div class="efm-control-card">
                  <header>
                    <strong>Rauschlevel</strong>
                    <small>{{ modifier.values.noise_level }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.noise_level"
                      label="Rauschen"
                      :min="0"
                      :max="100"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="efm-info-card">
                  <v-icon size="20">mdi-grain</v-icon>

                  <div>
                    <strong>Random Noise</strong>
                    <span>Erzeugt zufällige Pixelabweichungen. Für reproduzierbare Previews steuert der Falloff-Seed die Zufallsverteilung.</span>
                  </div>
                </div>
              </template>

              <template v-else-if="modifier.values.effects_effect === 'pixelate'">
                <div class="efm-control-card">
                  <header>
                    <strong>Pixelgröße</strong>
                    <small>{{ modifier.values.pixel_size }}px</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.pixel_size"
                      label="Pixelgröße"
                      :min="1"
                      :max="100"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="efm-info-card">
                  <v-icon size="20">mdi-grid</v-icon>

                  <div>
                    <strong>Block Sampling</strong>
                    <span>Jeder Block übernimmt den Durchschnitt seiner Pixel. Der Falloff mischt Original und Pixelate-Ergebnis.</span>
                  </div>
                </div>
              </template>

              <template v-else-if="modifier.values.effects_effect === 'glass'">
                <div class="efm-select-card">
                  <strong>Glas Effekt</strong>
                  <small>glass_effect_type</small>

                  <v-select
                      v-model="modifier.values.glass_effect_type"
                      :items="glassEffectTypes"
                      label="Typ"
                      density="compact"
                      hide-details
                  />
                </div>

                <div
                    v-if="modifier.values.glass_effect_type === 1"
                    class="efm-select-card"
                >
                  <strong>Frost Mode</strong>
                  <small>glass_frost_mode</small>

                  <v-select
                      v-model="modifier.values.glass_frost_mode"
                      :items="glassFrostModes"
                      label="Frost Mode"
                      density="compact"
                      hide-details
                  />
                </div>

                <div
                    v-if="modifier.values.glass_effect_type === 1"
                    class="efm-control-card"
                >
                  <header>
                    <strong>Frost Strength</strong>
                    <small>{{ modifier.values.glass_frost_strength }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.glass_frost_strength"
                      label="Frost Strength"
                      :min="0"
                      :max="50"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div
                    v-if="modifier.values.glass_effect_type === 2"
                    class="efm-control-card"
                >
                  <header>
                    <strong>Blur Radius</strong>
                    <small>{{ modifier.values.glass_blur_radius }}px</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.glass_blur_radius"
                      label="Blur Radius"
                      :min="0"
                      :max="50"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div
                    v-if="modifier.values.glass_effect_type === 3"
                    class="efm-control-card"
                >
                  <header>
                    <strong>Crack Intensity</strong>
                    <small>{{ modifier.values.glass_crack_intensity }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.glass_crack_intensity"
                      label="Crack Intensity"
                      :min="0"
                      :max="100"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div
                    v-if="modifier.values.glass_effect_type === 4"
                    class="efm-control-card"
                >
                  <header>
                    <strong>Reflection Strength</strong>
                    <small>{{ modifier.values.glass_reflection_strength }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.glass_reflection_strength"
                      label="Reflection Strength"
                      :min="0"
                      :max="1"
                      :step="0.05"
                      thumb-label
                      hide-details
                  />
                </div>
              </template>

              <template v-else>
                <div class="efm-control-card">
                  <header>
                    <strong>Deepness Factor</strong>
                    <small>{{ modifier.values.deepness_factor }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.deepness_factor"
                      label="Deepness"
                      :min="0"
                      :max="3"
                      :step="0.05"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="efm-control-card">
                  <header>
                    <strong>Highness Factor</strong>
                    <small>{{ modifier.values.highness_factor }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.highness_factor"
                      label="Highness"
                      :min="0"
                      :max="3"
                      :step="0.05"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="efm-info-card">
                  <v-icon size="20">mdi-terrain</v-icon>

                  <div>
                    <strong>Tiefe / Höhe</strong>
                    <span>Dunkle Pixel werden über Deepness, helle Pixel über Highness beeinflusst.</span>
                  </div>
                </div>
              </template>

              <div class="efm-divider" />

              <div class="efm-falloff-card">
                <header>
                  <div>
                    <strong>Falloff Editor</strong>
                    <small>{{ falloffLabel }}</small>
                  </div>

                  <button
                      type="button"
                      class="efm-mini-btn"
                      @click="modifier.values.falloff_inverted = !modifier.values.falloff_inverted"
                  >
                    <v-icon size="16">mdi-invert-colors</v-icon>
                    {{ modifier.values.falloff_inverted ? "Inverted" : "Normal" }}
                  </button>
                  <button
                      v-if="hasCustomFalloff"
                      type="button"
                      class="efm-mini-btn"
                      @click="modifier.values.falloff_custom_points = []; modifier.values.falloff_custom_enabled = false"
                  >
                    <v-icon size="16">mdi-vector-point-minus</v-icon>
                    Clear
                  </button>
                </header>

                <div class="efm-falloff-grid">
                  <button
                      v-for="preset in falloffPresets"
                      :key="preset.value"
                      type="button"
                      class="efm-falloff-preset"
                      :class="{ active: preset.value === 'custom' ? hasCustomFalloff : modifier.values.falloff_preset === preset.value}"
                      @click="selectFalloffPreset(preset.value)"
                  >
                    <v-icon size="18">
                      {{ preset.icon || 'mdi-chart-bell-curve' }}
                    </v-icon>

                    <span>{{ preset.title }}</span>
                  </button>
                </div>

                <div class="efm-control-card compact">
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

                <div class="efm-control-card compact">
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
                    class="efm-control-card compact"
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

                <div class="efm-center-grid">
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
      <div class="efm-actions">
        <v-btn
            variant="text"
            class="efm-cancel"
            @click="emitEvent(config.emit, false)"
        >
          Abbrechen
        </v-btn>

        <v-spacer />

        <span class="efm-action-state">
          {{ operationSummary }}
        </span>

        <v-btn
            class="efm-apply"
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
  modifierEffectsModel,
  modifierEffectsProps,
} from "@/view/models/page/modifier/effects/model";

export default defineComponent({
  name: "ModifierEffectsDialog",
  components: {
    Dialog,
  },
  props: modifierEffectsProps,
  setup(props, { emit }) {
    return {
      ...modifierEffectsModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "_Effects";
</style>