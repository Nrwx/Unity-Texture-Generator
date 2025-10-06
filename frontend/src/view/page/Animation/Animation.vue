<template>
  <v-card-text>
    <div style="width: 100%;">
      <div class="timeline-container">
        <div class="timeline-controls">
          <v-btn small @click="play">Play</v-btn>
          <v-btn small @click="pause">Pause</v-btn>
          <v-btn small @click="stop">Stop</v-btn>
          <div class="time-display">t: {{ Math.round(animationData.time) }}</div>
        </div>

        <div class="timeline-bar-wrapper" ref="wrapperRef">
          <!-- SVG timeline (vector) -->
          <svg
              ref="timelineBar"
              :width="svgWidth"
              :height="timelineHeight"
              class="timeline-svg"
              @wheel.prevent="zoomTimeline"
              xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Background -->
            <rect :width="svgWidth" :height="timelineHeight" fill="#1e1e1e" rx="4" />

            <!-- ticks (grid lines + labels) -->
            <g v-for="tick in ticks" :key="tick.time">
              <line
                  :x1="tick.left"
                  :x2="tick.left"
                  y1="0"
                  :y2="tick.major ? timelineHeight : timelineHeight * 0.6"
                  stroke="#444"
                  stroke-width="1"
              />
              <text v-if="tick.major"
                    :x="tick.left + 4"
                    y="12"
                    font-size="11"
                    fill="#aaa"
              >{{ tick.time }}</text>
            </g>

            <!-- interpolated "ranges" visualization (optional) -->
            <g v-for="(seg, i) in segments" :key="'seg'+i">
              <rect
                  :x="seg.left"
                  :y="timelineHeight * 0.5"
                  :width="seg.width"
                  :height="timelineHeight * 0.3"
                  :fill="seg.color"
                  opacity="0.18"
              />
            </g>

            <!-- keyframes -->
            <g v-for="frame in sortedKeyframes" :key="frame.id" class="kf-group">
              <!-- connection / line to next (visual) -->
              <line
                  v-if="frame._next"
                  :x1="frame.left"
                  :x2="frame._next.left"
                  y1="timelineHeight*0.75"
                  y2="timelineHeight*0.75"
                  stroke="#666"
                  stroke-width="4"
                  stroke-linecap="round"
                  opacity="0.5"
              />

              <!-- keyframe diamond -->
              <g
                  :transform="`translate(${frame.left}, ${timelineHeight * 0.5})`"
                  @pointerdown.prevent="onKFPointerDown(frame, $event)"
                  style="cursor: ew-resize;"
              >
                <polygon
                    :points="diamondPoints"
                    :fill="selectedId === frame.id ? '#ffb86b' : '#f87171'"
                    stroke="#222"
                    stroke-width="1"
                />
                <!-- label -->
                <text v-if="zoomLevel > 0.8"
                      x="14"
                      y="4"
                      font-size="11"
                      fill="#ddd"
                >{{ frame.time }}</text>
              </g>
            </g>

            <!-- playhead -->
            <line
                :x1="playheadX"
                :x2="playheadX"
                y1="0"
                :y2="timelineHeight"
                stroke="#67e8f9"
                stroke-width="2"
            />
          </svg>
        </div>
      </div>
    </div>
  </v-card-text>
</template>

<script>
import { defineComponent } from "vue";
import {animationModel, animationProps} from "@/view/models/page/animation/model";

export default defineComponent({
  name: "AnimationPage",
  props: animationProps,
  setup(props, { emit }) {
    const {animationData, wrapperRef, timelineBar, timelineHeight, zoomLevel, svgWidth, ticks, sortedKeyframes, diamondPoints, playheadX, play, pause, stop, zoomTimeline, emitEvent, onKFPointerDown, selectedId, segments, recompute} = animationModel(props, emit);
    return {
      animationData,
      wrapperRef,
      timelineBar,
      timelineHeight,
      zoomLevel,
      svgWidth,
      ticks,
      sortedKeyframes,
      diamondPoints,
      playheadX,
      play,
      pause,
      stop,
      zoomTimeline,
      emitEvent,
      onKFPointerDown,
      selectedId,
      segments,
      recompute,
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Animation';
</style>