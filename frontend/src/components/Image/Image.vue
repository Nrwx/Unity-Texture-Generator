<template>
  <v-col v-model:layers="layers" cols="12" class="pa-0" style="position:relative;">
    <v-img
        v-for="(layer, index) in layers"
        :key="layer.id"
        :src="layer.url"
        :aspect-ratio="1"
        class="layer-image"
        :class="index > 0 ? 'absolute' : ''"
        alt="Layer Image"
        :style="{ zIndex: index + 1 }"
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
    const { extractImageSize } = imageModel(emit);
    return {
      extractImageSize
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Image.scss';
</style>