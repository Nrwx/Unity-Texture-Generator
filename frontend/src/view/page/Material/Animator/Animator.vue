<template>
  <section
      ref="ui.root.ref"
      :id="ui.root.id"
      class="animator-orbit w-h"
      tabindex="0"
  >
    <main
        ref="ui.viewport.ref"
        :id="ui.viewport.id"
        class="animator-orbit-viewport w-h"
        :style="editorCursorStyle"
        :class="{grabbing: ui.pointer.active,panning: ui.pointer.mode === 'pan',orbiting: ui.pointer.mode === 'orbit',dollying: ui.pointer.mode === 'dolly'}"
    >
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
            :editor-mode="true"
            :editor-state="editorConfig"
            class="animator-layer3d"
        />
      </template>

      <div
          v-else
          class="animator-empty w-h"
      >
        <v-icon size="42">mdi-cube-off-outline</v-icon>
        <strong>Kein Material-Layer ausgewählt</strong>
        <span>Wähle im Layer Panel einen oder mehrere 3D Material-Layer aus.</span>
      </div>
    </main>
  </section>
</template>

<script>
import {defineComponent} from "vue";
import Layer3D from "@/components/Layer/Layer3D/Layer3D";
import {animatorModel, animatorProps} from "@/view/models/page/material/animator/model";

export default defineComponent({
  name: "AnimatorComponent",
  components: {Layer3D},
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
