<template>
  <v-col ref="containerRef" id="containerRef" cols="auto" class="pa-0" style="position:relative; height: 100%; width: 100%;">
    <template v-for="(layer, index) in layers">
      <!-- 📷 Bild-Layer -->
      <img
          v-if="layer.type === 0"
          :src="layer?.masked && layer.mask ? layer?.masked : layer.url"
          :hidden="layer.hidden"
          :key="layer.time"
          class="layer-image"
          @click="emitSelectLayer(layer, $event)"
          :class="{ 'absolute': index >= 0, 'selected': selectedLayer.includes(layer) }"
          :data-context-id="layer.id"
          :alt="layer.name"
          :style="getLayerStyle(layer)"
      />

      <!-- 📝 Text-Layer -->
      <div
          v-else-if="layer.type === 1"
          :hidden="layer.hidden"
          style="top: 0; left: 0;"
          @click="emitSelectLayer(layer, $event)"
          :class="{ 'absolute': index >= 0, 'selected': selectedLayer.includes(layer) }"
          :data-context-id="layer.id"
          :key="layer.time"
          :style="getTextLayerStyle(layer)"
      >
        {{ layer.text }}
      </div>
      <!-- 🧭 Path/Vector-Layer -->
      <v-img
          v-else-if="layer.type === 2"
          :src="layer.svg"
          :hidden="layer.hidden"
          :key="layer.time"
          :transition="false"
          @click="emitSelectLayer(layer, $event)"
          :class="{ 'absolute': index >= 0, 'selected': selectedLayer.includes(layer) }"
          :data-context-id="layer.id"
          :alt="layer.name"
          :style="getVectorStyle(layer)"
      />
    </template>
  </v-col>

  <Frame />
</template>


<script>
  import { defineComponent } from "vue";
  import {imageModel, imageProps} from "@/models/image/model";
  import Frame from '@/components/Frame/Frame'

  export default defineComponent({
  name: "ImageComponent",
  props: imageProps,
  components: {
    Frame
  },
  setup(props, { emit }) {
    const model = imageModel(props, emit);
    return {
      ...model,
    };
  },
});
</script>

<style lang="scss">
@import '_Image.scss';
</style>