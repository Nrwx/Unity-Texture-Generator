<template>
  <v-card flat>
    <v-card-title>
      <v-tabs
          v-model="settings.method"
          class="tab-navigation"
          background-color="primary"
          dark
          grow
          height="32px"
          align="center"
      >
        <v-tab min-width="16" min-height="16" height="16" width="16" max-width="16" max-height="16" v-for="tab in tabs" :key="tab.name">
          <v-icon size="16">{{ tab.icon }}</v-icon>
        </v-tab>
      </v-tabs>
    </v-card-title>

    <!-- Tab Content -->
    <v-card-text>
      <div v-for="(tab, index) in tabs" :key="tab.name" v-show="settings.method === index">
        <!-- Dynamische Einstellungen je Methode -->
        <template v-if="methodSettings[settings.method]">
          <div v-for="(prop, key) in methodSettings[settings.method]" :key="key">
            <!-- Textfeld für Zahlen -->
            <v-text-field
                v-if="prop.type === 'number' && prop.active"
                v-model.number="settings[key]"
                :label="prop.label"
                :type="prop.inputType || 'number'"
                outlined
            ></v-text-field>
            <!-- Slider -->
            <v-slider
                v-if="prop.type === 'slider' && prop.active"
                v-model="settings[key]"
                :label="prop.label"
                :min="prop.min"
                :max="prop.max"
                :step="prop.step || 1"
                thumb-label
            ></v-slider>
            <!-- Checkbox -->
            <v-checkbox
                v-else-if="prop.type === 'checkbox' && prop.active"
                v-model="settings[key]"
                :label="prop.label"
            ></v-checkbox>

            <!-- Switch -->
            <v-switch
                v-else-if="prop.type === 'switch' && prop.active"
                v-model="settings[key]"
                :label="prop.label"
            ></v-switch>

            <!-- Dropdown -->
            <v-select
                v-else-if="prop.type === 'select' && prop.active"
                v-model="settings[key]"
                :items="prop.options"
                :label="prop.label"
                item-title="title"
                item-value="value"
            ></v-select>

            <!-- Farbwähler -->
            <v-color-picker
                width="100%"
                v-else-if="prop.type === 'color' && prop.active"
                v-model="settings[key]"
                :label="prop.label"
                variant="flat"
                rounded
            ></v-color-picker>
          </div>
        </template>
        <template v-if="index === 7">
          <v-select
              label="Methode wählen"
              v-model="settings.method"
              :items="itemMethods"
              item-title="title"
              item-value="value"
              outlined
          ></v-select>
        </template>
        <template v-if="index === 8">
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
            <v-card-text>
              <!-- Anzeigen der letzten Builds -->
              <v-row  v-if="sortedBuilds.length" class="map-grid overflow-hidden overflow-y-auto py-8" justify="start" style="height: 80vh; max-height: 80vh;">
                <v-col
                    v-for="(build, index) in sortedBuilds"
                    :key="build.id"
                    class="map-item"
                    cols="12"
                >
                  <v-badge class="absolute-badge" color="error" :content="build.buildMaps.length + build.tiledMaps.length"></v-badge>
                  <v-badge style="top: 36px;" class="absolute-badge" @click="deleteBuild(build.id)" color="error" icon="mdi-delete"></v-badge>
                  <!-- Build Info: Zeitstempel und Karten -->
                  <v-card class="py-6" :style="index === 0 ? 'background-color: #fff8d8;' : ''">
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
                          <v-badge style="right: 26px;" class="absolute-badge" rounded="0" color="error" icon="mdi-fullscreen" @click="openFullscreen(map.src, build.id, map.type)"></v-badge>
                          <v-badge style="top: 36px; right: 26px;" rounded="0" class="absolute-badge" @click="downloadImage(map.src)" color="error" icon="mdi-download"></v-badge>
                          <v-img
                              :src="map.src"
                              :alt="map.type"
                              width="40"
                              height="40"
                              rounded="12"
                              class="map-image"
                              @click="selectDiffuseMap(map.src)"
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
                          <v-badge style="top: 12px; right: 26px;" rounded="0" class="absolute-badge" @click="downloadImage(tile.src)" color="error" icon="mdi-download"></v-badge>
                          <v-img
                              :src="tile.src"
                              :alt="tile.type"
                              width="40"
                              height="40"
                              rounded="12"
                              class="map-image"
                              @click="selectDiffuseMap(tile.src)"
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
              </v-row>
            </v-card-text>
          </v-card>
        </template>
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import {operationModel, operationProps} from "@/models/operation/model";
import {localData} from "@/dataLayer/local";
import {settings} from "@/dataLayer/parameter";
import {methodSettings} from "@/dataLayer/operation";

export default defineComponent({
  name: "OperationComponent",
  props: operationProps,
  setup(props, { emit }) {
    const { emitEvent, tabs, itemMethods, sortOptions, sortedBuilds, deleteBuild, toggleCollapse, openFullscreen, downloadImage, selectDiffuseMap } = operationModel(emit);
    return {
      tabs,
      itemMethods,
      sortOptions,
      sortedBuilds,
      selectDiffuseMap,
      downloadImage,
      openFullscreen,
      toggleCollapse,
      deleteBuild,
      emitEvent,
      localData,
      settings,
      methodSettings,
    };
  },
});
</script>