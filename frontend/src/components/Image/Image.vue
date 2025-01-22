<template>
  <v-col v-model:layers="layers" cols="6" style="position:relative;">
    <v-img
        v-for="(layer, index) in layers"
        :key="layer.id"
        :src="layer.url"
        :aspect-ratio="1"
        class="layer-image"
        alt="Layer Image"
        :style="{ zIndex: index + 1 }"
        @load="extractImageSize"
    />
  </v-col>
</template>

<script>
  import { defineComponent } from "vue";
  import {imageModel, imageProps} from "@/models/image/model";

  export default defineComponent({
  name: "ImageComponent",
  props: imageProps,
  setup(props, { emit }) {
    const { extractImageSize } = imageModel(emit);
    return {
      extractImageSize
    };
  },
});
</script>