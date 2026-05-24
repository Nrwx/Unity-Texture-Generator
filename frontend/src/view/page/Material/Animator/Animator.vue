<template>
  <section
      ref="rootRef"
      :id="animator.id"
      class="animator-orbit"
      :style="animatorStyle"
      tabindex="0"
  >
    <main
        ref="viewportRef"
        :id="animator.viewportId"
        class="animator-orbit-viewport"
        :style="animatorViewportStyle"
        :class="{
          grabbing: pointer.active,
          panning: pointer.mode === 'pan',
          orbiting: pointer.mode === 'orbit',
          dollying: pointer.mode === 'dolly'
        }"
    >
      <div
          v-if="camera.backgroundGrid !== false"
          class="animator-grid"
          aria-hidden="true"
      >
        <div
            v-for="line in gridLines"
            :key="line.key"
            class="animator-grid-line"
            :class="line.type"
            :style="line.style"
        />
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
            :webgl-active="true"
            webgl-scope="animator"
            :webgl-exclusive="false"
            :export-state="false"
            class="animator-layer3d"
        />

        <Gizmo
            v-for="layer in animatedLayers"
            v-show="isActiveLayer(layer)"
            :key="`animator-gizmo-${layer.id}`"
            mode="object"
            :selected="isActiveLayer(layer)"
            :active="objectGizmoLayer?.id === layer.id"
            :disabled="!isActiveLayer(layer)"
            @select="selectAnimatorObject(layer)"
            @axis="setObjectGizmoAxis(layer, $event)"
            @release="releaseObjectGizmoAxis"
            @update:component-event="emitEvent"
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
    </main>
  </section>
</template>

<script>
import { defineComponent } from "vue";
import Layer3D from "@/components/Layer/Layer3D/Layer3D";
import Gizmo from "@/components/Gizmo/Gizmo";
import {
  animatorModel,
  animatorProps,
} from "@/view/models/page/material/animator/model";

export default defineComponent({
  name: "AnimatorComponent",
  components: {
    Gizmo,
    Layer3D,
  },
  props: animatorProps,
  emits: [
    "update:component-event",
  ],
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
