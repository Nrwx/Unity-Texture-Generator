<template>
  <aside class="engine-camera-panel" :class="{ compact }">
    <section class="engine-camera-panel__hero">
      <div class="engine-camera-panel__title">
        <v-icon size="20">mdi-video-3d</v-icon>
        <div>
          <strong>{{ activeLayer?.name || "Engine View" }}</strong>
          <span>
            {{ camera.projection }} ·
            {{ Math.round(Number(camera.fov || 0)) }}° ·
            R {{ Number(orbit.radius || camera.radius || 0).toFixed(2) }}
          </span>
        </div>
      </div>

      <button
          type="button"
          class="engine-camera-panel__status"
          :class="{ active: !!activeLayer }"
          @click="emitCameraAction('apply')"
      >
        <span />
        {{ activeLayer ? "Save" : "No Layer" }}
      </button>
    </section>

    <section class="engine-camera-panel__row engine-camera-panel__row--projection">
      <button
          type="button"
          :class="{ active: camera.projection === 'perspective' }"
          @click="setProjection('perspective')"
      >
        <v-icon size="14">mdi-perspective-more</v-icon>
        Persp
      </button>

      <button
          type="button"
          :class="{ active: camera.projection === 'orthographic' }"
          @click="setProjection('orthographic')"
      >
        <v-icon size="14">mdi-cube-outline</v-icon>
        Ortho
      </button>

      <button type="button" @click="emitCameraAction('frame')">
        <v-icon size="14">mdi-image-filter-center-focus</v-icon>
        Frame
      </button>

      <button type="button" @click="emitCameraAction('reset')">
        <v-icon size="14">mdi-restore</v-icon>
        Reset
      </button>
    </section>

    <section class="engine-camera-panel__views">
      <button
          v-for="view in viewButtons"
          :key="view.key"
          type="button"
          @click="setView(view.key)"
      >
        <v-icon size="14">{{ view.icon }}</v-icon>
        {{ view.label }}
      </button>
    </section>

    <section class="engine-camera-panel__fields">
      <label v-for="field in cameraFields" :key="field.key">
        <span>{{ field.label }}</span>
        <input
            type="number"
            :step="field.step"
            :min="field.min"
            :max="field.max"
            :value="fieldValue(field.key)"
            @input="setCameraField(field.key, $event.target.value)"
        />
      </label>
    </section>
  </aside>
</template>

<script>
import { defineComponent } from "vue";
import { cameraModel, cameraProps } from "@/view/models/page/material/camera/model";

export default defineComponent({
  name: "CameraPanel",
  props: cameraProps,
  setup(props, { emit }) {
    return cameraModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Camera";
</style>