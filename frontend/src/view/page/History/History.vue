<template>
  <v-card class="pa-0" flat height="100%">
    <v-card-title class="headline d-flex align-center mb-6">
      <div class="text-truncate" style="width: 100%;">Output</div>
      <v-select
          v-model="localData.sort.value"
          :items="sortOptions"
          label="Filter"
          class="ml-auto"
          item-title="title"
          item-value="value"
          outlined
          dense
          hide-details
          min-width="145"
      ></v-select>
    </v-card-title>
    <div class="scrollFx">
      <div class="scrollTop"></div>
      <div class="scrollBottom"></div>
    </div>
    <v-card-text style="padding: 0; max-width: 100%;">
      <!-- Anzeigen der letzten Builds -->
      <div v-if="sortedBuilds.length" class="map-grid overflow-hidden overflow-y-auto py-8" style="height: 80vh; max-height: 80vh; max-width: 100%;">
        <v-col
            v-for="(build, index) in sortedBuilds"
            :key="build.id"
            class="map-item"
            cols="12"
        >
          <v-badge class="absolute-badge" color="error" :content="build.buildMaps.length + build.tiledMaps.length"></v-badge>
          <v-badge style="top: 36px;" class="absolute-badge nav-badge" @click="emitEvent('delete-build', build.id)" color="error" icon="mdi-delete"></v-badge>
          <!-- Build Info: Zeitstempel und Karten -->
          <v-card class="py-6 px-4" :style="index === 0 ? 'background-color: #fff8d8;' : ''">
            <v-card-title style="font-size: 14px;">{{ build.timestamp }}</v-card-title>
            <v-card-subtitle class="d-flex align-center" style="font-size: 12px; min-height: 45px;">
              <div style="width: 100%;" class="text-truncate mr-6">{{ build.maps }}</div>
              <v-btn icon size="x-small" @click="toggleCollapse(index)">
                <v-icon>{{ build.collapsed ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
              </v-btn>
              
            </v-card-subtitle>
            <v-card-text v-if="!build.collapsed">
              <v-row class="map-grid" justify="start">
                <v-col

                    v-for="(map, mapIndex) in build.buildMaps"
                    :key="mapIndex"
                    class="map-item"
                    cols="4"
                >
                  <v-badge style="right: 26px;" class="absolute-badge nav-badge" rounded="0" color="error" icon="mdi-fullscreen" @click="emitEvent('fullscreen-state', {mode: 1, src: map.src, id: build.id, title: map.type})"></v-badge>
                  <v-badge style="top: 36px; right: 26px;" rounded="0" class="absolute-badge nav-badge" @click="emitEvent('download-file', map.src)" color="error" icon="mdi-download"></v-badge>
                  <v-img
                      :src="map.src"
                      :alt="map.type"
                      width="40"
                      height="40"
                      rounded="12"
                      class="map-image"
                      @click="emitEvent('import-build', {id: map.id, title: map.type, width: map.width, height: map.height})"
                      contain
                  ></v-img>
                  <p
                      class="text-center text-truncate map-title"
                      :title="map.type"
                  >
                    {{ map.type }}
                  </p>
                </v-col>
                <v-col
                    v-for="(tile, tileIndex) in build?.tiledMaps"
                    :key="tileIndex"
                    class="map-item"
                    cols="4"
                >
                  <v-badge style="top: 12px; right: 26px;" rounded="0" class="absolute-badge nav-badge" @click="emitEvent('download-file', tile.src)" color="error" icon="mdi-download"></v-badge>
                  <v-img
                      :src="tile.src"
                      :alt="tile.type"
                      width="40"
                      height="40"
                      rounded="12"
                      class="map-image"
                      @click="emitEvent('import-build', {id: tile.id, title: tile.type, width: tile.width, height: tile.height})"
                      contain
                  ></v-img>
                  <p
                      class="text-center text-truncate map-title"
                      :title="tile.type"
                  >
                    {{ tile.type }}
                  </p>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import {historyModel, historyProps} from "@/view/models/page/history/model";
import {localData} from "@/dataLayer/local";

export default defineComponent({
  name: "HistoryPage",
  props: historyProps,
  setup(props, { emit }) {
    const { emitEvent, sortedBuilds, sortOptions, toggleCollapse } = historyModel(props, emit);
    return {
      sortedBuilds,
      sortOptions,
      localData,
      emitEvent,
      toggleCollapse,
    };
  },
});
</script>

<style scoped lang="scss">
@import 'History';
</style>