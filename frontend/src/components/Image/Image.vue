<template>
  <v-col v-model:layers="layers" cols="auto" class="pa-0" style="position:relative;">
    <v-img
        v-for="(layer, index) in layers"
        :key="layer.id"
        :src="layer.url"
        :aspect-ratio="1"
        class="layer-image"
        :width="layer.width"
        :height="layer.height"
        @click="emitEvent(layer, $event)"
        :class="{'absolute': index > 0, 'selected': selectedLayers.includes(layer)}"
        alt="Layer Image"
        :style="{
          zIndex: index,
          left: `${layer.x}px`,
          top: `${layer.y}px`,
          transform: `scale(${layer.scale}) rotate(${layer.rotate}deg)`,
          transformOrigin: 'center center'
        }"
        @load="extractImageSize"
    >
      <slot v-if="selectedLayers.includes(layer)" name="menu"></slot>
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
    const { emitEvent, extractImageSize } = imageModel(props, emit);
    return {
      emitEvent,
      extractImageSize
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Image.scss';
</style>