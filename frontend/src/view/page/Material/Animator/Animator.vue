<template>
  <section
      ref="rootRef"
      class="animator-viewport-shell"
      tabindex="0"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @contextmenu.prevent
  >
    <header class="animator-toolbar">
      <div class="animator-title">
        <span class="animator-kicker">World Orbit</span>
        <strong>Blender Viewport</strong>
        <small>
          {{ selectedMaterialLayers.length }}
          {{ selectedMaterialLayers.length === 1 ? "Material Layer" : "Material Layers" }}
        </small>
      </div>

      <div class="animator-toolbar-center">
        <button
            type="button"
            class="animator-chip"
            :class="{ active: camera.projection === 'perspective' }"
            @click="setProjection('perspective')"
        >
          <v-icon size="15">mdi-perspective-more</v-icon>
          Perspective
        </button>

        <button
            type="button"
            class="animator-chip"
            :class="{ active: camera.projection === 'orthographic' }"
            @click="setProjection('orthographic')"
        >
          <v-icon size="15">mdi-axis-arrow</v-icon>
          Ortho
        </button>

        <button
            type="button"
            class="animator-chip"
            @click="resetView"
        >
          <v-icon size="15">mdi-camera-retake-outline</v-icon>
          Reset
        </button>

        <button
            type="button"
            class="animator-chip"
            @click="frameSelected"
        >
          <v-icon size="15">mdi-image-filter-center-focus</v-icon>
          Frame
        </button>
      </div>

      <div class="animator-toolbar-right">
        <span class="animator-stat">
          <small>Time</small>
          <strong>{{ formattedTimelineTime }}</strong>
        </span>

        <span class="animator-stat">
          <small>Zoom</small>
          <strong>{{ camera.radius.toFixed(2) }}</strong>
        </span>
      </div>
    </header>

    <main
        ref="viewportRef"
        class="animator-viewport"
        :class="{
      grabbing: pointer.active,
      panning: pointer.mode === 'pan',
      orbiting: pointer.mode === 'orbit',
      dollying: pointer.mode === 'dolly'
    }"
        @pointerdown.stop="onPointerDown"
        @pointermove.stop="onPointerMove"
        @pointerup.stop="onPointerUp"
        @pointercancel.stop="onPointerUp"
        @pointerleave.stop="onPointerLeave"
        @wheel.stop.prevent="onWheel"
        @contextmenu.stop.prevent
    >
      <div class="animator-grid">
        <div
            v-for="line in gridLines"
            :key="line.key"
            class="animator-grid-line"
            :class="line.type"
            :style="line.style"
        />
      </div>

      <div class="animator-axis-gizmo">
        <div class="axis axis-x">X</div>
        <div class="axis axis-y">Y</div>
        <div class="axis axis-z">Z</div>
      </div>

      <template v-if="animatedLayers.length">
        <Layer3D
            v-for="layer in animatedLayers"
            :key="`animator-layer-${layer.id}`"
            :layer="layer"
            :hidden="false"
            :selected="isActiveLayer(layer)"
            :rotate="false"
            :pause-webgl="true"
            :export-state="false"
            class="animator-layer3d"
        />
      </template>

      <div
          v-else
          class="animator-empty"
      >
        <v-icon size="42">mdi-cube-off-outline</v-icon>
        <strong>Kein Material-Layer ausgewählt</strong>
        <span>Wähle im Layer Panel einen oder mehrere 3D Material-Layer aus.</span>
      </div>

      <div class="animator-help">
        <span><b>RMB / MMB</b> Orbit</span>
        <span><b>Shift + RMB</b> Pan</span>
        <span><b>Wheel</b> Dolly</span>
        <span><b>Numpad 1/3/7</b> Views</span>
        <span><b>Home/F</b> Frame</span>
      </div>
    </main>

    <footer class="animator-statusbar">
      <div>
        <span>Camera</span>
        <strong>
          {{ camera.projection }}
          · yaw {{ degrees(camera.theta).toFixed(1) }}°
          · pitch {{ degrees(camera.phi).toFixed(1) }}°
        </strong>
      </div>

      <div>
        <span>Target</span>
        <strong>
          {{ camera.target.x.toFixed(2) }},
          {{ camera.target.y.toFixed(2) }},
          {{ camera.target.z.toFixed(2) }}
        </strong>
      </div>

      <div>
        <span>Active</span>
        <strong>{{ activeLayerLabel }}</strong>
      </div>
    </footer>
  </section>
</template>

<script>
import { defineComponent } from "vue";
import Layer3D from "@/components/Layer/Layer3D/Layer3D";
import {animatorModel, animatorProps} from "@/view/models/page/material/animator/model";

export default defineComponent({
  name: "AnimatorComponent",
  components: {
    Layer3D,
  },
  props: animatorProps,
  setup(props, { emit }) {
    return {
      ...animatorModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Animator";
</style>