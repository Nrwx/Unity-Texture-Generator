<template>
  <v-navigation-drawer permanent left>
    <v-card flat>
      <v-card-title class="headline">Einstellungen</v-card-title>
      <v-card-text>
        <!-- Formulare für Bildauswahl, Methoden und Zusätzliche Maps -->
        <v-file-input
            label="Bild auswählen"
            v-model="file"
            @change="selectFile"
            accept="image/*"
        ></v-file-input>

        <v-select
            label="Zusätzliche Maps auswählen"
            v-model="selectedMaps"
            :items="mapOptions"
            multiple
            outlined
        ></v-select>

        <v-select
            label="Methode wählen"
            v-model="settings.method"
            :items="itemMethods"
            item-title="title"
            item-value="value"
            outlined
        ></v-select>

        <!-- Dynamische Einstellungen je Methode -->
        <template v-if="methodSettings[settings.method]">
          <div v-for="(prop, key) in methodSettings[settings.method]" :key="key">
            <!-- Textfeld für Zahlen -->
            <v-text-field
                v-if="prop.type === 'number'"
                v-model.number="settings[key]"
                :label="prop.label"
                :type="prop.inputType || 'number'"
                outlined
            ></v-text-field>
            <!-- Slider -->
            <v-slider
                v-if="prop.type === 'slider'"
                v-model="settings[key]"
                :label="prop.label"
                :min="prop.min"
                :max="prop.max"
                :step="prop.step || 1"
                thumb-label
            ></v-slider>
            <!-- Checkbox -->
            <v-checkbox
                v-else-if="prop.type === 'checkbox'"
                v-model="settings[key]"
                :label="prop.label"
            ></v-checkbox>

            <!-- Switch -->
            <v-switch
                v-else-if="prop.type === 'switch'"
                v-model="settings[key]"
                :label="prop.label"
            ></v-switch>

            <!-- Dropdown -->
            <v-select
                v-else-if="prop.type === 'select'"
                v-model="settings[key]"
                :items="prop.options"
                :label="prop.label"
                item-title="title"
                item-value="value"
            ></v-select>

            <!-- Farbwähler -->
            <v-color-picker
                v-else-if="prop.type === 'color'"
                v-model="settings[key]"
                :label="prop.label"
                flat
            ></v-color-picker>
          </div>
        </template>

        <!-- Cropping Settings -->
        <v-row>
          <v-col cols="6">
            <v-text-field
                v-model.number="settings.cropLeft"
                label="Links (px)"
                type="number"
                outlined
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
                v-model.number="settings.cropTop"
                label="Oben (px)"
                type="number"
                outlined
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
                v-model.number="settings.cropRight"
                label="Rechts (px)"
                type="number"
                outlined
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
                v-model.number="settings.cropBottom"
                label="Unten (px)"
                type="number"
                outlined
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- Prozess Button -->
        <v-btn color="primary" block @click="processImage">
          Prozess Bild
        </v-btn>
      </v-card-text>
    </v-card>
  </v-navigation-drawer>

  <!-- Hauptinhalt -->
  <v-main>
    <v-container>
      <PageHeader>
        <template v-slot:header>
          Seamless Texture Generator
        </template>
        <template v-slot:subtitle>
          Create professional Game Texture Maps
        </template>
        <template v-slot:action>
          <v-btn icon class="ml-2" size="small" @click="openSettingsDialog">
            <v-icon>mdi-cog</v-icon>
          </v-btn>
        </template>
      </PageHeader>

      <v-row justify="center" class="mt-6">
        <v-col cols="12" md="6">
          <v-img
              v-if="diffuseMap.diff"
              :src="diffuseMap.diff"
              alt="Diffuse Map"
              class="map-image mt-4"
              :key="diffuseMap.diff"
          />
        </v-col>
      </v-row>
    </v-container>
  </v-main>

  <!-- Rechte Seite: Grid für die anderen Maps -->
  <v-navigation-drawer width="320" permanent location="right" app>
    <v-card height="100%">
      <v-card-title class="headline d-flex align-center mb-6">
        <div class="text-truncate" style="width: 100%;">Output</div>
        <v-select
            v-model="sortOrder"
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
        <v-row  v-if="sortedBuilds.length" class="map-grid overflow-hidden overflow-y-auto py-8" justify="start" style="height: 500px; max-height: 500px;">
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
  </v-navigation-drawer>

  <!-- Vollbildansicht -->
  <v-dialog v-model="fullscreen" fullscreen>
    <v-card class="dialog-dimm">
      <v-btn icon class="close-btn absolute-badge" style="top: 32px; right: 32px;" @click="closeFullscreen">
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-btn icon class="close-btn absolute-badge" style="top: 32px; right: 96px;" @click="tileMode = !tileMode">
        <v-icon>{{ tileMode ? 'mdi-grid-off' : 'mdi-grid'}}</v-icon>
      </v-btn>
      <v-btn icon class="close-btn absolute-badge" style="top: 32px; right: 160px;" @click="zoomMode = !zoomMode">
        <v-icon>{{ zoomMode ? 'mdi-magnify-remove-outline' : 'mdi-magnify-scan'}}</v-icon>
      </v-btn>
      <div class="zoomedContainer" v-if="zoomMode">
        <v-img
            :src="tileMode && tiledImage && selectedTileSize.x > 1 && selectedTileSize.y > 1 ? tiledImage : fullscreenImage"
            alt="Zoomed Image"
            @mousemove="handleImageZoom"
            @mouseleave="resetZoom"
        ></v-img>
      </div>
      <div class="d-flex align-center justify-center ml-auto mr-auto" style="position: relative; width: 100%; height: 100%; max-width: 1024px;">
        <v-img :src="tileMode && tiledImage && selectedTileSize.x > 1 && selectedTileSize.y > 1 ? tiledImage : fullscreenImage" alt="Fullscreen Image"></v-img>
        <div v-if="zoomMode" class="targetZoomContainer" :style="zoomedStyle"></div>
      </div>
      <div class="tileMenu d-flex align-center justify-center pa-4" v-if="tileMode">
        <v-select
            v-model="selectedTileSize"
            :items="tileSizes"
            theme="dark"
            item-title="title"
            item-value="value"
            label="Kachelgröße"
            outlined
        ></v-select>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import {ref, reactive, defineComponent, computed, watch} from "vue";
import axios from "axios";
import PageHeader from "@/components/PageHeader/PageHeader";
import dayjs from "dayjs";
import { v4 as uuidv4 } from 'uuid';

export default defineComponent({
  name: "DrawerComponent",
  components: {
    PageHeader,
  },
  setup() {
    const file = ref(null);
    const builds = ref([]);
    const buildId = ref("");
    const selectedMaps = ref(["Diffuse Map"]);
    const fullscreen = ref(false);
    const fullscreenTitle = ref("");
    const fullscreenImage = ref("");
    const fullscreenId = ref("");
    const tiledImage = ref("");
    const zoomMode = ref(false);
    const tileMode = ref(false);
    const zoomedStyle = ref({})
    const selectedTileSize = ref({ x: 1, y: 1 });
    const diffuseMap = reactive({
      diff: null
    });
    const tileSizes = [
      { title: "1x1", value: {x: 1, y: 1} },
      { title: "2x2", value: {x: 2, y: 2} },
      { title: "3x3", value: {x: 3, y: 3} },
      { title: "4x4", value: {x: 4, y: 4} },
      { title: "6x6", value: {x: 6, y: 6} },
      { title: "12x12", value: {x: 12, y: 12} },
    ];
    const settings = reactive({
      method: "2", // Standardmethode
      cropLeft: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      intensity: 50,
      radius: 10,
      outputFormat: "PNG",
      quality: 80,
      blending_intensity: 0.5,
      max_shift_ratio: 0.1,
      shift_x: 0.1,
      shift_y: 0.1,
      border_width: 10,
      stone_size: 10,
      density: 0.5,
      blade_length: 20,
      blade_width: 1,
      sharpness: 0,
      color_shift: 0,
      noise_level: 0,
      invert_colors: false,
      rotation_angle: 0,
      contrast: 100,
      hue_variation: 0,
      tile_size: 0,
      edge_detection: false,
      tile_x: 6,
      tile_y: 6,
      base_tile_x: 4,
      base_tile_y: 4,
      base_brightness: 0,
      base_contrast: 1,
      base_sharpness: 1,
      base_smoothness: 0.7,
      base_fade_alpha: 0.1,
      base_opacity: 1,
      opacity: 1,
      fade_alpha: 0.1,
      smoothness: 0.5,
      randomness: 0.3,
      brightness: 100,
      blur: 1,
      blur_mode: 1,
      blurModes: [
        { title: "Gaussian Blur", value: 1 },
        { title: "Radial Blur", value: 2 },
        { title: "Quadratic Blur", value: 3 },
        { title: "Motion Blur", value: 4 },
        { title: "Fisheye Blur", value: 5 },
        { title: "Radial Rays", value: 6 },
        { title: "Quadratic Rays", value: 7 },
      ]
    });

    // Generiert die Kachelansicht basierend auf der aktuellen Auswahl
    const generateTileLayout = async () => {
      try {
        const build = builds.value.find((b) => b.id === fullscreenId.value);
        const prefix = fullscreenTitle.value + ' (' + selectedTileSize.value.x + 'x' + selectedTileSize.value.y + ')'

        if(!build.maps.includes(prefix)) {
          const formData = new FormData();
          formData.append("diffuse_image_url", fullscreenImage.value);
          formData.append("tile_x", selectedTileSize.value.x);
          formData.append("tile_y", selectedTileSize.value.y);

          const response = await axios.post(
              "http://127.0.0.1:5000/tile",
              formData,
              {
                responseType: "json",
              });

          if (response.data && response.data.url) {
            tiledImage.value = "";
            const newTileMap = {
              src: response.data.url,
              type: prefix,
            };

            if (selectedTileSize.value.x > 1 && selectedTileSize.value.y > 1) {
              buildId.value = fullscreenId.value
              build.maps = [...build.maps.split(', '), newTileMap.type].join(', ');
              build.tiledMaps.push(newTileMap);
              build.timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss')
            }
            tiledImage.value = response.data.url;
          }
        }
        else {
          const cache = build.tiledMaps.find((b) => b.type === prefix);
          tiledImage.value = cache.src
          console.log('API response skipped');
        }
      } catch (error) {
        console.error("Error during tile image generation:", error);
      }
    };

    const handleImageZoom = (event) => {
      const container = event.currentTarget;
      const { left, top, width, height } = container.getBoundingClientRect();

      // Mausposition relativ zum Container
      const mouseX = event.clientX - left;
      const mouseY = event.clientY - top;

      // Prozentuale Position
      const xPercent = (mouseX / width) * 100;
      const yPercent = (mouseY / height) * 100;

      // Zoom-Stil anpassen
      zoomedStyle.value = {
        backgroundImage: `url(${tileMode.value && tiledImage.value && selectedTileSize.value.x > 1 && selectedTileSize.value.y > 1 ? tiledImage.value : fullscreenImage.value})`,
        backgroundSize: '200%', // Zoom-Level
        backgroundPosition: `${xPercent}% ${yPercent}%`,
      };
    };
    const resetZoom = () => {
      // Zoom zurücksetzen
      zoomedStyle.value = {
        backgroundPosition: '50% 50%',
        backgroundSize: '100%',
      };
    }

    const itemMethods = [
      { title: "Smoothed Collage", value: "1" },
      { title: "Scattered Edges", value: "2" },
      { title: "Smoothed Copies", value: "3" },
      { title: "Restoring Frame", value: "4" },
      { title: "Small Stones", value: "5" },
      { title: "Grass", value: "6" },
    ];

    const mapOptions = [
      "Diffuse Map",
      "Normal Map",
      "Specular Map",
      "Bump Map",
      "Light Map",
      "Alpha Map",
    ];

    // Methodenspezifische Standardwerte
    const methodDefaults = {
      "1": { intensity: 5, radius: 2, blending_intensity: 0.5, tile_x: 6, tile_y: 6 },
      "2": {
        max_shift_ratio: 0.1,
        blending_intensity: 0.5,
        sharpness: 0,
        color_shift: 0,
        noise_level: 0,
        invert_colors: false,
        rotation_angle: 0,
        contrast: 100,
        hue_variation: 0,
        blur: 0,
        brightness: 100,
        blur_mode: 1,
        blur_radius: 0,
        edge_detection: false,
      },
      "3": { radius: 10, shift_x: 0.1, shift_y: 0.1 },
      "4": { border_width: 10, intensity: 50 },
      "5": { stone_size: 10, density: 0.5, intensity: 50 },
      "6": {
        base_tile_x: 4,
        base_tile_y: 4,
        base_fade_alpha: 0.1,
        base_brightness: 0,
        base_contrast: 1,
        base_sharpness: 1,
        base_smoothness: 0.7,
        base_opacity: 1,
        blur_mode: 1,
        tile_x: 6,
        tile_y: 6,
        opacity: 1,
        brightness: 0,
        fade_alpha: 0.1,
        sharpness: 1.5,
        contrast: 1.2,
      },
    };

    const methodSettings = {
      "1": {
        tile_x: {
          type: "slider",
          label: "Kachel X",
          min: 1,
          max: 6,
          step: 1,
        },
        tile_y: {
          type: "slider",
          label: "Kachel Y",
          min: 1,
          max: 6,
          step: 1,
        },
        intensity: {
          type: "slider",
          label: "Helligkeit",
          min: 0,
          max: 100,
        },
        radius: {
          type: "slider",
          label: "Radius",
          min: 0,
          max: 50,
        },
        blending_intensity: {
          type: "slider",
          label: "Blending-Intensität",
          min: 0.01,
          max: 1,
          step: 0.01,
        },
      },
      "2": {
        invert_colors: {
          type: "checkbox",
          label: "Farben invertieren",
        },
        edge_detection: {
          type: "checkbox",
          label: "Kantenerkennung",
        },
        brightness: {
          type: "slider",
          label: "Helligkeit",
          min: -2,
          max: 2,
        },
        contrast: {
          type: "slider",
          label: "Kontrast",
          min: -2,
          max: 2,
          step: 1,
        },
        blur_mode: {
          type: "select",
          label: "Weichzeichnungs-Filter",
          options: settings.blurModes
        },
        blur: {
          type: "slider",
          label: "Weichzeichnen",
          min: 0,
          max: 100,
        },
        blur_radius: {
          type: "slider",
          label: "Weichzeichnen",
          min: 0,
          max: 50,
        },
        max_shift_ratio: {
          type: "slider",
          label: "Max. Verschiebung",
          min: 0.01,
          max: 1,
          step: 0.01,
        },
        blending_intensity: {
          type: "slider",
          label: "Blending-Intensität",
          min: 0,
          max: 1,
          step: 0.01,
        },
        sharpness: {
          type: "slider",
          label: "Schärfe",
          min: 0,
          max: 100,
        },
        color_shift: {
          type: "slider",
          label: "Farbverschiebung",
          min: -100,
          max: 100,
          step: 1,
        },
        noise_level: {
          type: "slider",
          label: "Rauschlevel",
          min: 0,
          max: 100,
        },
        rotation_angle: {
          type: "slider",
          label: "Rotationswinkel",
          min: -180,
          max: 180,
        },
        hue_variation: {
          type: "slider",
          label: "Farbtonvariation",
          min: -180,
          max: 180,
        },
      },
      "3": {
        radius: {
          type: "slider",
          label: "Radius",
          min: 0,
          max: 50,
        },
        shift_x: {
          type: "slider",
          label: "Verschiebung X",
          min: -1,
          max: 1,
          step: 0.01,
        },
        shift_y: {
          type: "slider",
          label: "Verschiebung Y",
          min: -1,
          max: 1,
          step: 0.01,
        },
      },
      "4": {
        border_width: {
          type: "slider",
          label: "Rahmenbreite",
          min: 0,
          max: 100,
        },
        intensity: {
          type: "slider",
          label: "Intensität",
          min: 0,
          max: 100,
        },
      },
      "5": {
        stone_size: {
          type: "slider",
          label: "Steingröße",
          min: 0,
          max: 100,
        },
        stone_variance: {
          type: "slider",
          label: "Steinvariabilität",
          min: 0,
          max: 1,
          step: 0.01,
          description: "Steuert die Variabilität der Steingröße. 0 = gleichmäßige Größe, 1 = maximale Variabilität."
        },
        density: {
          type: "slider",
          label: "Dichte",
          min: 0,
          max: 1,
          step: 0.01,
        },
        intensity: {
          type: "slider",
          label: "Intensität",
          min: 0,
          max: 100,
        },
      },
      "6": {
        base_opacity: {
          type: "slider",
          label: "Base Deckkraft",
          min: 0,
          max: 1,
          step: 0.1,
        },
        base_tile_x: {
          type: "slider",
          label: "Base X",
          min: 1,
          max: 6,
          step: 1,
        },
        base_tile_y: {
          type: "slider",
          label: "Base Y",
          min: 1,
          max: 6,
          step: 1,
        },
        blur: {
          type: "slider",
          label: "Weichzeichnen",
          min: 0,
          max: 50,
        },
        blur_mode: {
          type: "select",
          label: "Weichzeichnungs-Filter",
          options: settings.blurModes
        },
        base_brightness: {
          type: "slider",
          label: "Base Helligkeit",
          min: -2,
          max: 2,
          step: 0.1,
        },
        base_contrast: {
          type: "slider",
          label: "Base Kontrast",
          min: -2,
          max: 2,
          step: 0.1,
        },
        base_sharpness: {
          type: "slider",
          label: "Base Schärfe",
          min: 0,
          max: 2,
          step: 0.1,
        },
        base_fade_alpha: {
          type: "slider",
          label: "Base Alpha",
          min: 0,
          max: 1,
          step: 0.1,
        },
        opacity: {
          type: "slider",
          label: "Sub Deckkraft",
          min: 0,
          max: 1,
          step: 0.1,
        },
        tile_x: {
          type: "slider",
          label: "Kacheln X-Achse",
          min: 1,
          max: 12,
          step: 1,
        },
        tile_y: {
          type: "slider",
          label: "Kacheln Y-Achse",
          min: 1,
          max: 12,
          step: 1,
        },
        brightness: {
          type: "slider",
          label: "Sub Helligkeit",
          min: 0,
          max: 5,
          step: 0.1,
        },
        sharpness: {
          type: "slider",
          label: "Sub Schärfe",
          min: 0,
          max: 5,
          step: 0.1,
        },
        contrast: {
          type: "slider",
          label: "Sub Kontrast",
          min: 0,
          max: 2,
          step: 0.1,
        },
        fade_alpha: {
          type: "slider",
          label: "Alpha Fade",
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
    };

    const sortOrder = ref("newest");
    const sortOptions = [
      { title: "Neueste", value: "newest" },
      { title: "Älteste", value: "oldest" },
    ];

    const sortedBuilds = computed(() => {
      return [...builds.value].sort((a, b) => {
        return sortOrder.value === "newest"
            ? new Date(b.timestamp) - new Date(a.timestamp)
            : new Date(a.timestamp) - new Date(b.timestamp);
      });
    });

    const toggleCollapse = (index) => {
      sortedBuilds.value[index].collapsed = !sortedBuilds.value[index].collapsed;
    };

    const deleteBuild = (id) => {
      builds.value = builds.value.filter((b) => b.id !== id);
    };


    const openFullscreen = (src, id, title) => {
      fullscreenTitle.value = title
      fullscreenId.value = id
      fullscreenImage.value = src;
      fullscreen.value = true;
    };

    const closeFullscreen = () => {
      fullscreen.value = false
      fullscreenTitle.value = ""
      fullscreenId.value = ""
      fullscreenImage.value = ""
      tileMode.value = false
      selectedTileSize.value = {x: 1, y: 1}
      resetZoom()
      tiledImage.value = ""
      zoomMode.value = false
    };

    const downloadImage = (src) => {
      const link = document.createElement("a");
      link.href = src;
      link.download = src.split("/").pop();
      link.click();
    };

    const selectFile = (event) => {
      file.value = event.target.files[0];
    };

    const selectDiffuseMap = (mapUrl) => {
      diffuseMap.diff = mapUrl;
    };

    const processImage = async () => {
      if (!file.value) {
        console.error("Bitte ein Bild auswählen.");
        return;
      }

      diffuseMap.diff = null; // Zurücksetzen, bevor das Bild verarbeitet wird

      const formData = new FormData();
      formData.append("file", file.value);
      Object.keys(settings).forEach((key) => {
        formData.append(key, settings[key]);
      });
      formData.append("selectedMaps", selectedMaps.value.join(","));

      try {
        const response = await axios.post(
            "http://127.0.0.1:5000/upload",
            formData,
            {
              responseType: "json",
            }
        );

        // Setze das diffuseMap.diff auf das erste Element von additionalMaps
        if (response.data.additionalMaps && response.data.additionalMaps.length > 0) {
          diffuseMap.diff = response.data.additionalMaps[0].url; // Standard auf das erste Element setzen
        }

        // Füge die anderen Maps in das additionalMaps Array hinzu
        const newMaps = response.data.additionalMaps.map((map) => ({
          src: map.url,
          type: map.type,
        }));

        // Erzeuge eine neue Build-ID mit UUID v4
        const id = uuidv4();
        buildId.value = id
        // Neuer Build
        const newBuild = {
          id: id,
          maps: selectedMaps.value.join(", "), // Ausgewählte Maps
          buildMaps: [...newMaps], // Kopie der Maps (nicht den globalen array referenzieren)
          timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'), // Zeitstempel mit dayjs
          imageCount: response.data.additionalMaps.length, // Anzahl der verarbeiteten Bilder
          tiledMaps: [],
          collapsed: true,
        };

        builds.value.push(newBuild);

      } catch (error) {
        console.error("Fehler beim Verarbeiten des Bildes:", error);
      }
    };

    // Methodenwechsel beobachten und Standardwerte anwenden
    watch(
        () => settings.method,
        (newMethod) => {
          // Wende methodenspezifische Defaults an, ohne andere Settings zu ändern
          Object.assign(settings, methodDefaults[newMethod]);
        },
        { immediate: true }
    );

    watch(() => selectedTileSize.value, async (newVal, oldVal) => {
      if (tileMode.value && newVal !== oldVal) {
        await generateTileLayout();
      }
    });

    watch(
        () => buildId.value,
        (newVal, oldVal) => {
          if (newVal !== oldVal) {
            builds.value = builds.value.map((build) => {
              return {
                ...build,
                collapsed: build.id !== buildId.value,
              };
            });
            console.log(sortedBuilds.value);
          }
        }
    );

    return {
      file,
      builds,
      buildId,
      selectedMaps,
      diffuseMap,
      settings,
      itemMethods,
      methodDefaults,
      methodSettings,
      mapOptions,
      selectFile,
      processImage,
      selectDiffuseMap,
      zoomMode,
      zoomedStyle,
      handleImageZoom,
      resetZoom,
      fullscreen,
      fullscreenImage,
      tiledImage,
      tileMode,
      selectedTileSize,
      tileSizes,
      generateTileLayout,
      sortOrder,
      sortOptions,
      sortedBuilds,
      toggleCollapse,
      deleteBuild,
      fullscreenTitle,
      fullscreenId,
      openFullscreen,
      closeFullscreen,
      downloadImage,
    };
  },
});
</script>

<style>

.map-item{
  position: relative;
}

.absolute-badge{
  position: absolute;
  right: 16px;
  z-index: 1;
}

.zoomedContainer {
  position: absolute;
  right: 32px;
  width: 100%;
  max-width: 180px;
  bottom: 32px;
  z-index: 1;
}

.zoomedContainer img {
  opacity: .5;
  transition: ease-in-out ease-in-out .5s;
}

.zoomedContainer:hover img {
  cursor: zoom-in;
  opacity: 1;
}

.targetZoomContainer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  right: 0;
}

.scrollFx{
  position: absolute;
  height: 500px;
  width: 100%;
  left: 0;
  top: 100px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  pointer-events: none;
}

.scrollTop, .scrollBottom{
  height: 100px;
  background: linear-gradient(180deg, white 0%, transparent);
  width: 100%;
}

.scrollBottom{
  margin-top: auto;
  margin-bottom: 0;
  background: linear-gradient(0deg, white 0%, transparent) !important;
}

.dialog-dimm{
  background: rgba(17, 17, 17, 0.9);
  padding: 32px;
  box-shadow: 10px 10px 200px 10px #111 inset;
}

.tile-layout{
  width: 100%;
  max-height: 85vh;
  position: relative;
  overflow: hidden;
  overflow-y: scroll;
  align-items: baseline;
  flex: 0 1 auto;
}

.tileMenu {
  width: auto;
  background: rgb(17, 17, 17);
  color: white;
  position: absolute;
  border-radius: 12px;
  bottom: 32px;
}
</style>
