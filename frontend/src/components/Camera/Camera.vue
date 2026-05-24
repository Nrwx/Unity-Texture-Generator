<template>
  <div class="camera-panel">
    <section class="camera-section">
      <header>
        <div>
          <strong>{{ activeLayer?.name || "Kamera" }}</strong>
          <small>{{ savedCamera.projection }} - {{ Math.round(savedCamera.fov) }} deg</small>
        </div>

        <v-btn
            icon
            size="x-small"
            variant="text"
            :disabled="!activeLayer"
            @click="applyCurrentCamera"
        >
          <v-icon size="16">mdi-camera-plus-outline</v-icon>
        </v-btn>
      </header>

      <div v-if="activeLayer" class="camera-segment">
        <button
            type="button"
            :class="{ active: savedCamera.projection === 'perspective' }"
            @click="setSavedCameraField('projection', 'perspective')"
        >
          Persp
        </button>

        <button
            type="button"
            :class="{ active: savedCamera.projection === 'orthographic' }"
            @click="setSavedCameraField('projection', 'orthographic')"
        >
          Ortho
        </button>

        <button type="button" @click="animatorCameraCommand.frame += 1">
          Frame
        </button>

        <button type="button" @click="animatorCameraCommand.reset += 1">
          Reset
        </button>
      </div>

      <div v-else class="camera-empty">
        <v-icon size="28">mdi-camera-off-outline</v-icon>
        <span>Kein 3D Layer ausgewaehlt</span>
      </div>
    </section>

    <section v-if="activeLayer" class="camera-section">
      <header>
        <div>
          <strong>Perspektiven</strong>
          <small>Schnellzugriff fuer Animator Orbit</small>
        </div>
      </header>

      <div class="camera-view-grid">
        <button
            v-for="view in viewButtons"
            :key="view.key"
            type="button"
            @click="setAnimatorView(view.key)"
        >
          <v-icon size="15">{{ view.icon }}</v-icon>
          <span>{{ view.label }}</span>
        </button>
      </div>
    </section>

    <section v-if="activeLayer" class="camera-section">
      <header>
        <div>
          <strong>Settings</strong>
          <small>Lens und Orbit speichern im Layer</small>
        </div>
      </header>

      <div
          v-for="group in cameraGroups"
          :key="group.key"
          class="camera-group"
      >
        <small>{{ group.title }}</small>

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
      </div>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {cameraModel, cameraProps} from "@/models/camera/model";

export default defineComponent({
  name: "CameraPanel",
  props: cameraProps,
  setup(props, { emit }) {
    return {
      ...cameraModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Camera";
</style>
