<!-- Frame-Panel -->
<template>
  <div class="frame-panel-container d-flex align-center flex-wrap" v-if="localData.animation.value.length > 0">
    <div class="frame-panel d-flex align-center">
      <!-- Iteriere über animation.buildMaps -->
      <div
          v-for="(frame, index) in localData.animation.value[0]?.buildMaps || []"
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
</template>

<script>
import { defineComponent } from "vue";
import {frameModel, frameProps} from "@/models/frame/model";
import {localData} from "@/dataLayer/local";

export default defineComponent({
  name: "FrameComponent",
  props: frameProps,
  setup(props, { emit }) {
    const { toggleAnimation, emitEvent, isPlaying, selectDiffuseMap } = frameModel(emit);
    return {
      isPlaying,
      selectDiffuseMap,
      toggleAnimation,
      emitEvent,
      localData
    };
  },
});
</script>

<style scoped lang="scss">
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