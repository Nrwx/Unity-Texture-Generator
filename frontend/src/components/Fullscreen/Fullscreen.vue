<!-- Vollbildansicht -->
<template>
  <Dialog @update:component-event="emitEvent" :state="state" :data="config" :loading="loading">
    <template #absolute>
      <v-btn icon class="close-btn absolute" style="top: 32px; right: 96px;" @click="emitEvent('tile-state', !data.tile)">
        <v-icon>{{ data.tile ? 'mdi-grid-off' : 'mdi-grid'}}</v-icon>
      </v-btn>
      <v-btn icon class="close-btn absolute" style="top: 32px; right: 160px;" @click="data.zoom = !data.zoom">
        <v-icon>{{ data.zoom ? 'mdi-magnify-remove-outline' : 'mdi-magnify-scan'}}</v-icon>
      </v-btn>
    </template>
    <template #content>
      <div class="zoomedContainer absolute" v-if="data.zoom">
        <v-img
            :src="data.tile && data.src && data.tileSize.x > 1 && data.tileSize.y > 1 ? data.tileSrc : data.src"
            alt="Zoomed Image"
            @mousemove="handleImageZoom"
            @mouseleave="resetZoom"
        ></v-img>
      </div>
      <div class="d-flex align-center justify-center ml-auto mr-auto" style="position: relative; width: 100%; height: 100%;max-height: 85vh;">
        <v-img :src="data.tile && data.tileSrc && data.tileSize.x > 1 && data.tileSize.y > 1 ? data.tileSrc : data.src" alt="Fullscreen Image"></v-img>
        <div v-if="data.zoom" class="targetZoomContainer absolute" :style="zoomedStyle"></div>
      </div>
      <div class="tileMenu absolute d-flex align-center justify-center pa-4" v-if="data.tile">
        <v-select
            v-model="data.tileSize"
            :items="tileSizes"
            theme="dark"
            hide-details
            item-title="title"
            item-value="value"
            label="Kachelgröße"
            outlined
            @update:modelValue="emitEvent('tile-state', {id: data.id, title: data.title, src: data.src, tile: data.tile, tileSrc: data.tileSrc, tileSize: data.tileSize, zoom: data.zoom})"
        ></v-select>
      </div>
    </template>
  </Dialog>
</template>


<script>
import { defineComponent } from "vue";
import {fullscreenModel, fullscreenProps} from "@/models/fullscreen/model";
import Dialog from "@/components/Dialog/Dialog.vue";
export default defineComponent({
  name: "FullscreenComponent",
  components: {Dialog},
  props: fullscreenProps,
  setup(props, { emit }) {
    const {config, emitEvent, zoomedStyle, resetZoom, handleImageZoom, tileSizes } = fullscreenModel(props, emit);
    return {
      config,
      tileSizes,
      handleImageZoom,
      zoomedStyle,
      resetZoom,
      emitEvent,
    };
  },
});
</script>

<style lang="scss">
@import "./_Fullscreen";
</style>