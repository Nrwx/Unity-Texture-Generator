<template>
  <v-col v-model:layers="layers" cols="auto" class="pa-0" style="position:relative; height: 100%; width: 100%;">
    <v-img
        v-for="(layer, index) in layers"
        :key="layer.id"
        :src="layer.url"
        :aspect-ratio="1"
        class="layer-image"
        :width="layer.width"
        :height="layer.height"
        @click="emitSelectLayer(layer, $event)"
        @load="extractImageSize(layer, $event)"
        :class="{'absolute': index > 0, 'selected': selectedLayer.includes(layer)}"
        alt="Layer Image"
        :cover="false"
        :style="{zIndex: index, transform: `matrix(${layer.matrix.a}, ${layer.matrix.b}, ${layer.matrix.c}, ${layer.matrix.d}, ${layer.matrix.x}, ${layer.matrix.y}) rotate(${layer.matrix.rotate}deg)`}"
    >
      <slot v-if="selectedLayer.includes(layer)" name="menu"></slot>
    </v-img>
  </v-col>
  <Frame></Frame>
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
    const { emitUpdateLayer, emitSelectLayer, extractImageSize } = imageModel(props, emit);
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