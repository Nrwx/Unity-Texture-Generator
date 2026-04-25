<template>
  <Dialog
      @update:component-event="emitEvent"
      :state="state"
      :data="config"
      :loading="loading"
      :theme="theme"
  >
    <template #content>
      <v-card class="viewport-shell" variant="flat">
        <div class="viewport-topbar">
          <div class="brand-block">
            <div class="brand-icon">
              <v-icon icon="mdi-image-area" size="20" />
            </div>
            <div class="brand-text">
              <div class="brand-title">Create Project / Viewport</div>
              <div class="brand-subtitle">
                Texture, document or animation workspace
              </div>
            </div>
          </div>

          <div class="topbar-badges">
            <v-chip size="small" variant="tonal" color="primary">
              {{ selectedPresetLabel }}
            </v-chip>
            <v-chip size="small" variant="tonal" color="deep-purple-accent-2">
              {{ viewportSummary }}
            </v-chip>
          </div>
        </div>

        <v-divider />

        <v-card-text class="viewport-grid">
          <section class="pane presets-pane">
            <div class="pane-head">
              <div class="pane-title">Presets</div>
              <div class="pane-subtitle">Fast starts for common targets</div>
            </div>

            <v-list class="preset-list" density="compact" nav>
              <v-list-item
                  v-for="preset in presets"
                  :key="preset.key"
                  :active="preset.key === settings.preset"
                  class="preset-item"
                  rounded="lg"
                  @click="selectPreset(preset)"
              >
                <template #prepend>
                  <v-icon :icon="preset.icon" size="18" />
                </template>

                <v-list-item-title class="text-body-2">
                  {{ preset.label }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ preset.width }} × {{ preset.height }} · {{ preset.dpi }} DPI
                </v-list-item-subtitle>

                <template #append>
                  <v-icon
                      v-if="preset.key === settings.preset"
                      icon="mdi-check-circle"
                      size="18"
                      color="primary"
                  />
                </template>
              </v-list-item>
            </v-list>

            <v-divider class="my-4" />

            <div class="pane-title mb-2">Quick modes</div>
            <div class="chip-row">
              <v-chip
                  v-for="mode in modes"
                  :key="mode.value"
                  size="small"
                  class="mode-chip"
                  :variant="settings.projectType === mode.value ? 'flat' : 'tonal'"
                  :color="settings.projectType === mode.value ? 'primary' : undefined"
                  @click="applySetting('projectType', mode.value, 'viewport:project-type')"
              >
                {{ mode.label }}
              </v-chip>
            </div>
          </section>

          <section class="pane preview-pane">
            <div class="pane-head">
              <div class="pane-title">Live Preview</div>
              <div class="pane-subtitle">Preview scale reacts to viewport size</div>
            </div>

            <div class="preview-frame">
              <div class="preview-stage" :style="previewStageStyle">
                <div class="preview-ruler preview-ruler-top"></div>
                <div class="preview-ruler preview-ruler-left"></div>

                <div class="preview-label preview-label-top">
                  {{ settings.width }} × {{ settings.height }}
                </div>
                <div class="preview-label preview-label-bottom">
                  {{ settings.unit.toUpperCase() }} · {{ settings.dpi }} DPI
                </div>

                <div class="preview-grid-overlay"></div>
                <div class="preview-core">
                  <v-icon icon="mdi-monitor-screenshot" size="42" />
                  <div class="preview-core-title">
                    {{ settings.title || 'Untitled Project' }}
                  </div>
                  <div class="preview-core-subtitle">
                    {{ settings.orientation }} · {{ settings.background }}
                  </div>
                </div>
              </div>
            </div>

            <div class="preview-meta">
              <div class="meta-card">
                <div class="meta-label">Aspect</div>
                <div class="meta-value">{{ aspectRatioLabel }}</div>
              </div>
              <div class="meta-card">
                <div class="meta-label">Pixels</div>
                <div class="meta-value">{{ pixelCountLabel }}</div>
              </div>
              <div class="meta-card">
                <div class="meta-label">Scale</div>
                <div class="meta-value">{{ previewScaleLabel }}</div>
              </div>
            </div>
          </section>

          <section class="pane inspector-pane">
            <div class="pane-head">
              <div class="pane-title">Inspector</div>
              <div class="pane-subtitle">Edit project and viewport settings</div>
            </div>

            <v-form
                :id="settings?.id"
                class="inspector-form"
                @submit.prevent="submitViewport"
            >
              <v-text-field
                  :model-value="settings.title"
                  label="Project title"
                  density="compact"
                  variant="outlined"
                  prepend-inner-icon="mdi-folder-edit"
                  @update:model-value="applySetting('title', $event, 'viewport:title')"
              />

              <div class="two-col">
                <v-text-field
                    :model-value="settings.width"
                    label="Width"
                    type="number"
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-arrow-expand-horizontal"
                    @update:model-value="applySetting('width', toInt($event), 'viewport:width')"
                />

                <v-text-field
                    :model-value="settings.height"
                    label="Height"
                    type="number"
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-arrow-expand-vertical"
                    @update:model-value="applySetting('height', toInt($event), 'viewport:height')"
                />
              </div>

              <div class="two-col">
                <v-select
                    :model-value="settings.unit"
                    :items="unitItems"
                    label="Unit"
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-ruler-square"
                    @update:model-value="applySetting('unit', $event, 'viewport:unit')"
                />

                <v-text-field
                    :model-value="settings.dpi"
                    label="DPI"
                    type="number"
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-alpha-d-box"
                    @update:model-value="applySetting('dpi', toInt($event), 'viewport:dpi')"
                />
              </div>

              <div class="two-col">
                <v-select
                    :model-value="settings.orientation"
                    :items="orientationItems"
                    label="Orientation"
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-screen-rotation"
                    @update:model-value="applyOrientation($event)"
                />

                <v-select
                    :model-value="settings.projectType"
                    :items="modeItems"
                    label="Type"
                    density="compact"
                    variant="outlined"
                    prepend-inner-icon="mdi-file-outline"
                    @update:model-value="applySetting('projectType', $event, 'viewport:project-type')"
                />
              </div>

              <v-text-field
                  :model-value="settings.layer"
                  label="Default layer name"
                  density="compact"
                  variant="outlined"
                  prepend-inner-icon="mdi-layers-outline"
                  @update:model-value="applySetting('layer', $event, 'viewport:layer')"
              />

              <v-text-field
                  :model-value="settings.background"
                  label="Background"
                  density="compact"
                  variant="outlined"
                  prepend-inner-icon="mdi-palette"
                  @update:model-value="applySetting('background', $event, 'viewport:background')"
              />

              <div class="switch-row">
                <v-switch
                    :model-value="settings.sync"
                    color="primary"
                    inset
                    hide-details
                    label="Sync viewport to document"
                    @update:model-value="applySetting('sync', $event, 'viewport:sync')"
                />

                <v-switch
                    :model-value="settings.lockRatio"
                    color="deep-purple-accent-2"
                    inset
                    hide-details
                    label="Lock aspect ratio"
                    @update:model-value="applySetting('lockRatio', $event, 'viewport:ratio-lock')"
                />
              </div>

              <v-card class="advanced-box" variant="tonal">
                <div class="advanced-head">
                  <v-icon icon="mdi-tune-variant" size="18" />
                  <span>Advanced</span>
                </div>

                <div class="advanced-grid">
                  <v-switch
                      :model-value="settings.grid"
                      color="primary"
                      inset
                      hide-details
                      label="Grid"
                      @update:model-value="applySetting('grid', $event, 'viewport:grid')"
                  />

                  <v-switch
                      :model-value="settings.safeArea"
                      color="primary"
                      inset
                      hide-details
                      label="Safe area"
                      @update:model-value="applySetting('safeArea', $event, 'viewport:safe-area')"
                  />
                </div>
              </v-card>

              <div class="action-row">
                <v-btn
                    variant="tonal"
                    prepend-icon="mdi-refresh"
                    @click="resetViewport"
                >
                  Reset
                </v-btn>

                <v-spacer />

                <v-btn
                    color="primary"
                    type="submit"
                    prepend-icon="mdi-check"
                    :loading="loading"
                >
                  Create
                </v-btn>
              </div>
            </v-form>
          </section>
        </v-card-text>
      </v-card>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import { viewportModel, viewportProps } from "@/view/models/page/viewport/model";
import Dialog from "@/components/Dialog/Dialog";

export default defineComponent({
  name: "ViewportPage",
  props: viewportProps,
  components: { Dialog },
  setup(props, { emit }) {
    const model = viewportModel(props, emit);
    return { ...model };
  },
});
</script>

<style scoped lang="scss">
.viewport-shell {
  background:
      radial-gradient(circle at top left, rgba(86, 101, 255, 0.15), transparent 30%),
      radial-gradient(circle at top right, rgba(0, 168, 255, 0.12), transparent 28%),
      linear-gradient(180deg, #1e1f24 0%, #18191d 100%);
  color: #e8e8ea;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.viewport-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .5rem 1rem;
  gap: 1rem;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-icon {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, rgba(66, 153, 225, 0.22), rgba(66, 153, 225, 0.08));
  border: 1px solid rgba(66, 153, 225, 0.22);
  color: #9ed6ff;
}

.brand-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.brand-subtitle {
  font-size: 0.82rem;
  opacity: 0.72;
}

.topbar-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.viewport-grid {
  display: grid;
  grid-template-columns: 1.05fr 1.3fr 1.2fr;
  gap: 1rem;
  height: calc(100% - 4.75rem);
  padding: 1rem;
}

.pane {
  min-height: 0;
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(20, 22, 27, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  overflow: auto;
}

.pane-head {
  margin-bottom: 1rem;
}

.pane-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.pane-subtitle {
  font-size: 0.78rem;
  opacity: 0.7;
  margin-top: 0.15rem;
}

.preset-list {
  background: transparent;
}

.preset-item {
  margin-bottom: 0.45rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.preset-item.v-list-item--active {
  background: rgba(66, 153, 225, 0.14) !important;
  border-color: rgba(66, 153, 225, 0.28);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mode-chip {
  cursor: pointer;
}

.preview-pane {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.preview-frame {
  flex: 1;
  min-height: 0;
  border-radius: 1rem;
  padding: 1rem;
  background:
      linear-gradient(135deg, rgba(12, 14, 18, 0.95), rgba(28, 31, 38, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.preview-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  border-radius: 1rem;
  margin: 0 auto;
  background:
      linear-gradient(180deg, rgba(36, 39, 47, 0.95), rgba(28, 30, 36, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
}

.preview-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.preview-ruler-top,
.preview-ruler-left {
  position: absolute;
  background: rgba(255, 255, 255, 0.08);
}

.preview-ruler-top {
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
}

.preview-ruler-left {
  top: 0;
  left: 0;
  bottom: 0;
  width: 1px;
}

.preview-core {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 0.35rem;
  padding: 1rem;
}

.preview-core-title {
  font-weight: 700;
  font-size: 0.98rem;
}

.preview-core-subtitle {
  font-size: 0.78rem;
  opacity: 0.7;
}

.preview-label {
  position: absolute;
  z-index: 2;
  padding: 0.35rem 0.55rem;
  border-radius: 0.55rem;
  background: rgba(15, 16, 20, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.78rem;
}

.preview-label-top {
  top: 0.75rem;
  left: 0.75rem;
}

.preview-label-bottom {
  right: 0.75rem;
  bottom: 0.75rem;
}

.preview-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
}

.meta-card {
  padding: 0.75rem;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.meta-label {
  font-size: 0.72rem;
  opacity: 0.65;
  margin-bottom: 0.25rem;
}

.meta-value {
  font-size: 0.92rem;
  font-weight: 700;
}

.inspector-form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.switch-row {
  display: grid;
  gap: 0.35rem;
  padding: 0.1rem 0 0.4rem;
}

.advanced-box {
  margin-top: 0.2rem;
  padding: 0.85rem;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.03);
}

.advanced-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  margin-bottom: 0.65rem;
}

.advanced-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem 0.75rem;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.35rem;
}

@media (max-width: 1200px) {
  .viewport-grid {
    grid-template-columns: 1fr;
  }

  .preview-stage {
    min-height: 320px;
  }
}

@media (max-width: 640px) {
  .viewport-topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .two-col,
  .advanced-grid,
  .preview-meta {
    grid-template-columns: 1fr;
  }
}
</style>