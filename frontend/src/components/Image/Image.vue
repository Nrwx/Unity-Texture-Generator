<template>
  <v-col v-model:layers="layers" cols="auto" class="pa-0" style="position:relative; height: 100%; width: 100%;">
    <template v-for="(layer, index) in layers" :key="layer.id">
      <!-- 📷 Bild-Layer -->
      <v-img
          v-if="layer.type === 0"
          :src="layer.url"
          :hidden="layer.hidden"
          :aspect-ratio="1"
          class="layer-image"
          :width="layer.width"
          :height="layer.height"
          @click="emitSelectLayer(layer, $event)"
          @load="extractImageSize(layer, $event)"
          :class="{ 'absolute': index > 0, 'selected': selectedLayer.includes(layer) }"
          :data-context-id="layer.id"
          alt="Layer Image"
          :cover="false"
          :style="{
          opacity: layer.opacity,
          zIndex: index,
          transform: `matrix(${layer.matrix.a}, ${layer.matrix.b}, ${layer.matrix.c}, ${layer.matrix.d}, ${layer.matrix.x}, ${layer.matrix.y}) rotate(${layer.matrix.rotate}deg)`
        }"
      ></v-img>

      <!-- 📝 Text-Layer -->
      <div
          v-else-if="layer.type === 1"
          :hidden="layer.hidden"
          style="top: 0; left: 0;"
          @click="emitSelectLayer(layer, $event)"
          :class="{ 'absolute': index > 0, 'selected': selectedLayer.includes(layer) }"
          :data-context-id="layer.id"
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
    const { emitUpdateLayer, emitSelectLayer, extractImageSize} = imageModel(props, emit);
    return {
      emitUpdateLayer,
      emitSelectLayer,
      extractImageSize,
    };
  },
});
</script>

<style lang="scss">
@import '_Image.scss';
</style>