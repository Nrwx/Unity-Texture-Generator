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
          :style="{
            opacity: layer.opacity,
            zIndex: index,
            position: 'absolute',
            top: '0',
            left: '0',
            transform: `matrix(${layer.matrix.a}, ${layer.matrix.b}, ${layer.matrix.c}, ${layer.matrix.d}, ${layer.matrix.x}, ${layer.matrix.y}) rotate(${layer.matrix.rotate}deg)`
          }"
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
          :style="{
          width: `${layer.width}px`,
          height: `${layer.height}px`,
          color: layer.color,
          fontFamily: layer.fontFamily,
          fontSize: `${layer.fontSize}px !important`,
          fontWeight: layer.fontWeight,
          letterSpacing: `${layer.letterSpacing}px`,
          lineHeight: layer.lineHeight,
          textAlign: layer.textAlign,
          textTransform: layer.textTransform,
          textDecoration: layer.textDecoration,
          opacity: layer.opacity,
          whiteSpace: 'pre-wrap',
          transform: `matrix(${layer.matrix.a}, ${layer.matrix.b}, ${layer.matrix.c}, ${layer.matrix.d}, ${layer.matrix.x}, ${layer.matrix.y}) rotate(${layer.matrix.rotate}deg)`,
          zIndex: index
        }"
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
          :style="{
          width: `${layer.width}px`,
          height: `${layer.height}px`,
          opacity: layer.opacity,
          zIndex: index,
          transform: `matrix(${layer.matrix.a}, ${layer.matrix.b}, ${layer.matrix.c}, ${layer.matrix.d}, ${layer.matrix.x}, ${layer.matrix.y}) rotate(${layer.matrix.rotate}deg)`,
          pointerEvents: 'auto'
          }"
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
    const { emitSelectLayer} = imageModel(props, emit);
    return {
      emitSelectLayer,
    };
  },
});
</script>

<style lang="scss">
@import '_Image.scss';
</style>