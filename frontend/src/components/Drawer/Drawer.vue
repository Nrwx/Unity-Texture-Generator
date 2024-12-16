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
            <v-text-field
                v-if="prop.type === 'number'"
                v-model.number="settings[key]"
                :label="prop.label"
                :type="prop.inputType || 'number'"
                outlined
            ></v-text-field>
            <v-slider
                v-if="prop.type === 'slider'"
                v-model="settings[key]"
                :label="prop.label"
                :min="prop.min"
                :max="prop.max"
                :step="prop.step || 1"
                thumb-label
            ></v-slider>
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
              :key="index"
              class="map-item"
              cols="12"
          >
            <v-badge class="absolute-badge" color="error" :content="build.buildMaps.length"></v-badge>
            <v-badge style="top: 36px;" class="absolute-badge" @click="deleteBuild(index)" color="error" icon="mdi-delete"></v-badge>
            <!-- Build Info: Zeitstempel und Karten -->
            <v-card class="py-6">
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
                    <v-badge style="right: 26px;" class="absolute-badge" rounded="0" color="error" icon="mdi-fullscreen" @click="openFullscreen(map.src)"></v-badge>
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
      <v-btn icon class="close-btn absolute-badge" @click="fullscreen = false">
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-img :src="fullscreenImage" alt="Fullscreen Image"></v-img>
    </v-card>
  </v-dialog>
</template>

<script>
import {ref, reactive, defineComponent, computed} from "vue";
import axios from "axios";
import PageHeader from "@/components/PageHeader/PageHeader";
import dayjs from "dayjs";

export default defineComponent({
  name: "DrawerComponent",
  components: {
    PageHeader,
  },
  setup() {
    const file = ref(null);
    const builds = ref([]);
    const selectedMaps = ref(["Diffuse Map"]);
    const diffuseMap = reactive({
      diff: null
    });
    const settings = reactive({
      method: "2", // Standardmethode
      cropLeft: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      intensity: 50, // Standardwert für Intensität
      radius: 10, // Standardwert für Radius
      outputFormat: "PNG", // Standard-Ausgabeformat
      quality: 80, // Standardqualität (%)
      blending_intensity: 0.5, // Standardwert für Blending-Intensität
      max_shift_ratio: 0.1, // Standardwert für maximale Verschiebung
      shift_x: 0.1, // Standardwert für Verschiebung X
      shift_y: 0.1, // Standardwert für Verschiebung Y
      border_width: 10, // Standardwert für Rahmenbreite
      stone_size: 10, // Standardwert für Steingröße
      density: 0.5, // Standardwert für Dichte
      blade_length: 20, // Standardwert für Grashalmlänge
      blade_width: 1 // Standardwert für Grashalm Breite
    });

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

    const methodSettings = {
      "1": {
        intensity: {
          type: "slider",
          label: "Intensität",
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
        intensity: {
          type: "slider",
          label: "Intensität",
          min: 0,
          max: 100,
        },
        quality: {
          type: "number",
          label: "Qualität (%)",
          inputType: "number",
        },
        max_shift_ratio: {
          type: "slider",
          label: "Max. Verschiebung",
          min: 0,
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
        blade_length: {
          type: "slider",
          label: "Grashalmlänge",
          min: 0,
          max: 100,
        },
        blade_width: {
          type: "slider",
          label: "Grashalm Breite",
          min: 0,
          max: 10,
          step: 0.1,
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

    const deleteBuild = (index) => {
      builds.value.splice(index, 1);
    };

    const fullscreen = ref(false);
    const fullscreenImage = ref("");


    const openFullscreen = (src) => {
      fullscreenImage.value = src;
      fullscreen.value = true;
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

        // Neue Build mit Zeitstempel und Auswahl hinzufügen
        const newBuild = {
          maps: selectedMaps.value.join(", "), // Ausgewählte Maps
          buildMaps: [...newMaps], // Kopie der Maps (nicht den globalen array referenzieren)
          timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'), // Zeitstempel mit dayjs
          imageCount: response.data.additionalMaps.length, // Anzahl der verarbeiteten Bilder
        };

        builds.value.push(newBuild);

      } catch (error) {
        console.error("Fehler beim Verarbeiten des Bildes:", error);
      }
    };

    return {
      file,
      builds,
      selectedMaps,
      diffuseMap,
      settings,
      itemMethods,
      methodSettings,
      mapOptions,
      selectFile,
      processImage,
      selectDiffuseMap,
      fullscreen,
      fullscreenImage,
      sortOrder,
      sortOptions,
      sortedBuilds,
      toggleCollapse,
      deleteBuild,
      openFullscreen,
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
  padding: 20px;
  box-shadow: 10px 10px 200px 10px #111 inset;
}
</style>
