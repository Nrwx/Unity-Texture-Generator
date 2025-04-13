<!-- Vollbildansicht -->
<template>
  <v-dialog v-model="state" fullscreen>
    <v-card class="dialog-dimm">
      <v-btn icon class="close-btn absolute-badge" style="top: 32px; right: 32px;" @click="emitEvent('fullscreen-state', false)">
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-btn icon class="close-btn absolute-badge" style="top: 32px; right: 96px;" @click="emitEvent('tile-state', !data.tile)">
        <v-icon>{{ data.tile ? 'mdi-grid-off' : 'mdi-grid'}}</v-icon>
      </v-btn>
      <v-btn v-if="data.mode === 0" icon class="close-btn absolute-badge" style="top: 32px; right: 160px;" @click="data.zoom = !data.zoom">
        <v-icon>{{ data.zoom ? 'mdi-magnify-remove-outline' : 'mdi-magnify-scan'}}</v-icon>
      </v-btn>
      <div class="zoomedContainer" v-if="data.zoom && data.mode === 0">
        <v-img
            :src="data.tile && data.src && data.tileSize.x > 1 && data.tileSize.y > 1 ? data.tileSrc : data.src"
            alt="Zoomed Image"
            @mousemove="handleImageZoom"
            @mouseleave="resetZoom"
        ></v-img>
      </div>
      <div class="d-flex align-center justify-center ml-auto mr-auto" style="position: relative; width: 100%; height: 100%;  max-width: calc(100% - 20%);">
        <v-img :src="data.tile && data.tileSrc && data.tileSize.x > 1 && data.tileSize.y > 1 ? data.tileSrc : data.src" alt="Fullscreen Image"></v-img>
        <div v-if="data.zoom" class="targetZoomContainer" :style="zoomedStyle"></div>
      </div>
      <div class="tileMenu d-flex align-center justify-center pa-4" v-if="data.tile && data.mode === 0">
        <v-select
            v-model="data.tileSize"
            :items="tileSizes"
            theme="dark"
            hide-details
            item-title="title"
            item-value="value"
            label="Kachelgröße"
            outlined
            @update:modelValue="emitEvent('tile-state', {mode: data.mode, id: data.id, title: data.title, src: data.src, tile: data.tile, tileSrc: data.tileSrc, tileSize: data.tileSize, zoom: data.zoom})"
        ></v-select>
      </div>
    </v-card>
  </v-dialog>
</template>


<script>
import { defineComponent } from "vue";
import {fullscreenModel, fullscreenProps} from "@/models/fullscreen/model";
export default defineComponent({
  name: "FullscreenComponent",
  props: fullscreenProps,
  setup(props, { emit }) {
    const { emitEvent, zoomedStyle, resetZoom, handleImageZoom, tileSizes } = fullscreenModel(props, emit);
    return {
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