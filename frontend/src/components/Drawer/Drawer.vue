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

        <v-checkbox
            v-if="currentFile"
            v-model="keepFile"
            label="Texture bearbeiten"
        ></v-checkbox>

        <v-select
            label="Zusätzliche Maps auswählen"
            v-model="selectedMaps"
            :items="mapOptions"
            multiple
            outlined
        ></v-select>

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
          <v-btn icon class="ml-2" size="small" @click="openOsSettingsDialog">
            <v-icon>mdi-cog</v-icon>
          </v-btn>
        </template>
      </PageHeader>

      <v-row justify="center" class="mt-6" style="position:relative;">
        <v-col cols="6" class="relative">
          <!-- Hauptbild -->
          <v-img
              v-if="diffuseMap.diff && animation.length === 0"
              :src="diffuseMap.diff"
              alt="Diffuse Map"
              class="map-image mt-4"
              :key="diffuseMap.diff"
          />
          <img
              v-else-if="animation.length > 0 && playAnimation || animation.length > 0 && pauseAnimation"
              :src="animation.length > 0 && playAnimation || animation.length > 0 && pauseAnimation ? currentFrame : diffuseMap.diff"
              alt="Animated Frames"
              class="map-image mt-4"
              style="max-width: 100%;"
              :key="animation.length > 0 && playAnimation || animation.length > 0 && pauseAnimation ? currentFrame : diffuseMap.diff"
          />
        </v-col>
        <!-- Frame-Panel -->
        <div class="frame-panel-container d-flex align-center flex-wrap" v-if="animation.length > 0">
          <div class="frame-panel d-flex align-center">
            <!-- Iteriere über animation.buildMaps -->
            <div
                v-for="(frame, index) in animation[0]?.buildMaps || []"
                :key="index"
                class="frame-item"
            >
              <v-img
                  v-if="frame.src"
                  :src="frame.src"
                  max-width="50px"
                  max-height="50px"
                  :alt="`Frame ${index + 1}`"
                  class="frame-image"
                  @click="selectDiffuseMap(frame.src)"
              />
            </div>
          </div>
          <!-- Steuerung: Play/Pause -->
          <div class="control-panel">
            <v-btn
                color="primary"
                icon
                variant="outlined"
                @click="toggleAnimation"
            >
              <v-icon>
                {{ isPlaying ? "mdi-pause" : "mdi-play" }}
              </v-icon>
            </v-btn>
          </div>
        </div>
      </v-row>
    </v-container>
  </v-main>

  <!-- Rechte Seite: Grid für die anderen Maps -->
  <v-navigation-drawer width="360" permanent location="right" app>
    <v-card flat>
      <!-- Navigation Header -->
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
                  flat
                  elevation="0"
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

  <v-dialog v-model="osSettingsDialog" max-width="500">
    <v-card>
      <v-card-title>Systemeinstellungen</v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-switch v-model="osSettings.use_gpu" label="Use GPU"></v-switch>
          <v-text-field v-model="osSettings.cpu_threads" label="CPU Threads" type="number"></v-text-field>
          <v-select
              v-model="osSettings.preferred_unit"
              :items="['GPU', 'CPU']"
              label="Preferred Unit"
          ></v-select>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" text @click="saveOsSettings">Save</v-btn>
        <v-btn text @click="osSettingsDialog = false">Cancel</v-btn>
      </v-card-actions>
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
    const keepFile = ref(false)
    const currentFile = ref('')
    const builds = ref([]);
    const animation = ref([]);
    const currentFrameIndex = ref(0);
    const isPlaying = ref(false);
    const intervalId = ref(null);
    const startTime = ref(null);
    const buildId = ref("");
    const selectedMaps = ref(["Diffuse Map"]);
    const fullscreen = ref(false);
    const fullscreenTitle = ref("");
    const fullscreenImage = ref("");
    const fullscreenId = ref("");
    const tiledImage = ref("");
    const zoomMode = ref(false);
    const tileMode = ref(false);
    const activeTab = ref(0);
    const zoomedStyle = ref({})
    const selectedTileSize = ref({ x: 1, y: 1 });
    const diffuseMap = reactive({
      diff: null
    });
    const osSettingsDialog = ref(false);
    const osSettings = reactive({
      use_gpu: false,
      cpu_threads: 1,
      preferred_unit: "CPU",
    });
    const tileSizes = [
      { title: "1x1", value: {x: 1, y: 1} },
      { title: "2x2", value: {x: 2, y: 2} },
      { title: "3x3", value: {x: 3, y: 3} },
      { title: "4x4", value: {x: 4, y: 4} },
      { title: "6x6", value: {x: 6, y: 6} },
      { title: "12x12", value: {x: 12, y: 12} },
    ];
    const tabs = [
      { name: 'Tab 1', icon: 'mdi-water-opacity', content: 'Content for Tab 5' },
      { name: 'Tab 2', icon: 'mdi-theme-light-dark', content: 'Content for Tab 1' },
      { name: 'Tab 3', icon: 'mdi-panorama-variant-outline', content: 'Content for Tab 2' },
      { name: 'Tab 4', icon: 'mdi-shimmer', content: 'Content for Tab 3' },
      { name: 'Tab 5', icon: 'mdi-resize', content: 'Content for Tab 4' },
      { name: 'Tab 6', icon: 'mdi-cube-outline', content: 'Content for Tab 6' },
      { name: 'Tab 6', icon: 'mdi-transition', content: 'Content for Tab 6' },
      { name: 'Tab 6', icon: 'mdi-tools', content: 'Content for Tab 6' },
      { name: 'Tab 6', icon: 'mdi-folder-download-outline', content: 'Content for Tab 6' },
    ];
    const settings = reactive({
      method: 0, // Standardmethode
      cropLeft: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      intensity: 50,
      radius: 10,
      outputFormat: "PNG",
      quality: 80,
      color_overlay: '#ffffff',
      color_overlay_mode: 1,
      colorOverlayModes: [
        { title: "Normal", value: 1 },
        { title: "Sprenkeln", value: 2 },
        { title: "Abdunkeln", value: 3 },
        { title: "Multiplizieren", value: 4 },
        { title: "Farbig nachdunkeln", value: 5 },
        { title: "Linear nachbelichten", value: 6 },
        { title: "Aufhellen", value: 7 },
        { title: "Negativ Multiplizieren", value: 8 },
        { title: "Farbig Abwedeln", value: 9 },
        { title: "Linear Abwedeln", value: 10 },
        { title: "Hellere Farbe", value: 11 },
        { title: "Überlagern", value: 12 },
        { title: "Weiches Licht", value: 13 },
        { title: "Hartes Licht", value: 14 },
        { title: "Strahlendes Licht", value: 15 },
        { title: "Lineares Licht", value: 16 },
        { title: "Lichtpunkt", value: 17 },
        { title: "Hart mischen", value: 18 },
        { title: "Differenz", value: 19 },
        { title: "Subtrahieren", value: 20 },
        { title: "Dividieren", value: 21 },
        { title: "Farbton", value: 22 },
        { title: "Sättigung", value: 23 },
        { title: "Farbe", value: 24 },
        { title: "Luminanz", value: 25 },
      ],
      color_shift: 0,
      hue_variation: 0,
      invert_colors: false,
      brightness: 100,
      contrast: 50,
      edge_detection: false,
      blur: 0,
      blur_mode: 1,
      blurModes: [
        { title: "Gaußscher", value: 1 },
        { title: "Radial", value: 2 },
        { title: "Quadratisch", value: 3 },
        { title: "Bewegungsunschärfe", value: 4 },
        { title: "Fischauge", value: 5 },
        { title: "Radiale Strahlen", value: 6 },
        { title: "Quadratische Strahlen", value: 7 },
      ],
      blur_radius: 0,
      blur_falloff_mode: 1,
      blurFalloffModes: [
        { title: "Linear", value: 1 },
        { title: "Exponentiell", value: 2 },
        { title: "Logarithmisch", value: 3 },
        { title: "Quadratisch", value: 4 },
        { title: "Kubisch", value: 5 },
      ],
      blur_type: 1,
      blurTypes: [
        { title: "Innen", value: 1 },
        { title: "Außen", value: 2 },
      ],
      color_lookup: 0,
      colorLookupModes: [
        { "title": "Neutral", "value": 0 },
        { "title": "Warm", "value": 1 },
        { "title": "Kalt", "value": 2 },
        { "title": "Sepia", "value": 3 },
        { "title": "Schwarz-Weiß", "value": 4 },
        { "title": "Hoher Kontrast", "value": 5 },
        { "title": "Vintage", "value": 6 },
        { "title": "Nachtvision", "value": 7 },
        { "title": "Sonnenuntergang", "value": 8 },
        { "title": "Bläulich", "value": 9 },
        { "title": "Überbelichtet", "value": 10 },
        { "title": "Gedämpft", "value": 11 },
        { "title": "Retro", "value": 12 },
        { "title": "Dramatisch", "value": 13 },
        { "title": "Verblasst", "value": 14 },
        { "title": "Weich", "value": 15 },
        { "title": "Kaltes Film-Look", "value": 16 },
        { "title": "Sandig", "value": 17 },
        { "title": "Flüssig", "value": 18 },
        { "title": "Verdreht", "value": 19 },
        { "title": "Verbrannt (mit verkohlten Ecken)", "value": 20 },
        { "title": "Nass", "value": 21 },
        { "title": "Glass", "value": 22 },
        { "title": "Milchglas", "value": 23 },
        { "title": "Galaxie", "value": 24 },
        { "title": "Große Tropfen", "value": 25 }
      ],
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
      noise_level: 0,
      rotation_angle: 0,
      tile_size: 0,
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
      simulate_mode: 0,
      simulateModes: [
        { title: "Nichts", value: 0 },
        { title: "Wellen", value: 1 },
        { title: "Wasser", value: 2 },
        { title: "Lava", value: 3 },
        { title: "Gras", value: 4 },
        { title: "Felsen", value: 5 },
        { title: "Steine", value: 6 },
        { title: "Boden", value: 7 },
        { title: "Partikel", value: 8 },
        { title: "Skybox", value: 9 },
      ],
      frame_count: 1,
      frequency: 1.0,
      phase_shift: 0,
      amplitude: 50,
      amplitude_multiplier: 1.0,
      wave_type: 0,
      waveTypes: [
        { title: "Sinus", value: 0 },
        { title: "Cosinus", value: 1 },
        { title: "Sinus und Cosinus", value: 2 },
      ],
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
      { title: "Keine", value: 0 },
      { title: "Geglättete Collage", value: 1 },
      { title: "Verstreute Ränder", value: 2 },
      { title: "Geglättete Kopien", value: 3 },
      { title: "Rahmen wiederherstellen", value: 4 },
      { title: "Kleine Steine", value: 5 },
      { title: "Gras", value: 6 },
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
      0: {
          color_overlay: settings.color_overlay,
          color_overlay_mode: settings.color_overlay_mode,
          color_shift: settings.color_shift,
          hue_variation: settings.hue_variation,
          invert_colors: settings.invert_colors},
      1: {
          brightness: settings.brightness,
          contrast: settings.contrast,
          sharpness: settings.sharpness,
          edge_detection: settings.edge_detection
      },
      2: {
          blur: settings.blur,
          blur_mode: settings.blur_mode,
          blur_radius: settings.blur_radius,
          blur_falloff_mode: settings.blur_falloff_mode,
          blur_type: settings.blur_type
      },
      3: {
      },
      4: {},
      5: {},
      6: {
        simulate_mode: 0
      },
      7: {
      },
      8: {},
    };

    const methodSettings = computed(() =>({
      0: {
        color_overlay: {
          active: true,
          type: "color",
          label: "Farbverschiebung",
        },
        color_overlay_mode: {
          active: true,
          type: "select",
          label: "Überlagerung",
          options: settings.colorOverlayModes
        },
        color_shift: {
          active: true,
          type: "slider",
          label: "Farbverschiebung",
          min: -100,
          max: 100,
          step: 1,
        },
        hue_variation: {
          active: true,
          type: "slider",
          label: "Farbtonvariation",
          min: -180,
          max: 180,
          step: 1,
        },
        invert_colors: {
          active: true,
          type: "checkbox",
          label: "Farben invertieren",
        },
      },
      1: {
        brightness: {
          active: true,
          type: "slider",
          label: "Helligkeit",
          min: 0,
          max: 200,
          step: 1,
        },
        contrast: {
          active: true,
          type: "slider",
          label: "Kontrast",
          min: 0,
          max: 100,
          step: 1,
        },
        sharpness: {
          active: true,
          type: "slider",
          label: "Schärfe",
          min: 0,
          max: 2,
          step: 0.1,
        },
        edge_detection: {
          active: true,
          type: "checkbox",
          label: "Kantenerkennung",
        },
      },
      2: {
        blur_mode: {
          active: true,
          type: "select",
          label: "Weichzeichnungs-Filter",
          options: settings.blurModes
        },
        blur_falloff_mode: {
          active: true,
          type: "select",
          label: "Weichzeichnungs-Verlauf",
          options: settings.blurFalloffModes
        },
        blur_type: {
          active: true,
          type: "select",
          label: "Weichzeichnungs-Typ",
          options: settings.blurTypes
        },
        blur: {
          active: true,
          type: "slider",
          label: "Weichzeichnen",
          min: 0,
          max: 10,
          step: 0.1,
        },
        blur_radius: {
          active: true,
          type: "slider",
          label: "Radius",
          min: 0,
          max: 200,
          step: 1,
        },
        noise_level: {
          active: true,
          type: "slider",
          label: "Rauschlevel",
          min: 0,
          max: 100,
          step: 1,
        },
      },
      3: {
        color_lookup: {
          active: true,
          type: "select",
          label: "Filmfarben-Filter",
          options: settings.colorLookupModes
        },
      },
      4: {
        cropTop: {
          active: true,
          type: "number",
          label: "Oben (px)",
          min: 0,
          max: 256,
          step: 1,
        },
        cropLeft: {
          active: true,
          type: "number",
          label: "Links (px)",
          min: 0,
          max: 256,
          step: 1,
        },
        cropBottom: {
          active: true,
          type: "number",
          label: "Unten (px)",
          min: 0,
          max: 256,
          step: 1,
        },
        cropRight: {
          active: true,
          type: "number",
          label: "Rechts (px)",
          min: 0,
          max: 256,
          step: 1,
        },
      },
      5: {},
      6: {
        simulate_mode: {
          active: true,
          type: "select",
          label: "Motion-Filter",
          options: settings.simulateModes
        },
        wave_type: {
          active: settings?.simulate_mode === 1,
          type: "select",
          label: "Wellen-Typ",
          options: settings.waveTypes
        },
        frame_count: {
          active: settings?.simulate_mode !== 0,
          type: "number",
          label: "Frames",
          min: 1,
          max: 30,
          step: 1,
        },
        amplitude: {
          active: settings?.simulate_mode === 1,
          type: "slider",
          label: "Amplitude",
          min: 0,
          max: 100,
          step: 1,
        },
        amplitude_multiplier: {
          active: settings?.simulate_mode === 1,
          type: "slider",
          label: "Amplitude-Verstärker",
          min: 0,
          max: 2,
          step: 0.1,
        },
        frequency: {
          active: settings?.simulate_mode === 1,
          type: "slider",
          label: "Frequenz",
          min: 0,
          max: 5,
          step: 0.1,
        },
        phase_shift: {
          active: settings?.simulate_mode === 1,
          type: "slider",
          label: "Phase",
          min: 0,
          max: 5,
          step: 0.1,
        },
      },
      7: {},
      8: {},
    }));

    const currentFrame = computed(() => {
      // Aktuellen Frame basierend auf currentFrameIndex berechnen
      const aniStack = animation.value[0]?.buildMaps || [];
      return aniStack[currentFrameIndex.value]?.src || null;
    });

    const toggleAnimation = () => {
      if (isPlaying.value) {
        pauseAnimation();
      } else {
        playAnimation();
      }
    }

    const playAnimation = () => {
      isPlaying.value = true;
      startTime.value = performance.now(); // Setzt den Startzeitpunkt
      animateFrame();
    }

    const animateFrame = () => {
      const buildMaps = animation.value[0]?.buildMaps || [];
      if (!isPlaying.value || buildMaps.length === 0) return;

      // Berechne die Zeit, die seit dem Start vergangen ist
      const now = performance.now();
      const elapsed = now - startTime.value;

      // Bestimme den aktuellen Frame basierend auf der verstrichenen Zeit
      currentFrameIndex.value = Math.floor(elapsed / 200) % buildMaps.length;

      // Plane den nächsten Frame, ohne Verzögerungen
      const nextFrameTime = startTime.value + (currentFrameIndex.value + 1) * 200;
      const delay = Math.max(nextFrameTime - performance.now(), 0);

      intervalId.value = setTimeout(() => {
        animateFrame();
      }, delay);
    }

    const pauseAnimation = () => {
      isPlaying.value = false;
      if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
      }
    }

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

    const fetchOsSettings = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/settings", {
          responseType: "json",
        });
        // Die aktuellen Einstellungen in die `osSettings` Variable einfügen
        Object.assign(osSettings, response.data);
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };

    const saveOsSettings = async () => {
      try {
        const response = await axios.post(
            "http://127.0.0.1:5000/settings",
            { ...osSettings },
            {
              responseType: "json",
            }
        );
        console.log("Settings saved successfully:", response.data);
        osSettingsDialog.value = false;  // Dialog schließen nach dem Speichern
      } catch (err) {
        console.error("Error saving settings:", err);
      }
    };

    const openOsSettingsDialog = () => {
      fetchOsSettings();
      osSettingsDialog.value = true;
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
      currentFile.value = mapUrl
    };

    const processImage = async () => {
      if (!file.value) {
        console.error("Bitte ein Bild auswählen.");
        return;
      }

      diffuseMap.diff = null; // Zurücksetzen, bevor das Bild verarbeitet wird

      const formData = new FormData();
      if (file.value === '' && !keepFile.value || file.value && !keepFile.value) {
        formData.append("file", file.value);
      } else {
        formData.append("editFile", currentFile.value);
      }
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

        if(animation.value.length > 0) {
          builds.value.push(animation.value[0])
          animation.value = []
        }

        if (response.data.animationFrames && response.data.animationFrames.length > 0) {
          diffuseMap.diff = response.data.animationFrames[0].url; // Speichere das erste Frame der Animation
          const animationUrls = response.data.animationFrames.map((map) => ({
            src: map.url,
            type: map?.type,
          }));
          const newBuild = {
            id: uuidv4(),
            maps: 'Animation Frames',
            buildMaps: [...animationUrls], // Liste der Frame-URLs
            timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'), // Zeitstempel
            imageCount: response.data.animationFrames.length, // Anzahl der Frames
            tiledMaps: [],
            collapsed: true,
          };
          if (animation.value.length === 0) {
            animation.value.push(newBuild);
          }
          else {
            animation.value = []
            animation.value.push(newBuild);
          }
        }
        else {
          // Setze das diffuseMap.diff auf das erste Element von additionalMaps
          if (response.data.additionalMaps && response.data.additionalMaps.length > 0) {
            diffuseMap.diff = response.data.additionalMaps[0].url; // Standard auf das erste Element setzen
            currentFile.value = response.data.additionalMaps[0].url;
          }

          if(animation.value.length > 0) {
            builds.value.push(animation.value[0])
            animation.value = []
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
        }
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
          }
        }
    );

    watch(
        () => animation.value,
        (newVal, oldVal) => {
          if (newVal !== oldVal) {
            console.log(animation.value, newVal)
          }
        }
    );

    return {
      file,
      keepFile,
      currentFile,
      builds,
      buildId,
      animation,
      currentFrameIndex,
      isPlaying,
      intervalId,
      toggleAnimation,
      startTime,
      animateFrame,
      currentFrame,
      playAnimation,
      pauseAnimation,
      selectedMaps,
      diffuseMap,
      settings,
      activeTab,
      tabs,
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
      osSettings,
      osSettingsDialog,
      fetchOsSettings,
      saveOsSettings,
      openOsSettingsDialog
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

.tab-navigation {
  height: 32px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.scrollFx{
  position: absolute;
  height: 80vh;
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
  overflow-y: auto;
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

/* Styling für das Frame-Panel */
.frame-panel {
  height: 100%;
  flex-direction: column;
  max-height: 500px;
  overflow: hidden;
  overflow-y: auto;
}

.frame-panel-container{
  position: absolute;
  right: 16px;
  max-width: 85px;
  height: 100%;
  top: 50%;
  transform: translateY(-50%);
  background-color: hsla(0, 0%, 100%, .9);
  padding: 10px;
  border-radius: 8px;
}

/* Styling für jedes Frame */
.frame-item {
  margin-bottom: 8px; /* Abstand zwischen den Frames */
}

.frame-image {
  width: 80px; /* Feste Breite */
  height: auto; /* Höhe proportional */
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
