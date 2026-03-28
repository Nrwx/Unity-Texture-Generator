<template>
  <div v-if="state" class="mini-wrap">
    <div class="mini">
      <!-- CONTROLS -->
      <div class="controls">

        <v-btn icon size="small" variant="text" @click="onFrameBack">
          <v-icon>mdi-skip-previous</v-icon>
        </v-btn>

        <v-btn
            icon
            size="small"
            class="play-btn"
            @click="playState ? onPause() : onPlay()"
        >
          <v-icon>
            {{ playState ? "mdi-pause" : "mdi-play" }}
          </v-icon>
        </v-btn>

        <v-btn icon size="small" variant="text" @click="onFrameForward">
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>

        <v-btn icon size="small" variant="text" @click="onStop">
          <v-icon>mdi-stop</v-icon>
        </v-btn>

      </div>

      <!-- TIME -->
      <div class="time">
        <div class="frames">{{ formatted.frames }}</div>
        <div class="seconds">{{ formatted.seconds }}</div>
      </div>

      <!-- SPEED -->
      <v-btn
          size="x-small"
          variant="tonal"
          class="speed"
          @click="toggleSpeed"
      >
        {{ speed }}x
      </v-btn>

      <!-- CLOSE -->
      <v-btn
          icon
          size="x-small"
          variant="text"
          class="close-btn"
          @click="onClose"
      >
        <v-icon size="16">mdi-close</v-icon>
      </v-btn>


    </div>
  </div>
</template>


<script>
import { defineComponent } from "vue";
import {miniTimelineModel, miniTimelineProps} from "@/models/timeline/mini/model";

export default defineComponent({
  name: "MiniTimelineComponent",
  props: miniTimelineProps,
  setup(props, { emit }) {
    const model = miniTimelineModel(props, emit);
    return {
      ...model
    };
  },
});
</script>

<style scoped>
.mini-wrap {
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
}

/* MAIN */
.mini {
  position: relative;

  display: flex;
  align-items: center;
  gap: 12px;

  padding: 10px 14px;
  border-radius: 14px;

  background: rgba(30, 30, 34, 0.7);
  backdrop-filter: blur(18px);

  border: 1px solid rgba(255,255,255,0.06);

  box-shadow:
      0 10px 30px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.05);
}

/* CONTROLS */
.controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* PLAY BUTTON (Highlight) */
.play-btn {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: white;
}

/* TIME */
.time {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 70px;
  font-family: monospace;
}

.frames {
  font-size: 13px;
  font-weight: 600;
}

.seconds {
  font-size: 11px;
  opacity: 0.6;
}

/* SPEED */
.speed {
  font-size: 11px;
}

/* CLOSE BUTTON */
.close-btn {
  opacity: 0.5;
}

.close-btn:hover {
  opacity: 1;
}
</style>