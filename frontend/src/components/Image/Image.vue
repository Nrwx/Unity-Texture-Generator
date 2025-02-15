<template>
  <v-col v-model:layers="layers" cols="12" class="pa-0" style="position:relative;">
    <v-img
        v-for="(layer, index) in layers"
        :key="layer.id"
        :src="layer.url"
        :aspect-ratio="1"
        class="layer-image"
        :width="layer.width"
        :height="layer.height"
        @click="emitEvent(layer, $event)"
        :class="{'absolute' : index > 0, 'selected': selectedLayers.includes(layer)}"
        alt="Layer Image"
        :style="{ zIndex: index, left: `${offsetX}px`,top: `${offsetY}px`}"
        @load="extractImageSize"
    />
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