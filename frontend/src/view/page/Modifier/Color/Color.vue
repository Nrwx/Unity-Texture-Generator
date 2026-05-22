<template>
  <Dialog
      :state="state"
      :loading="loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <div class="clm-header">
        <div class="clm-title">
          <v-icon size="18">mdi-palette</v-icon>

          <div>
            <strong>Farbe & Licht</strong>
            <span>{{ layer?.name || layer?.id || "Ebene" }}</span>
          </div>
        </div>

        <div class="clm-status" :class="`is-${maskType}`">
          <span />
          {{ loadingPreview ? "Preview..." : maskLabel }}
        </div>
      </div>
    </template>

    <template #content>
      <div class="clm-content">
        <section class="clm-preview">
          <div class="clm-preview-head">
            <div>
              <span>Backend Preview</span>
              <strong>{{ imageSizeLabel }}</strong>
            </div>

            <button
                type="button"
                class="clm-ghost-btn"
                :disabled="loadingPreview"
                @click="requestPreviewNow"
            >
              Aktualisieren
            </button>
          </div>

          <div class="clm-stage">
            <div class="clm-checker">
              <div class="clm-image">
                <canvas
                    ref="previewCanvas"
                    class="clm-canvas"
                />

                <div
                    v-if="hasSelectMask"
                    class="clm-selection"
                    :class="`shape-${selectMaskShape}`"
                    :style="selectionStyle"
                />

                <div
                    v-if="loadingPreview"
                    class="clm-preview-loading"
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

          <div class="clm-meta">
            <div>
              <span>Mask</span>
              <strong>{{ maskLabel }}</strong>
            </div>

            <div>
              <span>Size</span>
              <strong>{{ imageSizeLabel }}</strong>
            </div>

            <div>
              <span>Stack</span>
              <strong>{{ operationSummary }}</strong>
            </div>
          </div>
        </section>

        <section class="clm-workspace">
          <nav class="clm-tools">
            <button
                v-for="item in panelItems"
                :key="item.key"
                type="button"
                class="clm-tool"
                :class="{ active: modifier.ui.activePanel === item.key }"
                @click="selectPanel(item.key)"
            >
              <v-icon size="18">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </button>
          </nav>

          <div class="clm-mask-source">
            <div :class="{ active: maskType === 'select' }">
              <v-icon size="18">mdi-selection-drag</v-icon>
              <span>Selection</span>
            </div>

            <div :class="{ active: maskType === 'layer' }">
              <v-icon size="18">mdi-layers-triple</v-icon>
              <span>Layer Mask</span>
            </div>

            <div :class="{ active: maskType === 'none' }">
              <v-icon size="18">mdi-image-outline</v-icon>
              <span>Ganze Ebene</span>
            </div>
          </div>

          <Transition name="clm-view" mode="out-in">
            <div
                v-if="modifier.ui.activePanel === 'brightnessContrast'"
                key="brightnessContrast"
                class="clm-view"
            >
              <div class="clm-view-head">
                <div>
                  <strong>Helligkeit / Kontrast</strong>
                  <span>Backend-Wertebereich: 0–200 / 0–100.</span>
                </div>

                <button
                    type="button"
                    class="clm-ghost-btn"
                    @click="resetBrightnessContrast"
                >
                  Reset
                </button>
              </div>

              <div class="clm-section">
                <div class="clm-control-card">
                  <header>
                    <strong>Helligkeit</strong>
                    <small>{{ modifier.values.brightness }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.brightness"
                      label="Helligkeit"
                      :min="0"
                      thumb-color="#78A8FFFF"
                      :max="200"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>

                <div class="clm-control-card">
                  <header>
                    <strong>Kontrast</strong>
                    <small>{{ modifier.values.contrast }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.contrast"
                      label="Kontrast"
                      :min="0"
                      thumb-color="#78A8FFFF"
                      :max="100"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>
              </div>
            </div>

            <div
                v-else-if="modifier.ui.activePanel === 'colorShift'"
                key="colorShift"
                class="clm-view"
            >
              <div class="clm-view-head">
                <div>
                  <strong>Farbverschiebung</strong>
                  <span>color_shift: -100 bis 100.</span>
                </div>

                <button
                    type="button"
                    class="clm-ghost-btn"
                    @click="resetColorShift"
                >
                  Reset
                </button>
              </div>

              <div class="clm-section">
                <div class="clm-control-card">
                  <header>
                    <strong>Farbverschiebung</strong>
                    <small>{{ modifier.values.color_shift }}</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.color_shift"
                      label="Farbverschiebung"
                      :min="-100"
                      :max="100"
                      thumb-color="#78A8FFFF"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>
              </div>
            </div>

            <div
                v-else-if="modifier.ui.activePanel === 'hueRotation'"
                key="hueRotation"
                class="clm-view"
            >
              <div class="clm-view-head">
                <div>
                  <strong>Hue Rotation</strong>
                  <span>hue_variation: -180 bis 180.</span>
                </div>

                <button
                    type="button"
                    class="clm-ghost-btn"
                    @click="resetHueRotation"
                >
                  Reset
                </button>
              </div>

              <div class="clm-section">
                <div class="clm-control-card">
                  <header>
                    <strong>Farbtonvariation</strong>
                    <small>{{ modifier.values.hue_variation }}°</small>
                  </header>

                  <v-slider
                      v-model="modifier.values.hue_variation"
                      label="Farbtonvariation"
                      :min="-180"
                      :max="180"
                      thumb-color="#78A8FFFF"
                      :step="1"
                      thumb-label
                      hide-details
                  />
                </div>
              </div>
            </div>

            <div
                v-else-if="modifier.ui.activePanel === 'invertColors'"
                key="invertColors"
                class="clm-view"
            >
              <div class="clm-view-head">
                <div>
                  <strong>Farben invertieren</strong>
                  <span>invert_colors als Boolean.</span>
                </div>

                <button
                    type="button"
                    class="clm-ghost-btn"
                    @click="resetInvertColors"
                >
                  Reset
                </button>
              </div>

              <label
                  class="clm-toggle-card"
                  :class="{ active: modifier.values.invert_colors }"
              >
    <span class="clm-toggle-icon">
      <v-icon size="23">mdi-invert-colors</v-icon>
    </span>

                <span class="clm-toggle-text">
      <strong>Invertieren</strong>
      <small>Backend rendert nach jeder Änderung neu.</small>
    </span>

                <v-switch
                    v-model="modifier.values.invert_colors"
                    color="primary"
                    hide-details
                />
              </label>
            </div>

            <div
                v-else
                key="colorLookup"
                class="clm-view"
            >
              <div class="clm-view-head">
                <div>
                  <strong>Color Lookup</strong>
                  <span>color_lookup-Modus aus settings.colorLookupModes.</span>
                </div>

                <button
                    type="button"
                    class="clm-ghost-btn"
                    @click="resetColorLookup"
                >
                  Reset
                </button>
              </div>

              <div class="clm-section">
                <div class="clm-lookup-card">
                  <strong>Filmfarben-Filter</strong>
                  <small>Aktiver Modus: {{ modifier.values.color_lookup }}</small>

                  <v-select
                      v-model="modifier.values.color_lookup"
                      :items="colorLookupModes"
                      label="Filmfarben-Filter"
                      density="compact"
                      hide-details
                  />
                </div>
              </div>
            </div>
          </Transition>
        </section>
      </div>
    </template>

    <template #action>
      <div class="clm-actions">
        <v-btn
            variant="text"
            class="clm-cancel"
            @click="emitEvent(config.emit, false)"
        >
          Abbrechen
        </v-btn>

        <v-spacer />

        <span class="clm-action-state">
          {{ operationSummary }}
        </span>

        <v-btn
            class="clm-apply"
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
  modifierColorModel,
  modifierColorProps,
} from "@/view/models/page/modifier/color/model";

export default defineComponent({
  name: "ModifierColorDialog",
  components: { Dialog },
  props: modifierColorProps,
  setup(props, { emit }) {
    return {
      ...modifierColorModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@use "_Color";
</style>