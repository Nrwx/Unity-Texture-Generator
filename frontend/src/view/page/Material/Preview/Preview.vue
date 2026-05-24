<template>
  <section class="preview relative aspect-1-1">
    <Layer3D
        v-if="config.state"
        :layer="config.layer.ref"
        :rotate="config.layer.idle"
        :pause-webgl="!config.state"
        :webgl-active="config.state"
        webgl-scope="material-preview"
        :webgl-exclusive="false"
        :export-state="false"
        :selected="false"
        class="layer relative w-h"
    />

    <div v-else class="state relative pa-6 text-center">
      <v-icon size="34">{{ config.disconnect.icon }}</v-icon>
      <strong>{{ config.disconnect.title }}</strong>
      <span>{{ config.disconnect.subtitle }}</span>
    </div>

    <div class="glow absolute" />

    <div v-if="config.loading.state" class="loading absolute inset">
      <div class="loading-card">
        <div class="loading-orb">
          <v-progress-circular
              indeterminate
              size="30"
              width="3"
          />
        </div>

        <div v-if="config.loading.message.length" class="loading-text">
          <strong>{{ config.loading.message[0] }}</strong>
          <span v-if="config.loading.message.length > 0">{{ config.loading.message[1] }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { defineComponent } from "vue";
import Layer3D from "@/components/Layer/Layer3D/Layer3D";
import {previewModel, previewProps} from "@/view/models/page/material/preview/model";

export default defineComponent({
  name: "Preview3D",
  components: { Layer3D },
  props: previewProps,
  setup(props) {
    return {
      ...previewModel(props),
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Preview";
</style>