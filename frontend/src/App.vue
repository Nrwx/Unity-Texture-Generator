<template>
  <v-app>
    <!-- Linke Taskbar -->
    <Taskbar @taskbar-event="taskbarEvent('left', $event)" align="left" :items="itemsLeft" />
    <DrawerNew
        v-model:taskbar-menu="windowStates.drawerLeft.value"
        :item="activeItemLeft"
        align="left"
        @component-event="componentEvent"
    />
    <v-main>
      <v-container style="position: relative;">
        <v-row justify="center" class="mt-6" style="position:relative;">
          <Image
              v-model:layers="localData.layers.value"
              @component-event="componentEvent"
          />
        </v-row>
        <Layer
            v-model:state="windowStates.layer.value"
            v-model:layers="localData.layers.value"
            v-model:selected="localData.selectedLayers.value"
            @component-event="componentEvent"
        />
      </v-container>
    </v-main>
    <!-- Rechte Taskbar -->
    <Taskbar @taskbar-event="taskbarEvent('right', $event)" align="right" :items="itemsRight" />
    <DrawerNew
        v-model:taskbar-menu="windowStates.drawerRight.value"
        :item="activeItemRight"
        align="right"
        title="Werkzeuge"
        subtitle="Weitere Optionen"
    />
  </v-app>
</template>

<script>
import Taskbar from './components/Taskbar/Taskbar.vue';
import { taskbarItemLeft, taskbarItemRight } from "@/models/taskbar/config/model";
import {localData} from "@/dataLayer/local";
import DrawerNew from "@/components/Drawer/DrawerNew";
import {computed, ref} from "vue";
import {addLayer, deleteLayer, fetchLayers, updateLayer} from "@/dataLayer/route/layer";
import {fileUpload} from "@/dataLayer/route/upload";
import Image from "@/components/Image/Image";
import Layer from "@/components/Layer/Layer";
import {windowStates} from "@/dataLayer/state";

export default {
  name: 'App',
  components: {
    Taskbar,
    DrawerNew,
    Image,
    Layer,
  },
  setup() {
    const itemsLeft = ref(taskbarItemLeft);
    const itemsRight = ref(taskbarItemRight);
    const activeItemLeft = computed(() => itemsLeft.value.find(item => item.active));
    const activeItemRight = computed(() => itemsRight.value.find(item => item.active));

    const taskbarEvent = (side, itemId) => {
      if (side === 'left') {
        itemsLeft.value.forEach((item) => {
          item.active = false;
          item.active = item.id === itemId;
        });
        if(activeItemLeft.value.event) {
          componentEvent(activeItemLeft.value.event)
        } else {
          windowStates.drawerLeft.value = true
        }
      } else if (side === 'right') {
        itemsRight.value.forEach((item) => {
          item.active = false;
          item.active = item.id === itemId;
        });
        if(activeItemRight.value.event) {
          componentEvent(activeItemRight.value.event)
        } else {
          windowStates.drawerRight.value = true
        }
      }
    };

    const componentEvent = async (event, payload) => {
      try {
        if (event === "apply-file") {
          localData.file.value = payload;
        }
        else if (event === "upload-file") {
          localData.output.value = null;
          await fileUpload()
          await fetchLayers()
        }
        else if(event === "update-dimension") {
          localData.dimension.value = payload
        }
        else if(event === "add-layer") {
          const data = {
            name: `Layer ${localData.layers.value.length + 1}`,
            width: localData.dimension.value.width,
            height: localData.dimension.value.height,
          }
          const response = await addLayer(data)
          if(response) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "update-layer") {
          const response = await updateLayer(payload)
          console.log(event, payload)
          if(response) {
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "fetch-layer") {
          const response = await fetchLayers()
          if(response) {
            localData.layers.value = response;
            console.log('LAYERS',localData.layers.value);
          }
        }
        else if(event === "delete-layer") {
          const response = await deleteLayer(payload)
          if(response) {
            localData.selectedLayers.value = [];
            await componentEvent('fetch-layer');
          }
        }
        else if(event === "layer-state") {
          windowStates.layer.value = true;
          if(windowStates.layer.value) {
            await componentEvent('fetch-layer');
          }
        }
      } catch (error) {
        console.error("Error adding layer:", error.response?.data || error.message);
      }
    };

    return {
      itemsLeft,
      itemsRight,
      activeItemLeft,
      activeItemRight,
      componentEvent,
      taskbarEvent,
      localData,
      windowStates,
    };
  },
};
</script>

<style scoped>
</style>
