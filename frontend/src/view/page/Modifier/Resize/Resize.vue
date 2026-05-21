<template>
  <Dialog
      :state="state"
      :loading="modifier.loading"
      :theme="theme"
      :data="config"
      @update:component-event="emitEvent"
  >
    <template #header>
      <div class="imd-header">
        <div class="imd-title">
          <v-icon size="18">mdi-image-edit</v-icon>

          <div>
            <strong>Image Transform</strong>
            <span>{{ layer?.name || layer?.id || "Ebene" }}</span>
          </div>
        </div>

        <div class="imd-status" :class="`is-${maskType}`">
          <span/>
          {{ maskLabel }}
        </div>
      </div>
    </template>

    <template #content>
      <div class="imd-content">
        <section class="imd-preview">
          <div class="imd-preview-head">
            <div>
              <span>Preview</span>
              <strong>{{ imageWidth }} × {{ imageHeight }}</strong>
            </div>

            <button
                v-if="hasSelectMask"
                type="button"
                class="imd-ghost-btn"
                @click="applySelectionCrop"
            >
              Selection → Crop
            </button>
          </div>

          <div class="imd-stage">
            <div class="imd-checker">
              <div class="imd-image">
                <img
                    v-if="layer?.url"
                    :src="layer.url"
                    alt="Layer Preview"
                    draggable="false"
                />

                <div
                    v-if="selectMask"
                    class="imd-selection"
                    :class="`shape-${selectMaskShape}`"
                    :style="selectionStyle"
                />
              </div>
            </div>
          </div>

          <div class="imd-meta">
            <div>
              <span>Crop</span>
              <strong>{{ cropSize.label }}</strong>
            </div>

            <div>
              <span>Output</span>
              <strong>{{ outputSizeLabel }}</strong>
            </div>

            <div>
              <span>Stack</span>
              <strong>{{ operationSummary }}</strong>
            </div>
          </div>
        </section>

        <section class="imd-workspace">
          <nav class="imd-tools" aria-label="Image transform tools">
            <button
                v-for="item in panelItems"
                :key="item.key"
                type="button"
                class="imd-tool"
                :class="{
                    active: modifier.ui.activePanel === item.key,
                    disabled: !item.enabled,
                }"
                :disabled="!item.enabled"
                @click="selectPanel(item.key)"
            >
              <v-icon size="18">{{ item.icon }}</v-icon>
              <span>{{ item.title }}</span>
            </button>
          </nav>

          <Transition name="imd-view" mode="out-in">
            <div
                v-if="modifier.ui.activePanel === 'resize'"
                key="resize"
                class="imd-view"
            >
              <div class="imd-view-head">
                <div>
                  <strong>Resize</strong>
                  <span>Zielgröße, Fitting und Sampling getrennt einstellen.</span>
                </div>

                <button type="button" class="imd-ghost-btn" @click="resetResize">
                  Reset
                </button>
              </div>

              <div class="imd-stepper">
                <button
                    v-for="(step, index) in resizeSteps"
                    :key="step.key"
                    type="button"
                    class="imd-step"
                    :class="{
          active: modifier.ui.resizeStep === step.key,
          done: index < resizeStepIndex,
      }"
                    @click="goResizeStep(step.key)"
                >
    <span class="imd-step-index">
      <v-icon
          v-if="index < resizeStepIndex"
          size="15"
      >
        mdi-check
      </v-icon>

      <template v-else>
        {{ index + 1 }}
      </template>
    </span>

                  <span class="imd-step-label">
      <strong>{{ step.title }}</strong>
      <small>{{ step.hint }}</small>
    </span>
                </button>
              </div>

              <Transition name="imd-view" mode="out-in">
                <div
                    v-if="modifier.ui.resizeStep === 'dimensions'"
                    key="resize-dimensions"
                    class="imd-section"
                >
                  <div class="imd-dimensions-card">
                    <div class="imd-dimensions-head">
                      <div>
                        <strong>Output Dimensions</strong>
                        <span>{{ resizeSizeLabel }}</span>
                      </div>

                      <button
                          type="button"
                          class="imd-lock-btn"
                          :class="{ active: modifier.resize.keepAspectRatio }"
                          @click="toggleResizeAspectRatio"
                      >
                        <v-icon size="17">
                          {{ modifier.resize.keepAspectRatio ? "mdi-link-variant" : "mdi-link-variant-off" }}
                        </v-icon>

                        {{ modifier.resize.keepAspectRatio ? "Ratio locked" : "Free size" }}
                      </button>
                    </div>

                    <div class="imd-dimension-inputs">
                      <v-text-field
                          :model-value="resizeWidth"
                          type="number"
                          label="Width"
                          suffix="px"
                          density="compact"
                          hide-details
                          @update:model-value="updateResizeWidth"
                          @focus="setCustomResize"
                      />

                      <button
                          type="button"
                          class="imd-ratio-toggle"
                          :class="{ active: modifier.resize.keepAspectRatio }"
                          @click="toggleResizeAspectRatio"
                      >
                        <v-icon size="18">
                          {{ modifier.resize.keepAspectRatio ? "mdi-link" : "mdi-link-off" }}
                        </v-icon>
                      </button>

                      <v-text-field
                          :model-value="resizeHeight"
                          type="number"
                          label="Height"
                          suffix="px"
                          density="compact"
                          hide-details
                          @update:model-value="updateResizeHeight"
                          @focus="setCustomResize"
                      />
                    </div>
                  </div>

                  <div class="imd-preset-list">
                    <button
                        v-for="item in resizeOptions"
                        :key="item.value"
                        type="button"
                        class="imd-option"
                        :class="{active: !modifier.resize.isCustom && modifier.resize.index === item.value}"
                        @click="selectResizePreset(item)"
                    >
                      <span>
                        <strong>{{ item.title }}</strong>
                        <small>{{ item.hint }}</small>
                      </span>

                      <v-icon v-if="!modifier.resize.isCustom && modifier.resize.index === item.value" size="17">
                        mdi-check
                      </v-icon>
                    </button>
                  </div>
                </div>

                <div
                    v-else-if="modifier.ui.resizeStep === 'fit'"
                    key="resize-fit"
                    class="imd-section"
                >
                  <button
                      v-for="item in resizeModes"
                      :key="item.value"
                      type="button"
                      class="imd-large-option"
                      :class="{ active: modifier.resize.mode === item.value }"
                      @click="modifier.resize.mode = item.value"
                  >
                    <v-icon size="22">{{ item.icon }}</v-icon>

                    <span>
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                  </button>
                </div>

                <div
                    v-else
                    key="resize-quality"
                    class="imd-section"
                >
                  <button
                      v-for="item in upscaleMethods"
                      :key="item.value"
                      type="button"
                      class="imd-large-option"
                      :class="{ active: modifier.resize.upscaleMethod === item.value }"
                      @click="modifier.resize.upscaleMethod = item.value"
                  >
                    <v-icon size="22">{{ item.icon }}</v-icon>

                    <span>
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                  </button>
                </div>
              </Transition>

              <div class="imd-step-actions">
                <button
                    type="button"
                    class="imd-ghost-btn"
                    :disabled="resizeStepIndex === 0"
                    @click="previousResizeStep"
                >
                  Back
                </button>

                <span>
                  Step {{ resizeStepIndex + 1 }} / {{ resizeSteps.length }}
                </span>

                <button
                    v-if="resizeStepIndex < resizeSteps.length - 1"
                    type="button"
                    class="imd-ghost-btn primary"
                    @click="nextResizeStep"
                >
                  Next
                </button>
              </div>
            </div>

            <div
                v-else-if="modifier.ui.activePanel === 'crop'"
                key="crop"
                class="imd-view"
            >
              <div class="imd-view-head">
                <div>
                  <strong>Crop</strong>
                  <span>Pixelgenau von den Bildkanten abschneiden.</span>
                </div>

                <button type="button" class="imd-ghost-btn" @click="resetCrop">
                  Reset
                </button>
              </div>

              <div class="imd-crop">
                <v-text-field
                    v-model.number="modifier.crop.top"
                    type="number"
                    label="Top"
                    density="compact"
                    hide-details
                />

                <div class="imd-crop-mid">
                  <v-text-field
                      v-model.number="modifier.crop.left"
                      type="number"
                      label="Left"
                      density="compact"
                      hide-details
                  />

                  <div class="imd-crop-preview">
                    <span>{{ cropSize.label }}</span>
                  </div>

                  <v-text-field
                      v-model.number="modifier.crop.right"
                      type="number"
                      label="Right"
                      density="compact"
                      hide-details
                  />
                </div>

                <v-text-field
                    v-model.number="modifier.crop.bottom"
                    type="number"
                    label="Bottom"
                    density="compact"
                    hide-details
                />
              </div>

              <div v-if="hasSelectMask" class="imd-hint">
                <v-icon size="17">mdi-selection-drag</v-icon>
                Aktive Selection wurde erkannt und kann direkt als Crop übernommen werden.
              </div>
            </div>

            <div
                v-else
                key="cutout"
                class="imd-view"
            >
              <div class="imd-view-head">
                <div>
                  <strong>Cutout / Mask</strong>
                  <span>Transparenz über Selection oder Layer-Maske erzeugen.</span>
                </div>
              </div>

              <label
                  class="imd-toggle-card"
                  :class="{
                      active: modifier.cutout.enabled && canUseCutout,
                      disabled: !canUseCutout,
                  }"
              >
                <span class="imd-toggle-icon">
                  <v-icon size="23">
                    {{ canUseCutout ? "mdi-content-cut" : "mdi-lock-outline" }}
                  </v-icon>
                </span>

                <span class="imd-toggle-text">
                  <strong>{{ maskLabel }}</strong>
                  <small>{{ maskDescription }}</small>
                </span>

                <v-switch
                    v-model="modifier.cutout.enabled"
                    :disabled="!canUseCutout"
                    hide-details
                    color="primary"
                />
              </label>

              <div class="imd-mask-source">
                <div :class="{ active: maskType === 'select' }">
                  <v-icon size="18">mdi-selection-drag</v-icon>
                  <span>Selection</span>
                </div>

                <div :class="{ active: maskType === 'layer' }">
                  <v-icon size="18">mdi-layers-triple</v-icon>
                  <span>Layer Mask</span>
                </div>
              </div>

              <div v-if="!canUseCutout" class="imd-hint warning">
                <v-icon size="17">mdi-alert-outline</v-icon>
                Cutout benötigt eine aktive Selection oder eine vorhandene layer.mask.
              </div>
            </div>
          </Transition>
        </section>
      </div>
    </template>

    <template #action>
      <div class="imd-actions">
        <v-btn
            variant="text"
            class="imd-cancel"
            @click="emitEvent(config.emit, false)"
        >
          Abbrechen
        </v-btn>

        <v-spacer/>

        <span class="imd-action-state">
          {{ operationSummary }}
        </span>

        <v-btn
            class="imd-apply"
            :loading="modifier.loading"
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
import {defineComponent} from "vue";
import Dialog from "@/components/Dialog/Dialog.vue";
import {modifierResizeModel, modifierResizeProps} from "@/view/models/page/modifier/resize/model";

export default defineComponent({
  name: "ModifierResizeDialog",
  components: {Dialog},
  props: modifierResizeProps,
  setup(props, {emit}) {
    const model = modifierResizeModel(props, emit);
    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "_Resize.scss";
</style>