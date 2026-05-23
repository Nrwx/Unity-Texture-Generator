<template>
  <Dialog
      :state="state"
      :loading="loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <div class="dtm-header">
        <div class="dtm-title">
          <v-icon size="18">mdi-image-filter-center-focus</v-icon>

          <div>
            <strong>Schärfe & Details</strong>
            <span>{{ layer?.name || layer?.id || "Ebene" }}</span>
          </div>
        </div>

        <div class="dtm-status" :class="{ active: hasPoints }">
          <span />
          {{ loadingPreview ? "Preview..." : influenceLabel }}
        </div>
      </div>
    </template>

    <template #content>
      <div class="dtm-content">
        <section class="dtm-preview">
          <div class="dtm-preview-head">
            <div>
              <span>Backend Preview</span>
              <strong>{{ imageSizeLabel }}</strong>
            </div>

            <button
                type="button"
                class="dtm-ghost-btn"
                :disabled="loadingPreview"
                @click="requestPreviewNow"
            >
              Aktualisieren
            </button>
          </div>

          <div class="dtm-stage">
            <div class="dtm-checker">
              <div
                  ref="pointSurface"
                  class="dtm-image"
                  @dblclick="addPointFromEvent"
                  @pointermove="moveActivePoint"
                  @pointerup="releasePoint"
                  @pointerleave="releasePoint"
              >
                <canvas
                    ref="previewCanvas"
                    class="dtm-canvas"
                />

                <svg
                    class="dtm-point-layer"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                  <polyline
                      v-if="modifier.points.length > 1"
                      class="dtm-chain-line"
                      :points="polylinePoints"
                  />

                  <circle
                      v-for="point in modifier.points"
                      :key="`${point.id}-influence`"
                      class="dtm-point-influence"
                      :cx="point.x * 100"
                      :cy="point.y * 100"
                      :r="pointInfluenceRadius"
                  />

                  <g
                      v-for="(point, index) in modifier.points"
                      :key="point.id"
                      class="dtm-point"
                      :class="{ active: activePointId === point.id }"
                      @pointerdown.prevent.stop="grabPoint(point.id)"
                      @dblclick.prevent.stop="removePoint(point.id)"
                  >
                    <circle
                        class="dtm-point-core"
                        :cx="point.x * 100"
                        :cy="point.y * 100"
                        r="2.8"
                    />

                    <circle
                        class="dtm-point-ring"
                        :cx="point.x * 100"
                        :cy="point.y * 100"
                        r="4.4"
                    />

                    <text
                        class="dtm-point-label"
                        :x="point.x * 100"
                        :y="point.y * 100 - 6"
                    >
                      {{ index + 1 }}
                    </text>
                  </g>
                </svg>

                <div
                    v-if="!hasPoints"
                    class="dtm-global-hint"
                >
                  <v-icon size="18">mdi-image-outline</v-icon>
                  Ganzes Bild
                </div>

                <div
                    v-if="loadingPreview"
                    class="dtm-preview-loading"
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

          <div class="dtm-meta">
            <div>
              <span>Effect</span>
              <strong>{{ activeEffectLabel }}</strong>
            </div>

            <div>
              <span>Influence</span>
              <strong>{{ influenceLabel }}</strong>
            </div>

            <div>
              <span>Stack</span>
              <strong>{{ operationSummary }}</strong>
            </div>
          </div>
        </section>

        <section class="dtm-workspace">
          <nav class="dtm-tools">
            <button
                v-for="item in effectItems"
                :key="item.key"
                type="button"
                class="dtm-tool"
                :class="{ active: modifier.values.details_effect === item.key }"
                @click="selectEffect(item.key)"
            >
              <v-icon size="18">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </button>
          </nav>

          <div class="dtm-point-actions">
            <button
                type="button"
                class="dtm-point-action"
                @click="addCenterPoint"
            >
              <v-icon size="17">mdi-crosshairs-gps</v-icon>
              Center
            </button>

            <button
                type="button"
                class="dtm-point-action"
                @click="addCornerChain"
            >
              <v-icon size="17">mdi-vector-polyline-plus</v-icon>
              Chain
            </button>

            <button
                type="button"
                class="dtm-point-action"
                @click="clearPoints"
            >
              <v-icon size="17">mdi-vector-point-minus</v-icon>
              Clear
            </button>
          </div>

          <div class="dtm-view overflow-y-auto">
            <div class="dtm-view-head">
              <div>
                <strong>{{ activeEffectLabel }}</strong>
                <span>{{ activeEffectDescription }}</span>
              </div>

              <button
                  type="button"
                  class="dtm-ghost-btn"
                  @click="resetValues"
              >
                Reset
              </button>
            </div>

            <div class="dtm-section">
              <template v-if="modifier.values.details_effect === 'sharpness'">
                <div class="dtm-control-card">
                  <header>
                    <strong>Schärfe</strong>
                    <small>{{ modifier.values.sharpness }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.sharpness"
                      label="Schärfe"
                      :min="0"
                      :max="2"
                      :step="0.1"
                      thumb-label
                      hide-details
                  />
                </div>
              </template>

              <template v-else-if="modifier.values.details_effect === 'blur'">
                <div class="dtm-control-card">
                  <header>
                    <strong>Weichzeichnen</strong>
                    <small>{{ modifier.values.blur }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.blur"
                      label="Weichzeichnen"
                      :min="0"
                      :max="10"
                      :step="0.1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dtm-control-card">
                  <header>
                    <strong>Radius</strong>
                    <small>{{ modifier.values.blur_radius }}px</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.blur_radius"
                      label="Radius"
                      :min="1"
                      :max="200"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dtm-select-card">
                  <strong>Weichzeichnungs-Filter</strong>
                  <small>blur_mode</small>

                  <v-select
                      v-model="modifier.values.blur_mode"
                      :items="blurModes"
                      label="Filter"
                      density="compact"
                      hide-details
                  />
                </div>

                <div class="dtm-select-card">
                  <strong>Weichzeichnungs-Verlauf</strong>
                  <small>blur_falloff_mode</small>

                  <v-select
                      v-model="modifier.values.blur_falloff_mode"
                      :items="blurFalloffModes"
                      label="Falloff"
                      density="compact"
                      hide-details
                  />
                </div>

                <div class="dtm-select-card">
                  <strong>Weichzeichnungs-Typ</strong>
                  <small>blur_type</small>

                  <v-select
                      v-model="modifier.values.blur_type"
                      :items="blurTypes"
                      label="Typ"
                      density="compact"
                      hide-details
                  />
                </div>
              </template>

              <template v-else-if="modifier.values.details_effect === 'edge_detection'">
                <label
                    class="dtm-toggle-card"
                    :class="{ active: modifier.values.edge_detection }"
                >
                  <span class="dtm-toggle-icon">
                    <v-icon size="23">mdi-vector-polyline</v-icon>
                  </span>

                  <span class="dtm-toggle-text">
                    <strong>Kantenerkennung</strong>
                    <small>Canny, Sobel oder Laplacian.</small>
                  </span>

                  <v-switch
                      v-model="modifier.values.edge_detection"
                      color="primary"
                      hide-details
                  />
                </label>

                <div class="dtm-mode-card">
                  <strong>Methode</strong>
                  <small>edge_method</small>

                  <div class="dtm-mode-grid">
                    <button
                        v-for="method in edgeMethods"
                        :key="method.value"
                        type="button"
                        class="dtm-mode"
                        :class="{ active: modifier.values.edge_method === method.value }"
                        @click="modifier.values.edge_method = method.value"
                    >
                      <v-icon size="18">{{ method.icon }}</v-icon>
                      <span>{{ method.title }}</span>
                    </button>
                  </div>
                </div>

                <div class="dtm-control-card">
                  <header>
                    <strong>Threshold 1</strong>
                    <small>{{ modifier.values.edge_threshold1 }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.edge_threshold1"
                      label="Threshold 1"
                      :min="0"
                      :max="255"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dtm-control-card">
                  <header>
                    <strong>Threshold 2</strong>
                    <small>{{ modifier.values.edge_threshold2 }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.edge_threshold2"
                      label="Threshold 2"
                      :min="0"
                      :max="255"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dtm-control-card">
                  <header>
                    <strong>Alpha</strong>
                    <small>{{ modifier.values.edge_alpha }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.edge_alpha"
                      label="Alpha"
                      :min="0"
                      :max="1"
                      :step="0.05"
                      thumb-label
                      hide-details
                  />
                </div>
              </template>

              <template v-else-if="modifier.values.details_effect === 'edge_smooth'">
                <div class="dtm-control-card">
                  <header>
                    <strong>Mask Expand</strong>
                    <small>{{ modifier.values.mask_expand }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.mask_expand"
                      label="Mask Expand"
                      :min="0"
                      :max="10"
                      :step="0.1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dtm-control-card">
                  <header>
                    <strong>Sharpness Boost</strong>
                    <small>{{ modifier.values.sharpness_boost }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.sharpness_boost"
                      label="Sharpness Boost"
                      :min="0"
                      :max="3"
                      :step="0.1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="dtm-edge-grid">
                  <v-text-field
                      v-model.number="modifier.values.edge_threshold_min"
                      type="number"
                      label="Edge Min"
                      density="compact"
                      hide-details
                  />

                  <v-text-field
                      v-model.number="modifier.values.edge_threshold_max"
                      type="number"
                      label="Edge Max"
                      density="compact"
                      hide-details
                  />
                </div>
              </template>

              <template v-else>
                <div class="dtm-control-card">
                  <header>
                    <strong>Blending Intensity</strong>
                    <small>{{ modifier.values.blending_intensity }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.blending_intensity"
                      label="Blending"
                      :min="0"
                      :max="100"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>
              </template>

              <div class="dtm-divider" />

              <div class="dtm-control-card">
                <header>
                  <strong>Point Radius</strong>
                  <small>{{ modifier.values.point_radius }}%</small>
                </header>

                <v-slider
                    v-model="modifier.values.point_radius"
                    label="Point Radius"
                    :min="1"
                    :max="100"
                    :step="1"
                    thumb-label
                    hide-details
                />
              </div>

              <div class="dtm-control-card">
                <header>
                  <strong>Point Strength</strong>
                  <small>{{ modifier.values.point_strength }}</small>
                </header>

                <v-slider
                    v-model="modifier.values.point_strength"
                    label="Point Strength"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    thumb-label
                    hide-details
                />
              </div>

              <div class="dtm-mode-card">
                <strong>Point Falloff</strong>
                <small>Gilt für alle Punkte und Chain-Segmente.</small>

                <div class="dtm-mode-grid">
                  <button
                      v-for="mode in pointFalloffModes"
                      :key="mode.value"
                      type="button"
                      class="dtm-mode"
                      :class="{ active: modifier.values.point_falloff === mode.value }"
                      @click="modifier.values.point_falloff = mode.value"
                  >
                    <v-icon size="18">{{ mode.icon }}</v-icon>
                    <span>{{ mode.title }}</span>
                  </button>
                </div>
              </div>

              <label
                  class="dtm-toggle-card"
                  :class="{ active: modifier.values.point_chain }"
              >
                <span class="dtm-toggle-icon">
                  <v-icon size="23">mdi-vector-polyline</v-icon>
                </span>

                <span class="dtm-toggle-text">
                  <strong>Point Chain</strong>
                  <small>Verbindet Punkte als o-o-o Einflusslinie.</small>
                </span>

                <v-switch
                    v-model="modifier.values.point_chain"
                    color="primary"
                    hide-details
                />
              </label>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template #action>
      <div class="dtm-actions">
        <v-btn
            variant="text"
            class="dtm-cancel"
            @click="emitEvent(config.emit, false)"
        >
          Abbrechen
        </v-btn>

        <v-spacer />

        <span class="dtm-action-state">
          {{ operationSummary }}
        </span>

        <v-btn
            class="dtm-apply"
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
  modifierDetailsModel,
  modifierDetailsProps,
} from "@/view/models/page/modifier/details/model";

export default defineComponent({
  name: "ModifierDetailsDialog",
  components: { Dialog },
  props: modifierDetailsProps,
  setup(props, { emit }) {
    return {
      ...modifierDetailsModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "_Details";
</style>