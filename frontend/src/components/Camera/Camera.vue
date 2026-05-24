<template>
  <div class="camera-panel">
    <section class="camera-hero">
      <div class="camera-title">
        <v-icon size="22">mdi-video-3d</v-icon>
        <div>
          <strong>{{ activeLayer?.name || "Kamera" }}</strong>
          <span>{{ savedCamera.projection }} · {{ Math.round(savedCamera.fov) }}° · R {{ Number(savedCamera.radius).toFixed(2) }}</span>
        </div>
      </div>

      <div class="camera-status" :class="{ active: activeLayer }">
        <span />
        {{ activeLayer ? "Animator View" : "Kein 3D Layer" }}
      </div>
    </section>

    <template v-if="activeLayer">
      <section class="camera-card accent">
        <header>
          <div>
            <strong>Camera Commit</strong>
            <small>Speichert erst bei Apply / ESC / Verlassen.</small>
          </div>
        </header>

        <div class="camera-action-grid primary">
          <button type="button" class="active" @click="applyCurrentCamera">
            <v-icon size="16">mdi-content-save-outline</v-icon>
            <span>Save View</span>
          </button>

          <button type="button" @click="resetCamera">
            <v-icon size="16">mdi-restore</v-icon>
            <span>Reset</span>
          </button>

          <button type="button" @click="restoreSavedCamera">
            <v-icon size="16">mdi-database-refresh-outline</v-icon>
            <span>Reload</span>
          </button>

          <button type="button" @click="focusPivot">
            <v-icon size="16">mdi-crosshairs-gps</v-icon>
            <span>Pivot</span>
          </button>
        </div>
      </section>

      <section class="camera-card">
        <header>
          <div>
            <strong>Projection</strong>
            <small>Perspektive und Standard-Views.</small>
          </div>
        </header>

        <div class="camera-pill-row">
          <button type="button" :class="{ active: savedCamera.projection === 'perspective' }" @click="setSavedCameraField('projection', 'perspective')">
            <v-icon size="15">mdi-perspective-more</v-icon>
            Persp
          </button>

          <button type="button" :class="{ active: savedCamera.projection === 'orthographic' }" @click="setSavedCameraField('projection', 'orthographic')">
            <v-icon size="15">mdi-cube-outline</v-icon>
            Ortho
          </button>

          <button type="button" @click="animatorCameraCommand.frame += 1">
            <v-icon size="15">mdi-image-filter-center-focus</v-icon>
            Frame
          </button>
        </div>

        <div class="camera-view-grid">
          <button v-for="view in viewButtons" :key="view.key" type="button" @click="setAnimatorView(view.key)">
            <v-icon size="15">{{ view.icon }}</v-icon>
            <span>{{ view.label }}</span>
          </button>
        </div>
      </section>

      <section v-for="group in cameraGroups" :key="group.key" class="camera-card">
        <header>
          <div>
            <strong>{{ group.title }}</strong>
            <small>Live im Animator, Commit erst am Ende.</small>
          </div>
        </header>

        <div class="camera-grid">
          <v-text-field
              v-for="field in group.fields"
              :key="field.key"
              :model-value="savedCamera[field.key]"
              :label="field.label"
              type="number"
              :step="field.step"
              :min="field.min"
              :max="field.max"
              density="compact"
              hide-details
              @update:model-value="setSavedCameraField(field.key, $event)"
          />
        </div>
      </section>
    </template>

    <section v-else class="camera-empty">
      <v-icon size="34">mdi-camera-off-outline</v-icon>
      <strong>Kein 3D Layer ausgewaehlt</strong>
      <span>Waehle eine Mesh-/Material-Ebene, um die gespeicherte Viewport-Camera zu bearbeiten.</span>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { cameraModel, cameraProps } from "@/models/camera/model";

export default defineComponent({
  name: "CameraPanel",
  props: cameraProps,
  emits: ["component-event"],
  setup(props, { emit }) {
    return { ...cameraModel(props, emit) };
  },
});
</script>

<style scoped lang="scss">
@import "./_Camera";
</style>
