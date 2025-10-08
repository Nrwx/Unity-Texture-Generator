<template>
  <div class="timeline-controls">
    <v-btn small @click="onPlay">Play</v-btn>
    <v-btn small @click="onPause">Pause</v-btn>
    <v-btn small @click="onStop">Stop</v-btn>
    <div class="time-display">t: {{ Math.round(config?.time) }}</div>
    <v-btn small color="green" @click="onAddKey">+</v-btn>
    <v-btn small color="red" @click="onDeleteKey">−</v-btn>
  </div>

  <Selection
      :state="state"
      :select="selectState"
      shape="rectangle"
      @update:component-event="emitEvent"
  />

  <svg
      ref="timeline"
      :id="config?.id"
      :width="width || config?.width"
      :height="config?.height"
      class="timeline-svg"
      xmlns="http://www.w3.org/2000/svg"
      @wheel.prevent="onWheel"
  >
    <!-- Background -->
    <rect :width="width || config?.width" :height="config?.height" fill="#1e1e1e" rx="4" />

    <!-- ticks -->
    <g v-for="tick in ticks" :key="tick.time">
      <line
          :x1="tick.left"
          :x2="tick.left"
          y1="0"
          :y2="tick.major ? config?.height : config?.height * 0.6"
          :stroke="config?.ticks.color"
          stroke-width="1"
      />
      <text
          v-if="tick.major"
          :x="tick.left + 4"
          y="12"
          font-size="11"
          fill="#aaa"
      >{{ tick.time }}</text>
    </g>

    <!-- segments -->
    <g v-for="(seg, i) in segments" :key="'seg'+i">
      <rect
          :x="seg.left"
          :y="config?.height * 0.5"
          :width="seg.width"
          :height="config?.height * 0.3"
          :fill="seg.color"
          opacity="0.18"
      />
    </g>

    <!-- keyframes -->
    <g v-for="frame in keyframes" :key="frame.id">
      <line
          v-if="frame._next"
          :x1="frame.left"
          :x2="frame._next.left"
          :y1="config?.height*0.75"
          :y2="config?.height*0.75"
          stroke="#666"
          stroke-width="4"
          stroke-linecap="round"
          opacity="0.5"
      />

      <g
          :transform="`translate(${frame.left}, ${config?.height * 0.5})`"
          @pointerdown.prevent="onKFPointerDown(frame, $event)"
          style="cursor: ew-resize;"
      >
        <polygon
            :points="config?.pointShape"
            :fill="config?.selectedKeyframes.includes(frame.id) ? config?.pointColor.selected :  config?.pointColor.default"
            :stroke="config?.pointColor.stroke"
            stroke-width="1"
        />
        <text
            v-if="config?.zoomLevel.current > 0.8"
            x="14"
            y="4"
            font-size="11"
            fill="#ddd"
        >{{ frame.time }}</text>
      </g>
    </g>

    <!-- playHead -->
    <line
        :x1="playHead"
        :x2="playHead"
        y1="0"
        :y2="config?.height"
        stroke="#67e8f9"
        stroke-width="2"
    />
  </svg>
</template>


<script>
import { defineComponent } from "vue";
import {timelineModel, timelineProps} from "@/models/timeline/model";
import Selection from "@/components/Selection/Selection";

export default defineComponent({
  name: "TimelineComponent",
  props: timelineProps,
  components: {
    Selection
  },
  setup(props, { emit }) {
    const { emitEvent, timeline, width, keyframes, ticks, segments, playHead, onPlay, onPause, onStop, onWheel, onAddKey, onDeleteKey, onKFPointerDown, onMultiSelect} = timelineModel(props, emit);
    return {
      timeline,
      width,
      keyframes,
      ticks,
      segments,
      playHead,
      onPlay,
      onPause,
      onStop,
      onWheel,
      onAddKey,
      onDeleteKey,
      onKFPointerDown,
      onMultiSelect,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Timeline';
</style>