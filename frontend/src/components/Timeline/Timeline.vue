<template>
  <div class="timeline-container">
    <div class="timeline-controls">
      <!-- Playback Controls Group -->
      <div class="controls-group playback-controls">
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn"
          @click="onStop"
          title="Skip to start"
        >
          <v-icon size="18">mdi-skip-previous</v-icon>
        </v-btn>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn"
          @click="onFrameBack"
          title="Previous frame"
        >
          <v-icon size="18">mdi-chevron-left</v-icon>
        </v-btn>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          :class="['control-btn', 'play-btn', { 'playing': playState }]"
          @click="onTogglePlay"
          :title="playState ? 'Pause' : 'Play'"
        >
          <v-icon size="20">{{ playState ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </v-btn>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn"
          @click="onFrameForward"
          title="Next frame"
        >
          <v-icon size="18">mdi-chevron-right</v-icon>
        </v-btn>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn"
          @click="onSkipToEnd"
          title="Skip to end"
        >
          <v-icon size="18">mdi-skip-next</v-icon>
        </v-btn>
      </div>

      <!-- Record Button -->
      <div class="controls-group record-controls">
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          :class="['control-btn', 'record-btn', { 'recording': recordState }]"
          @click="onToggleRecord"
          title="Auto keyframe recording"
        >
          <v-icon size="16">mdi-circle</v-icon>
        </v-btn>
      </div>

      <!-- Time Display with Input -->
      <div class="controls-group time-info">
        <div class="time-display">
          <span class="time-label">Frame:</span>
          <input 
            type="number" 
            class="time-input"
            :value="Math.round(config?.time)" 
            @input="onTimeInput(Number($event.target.value))"
            @keydown.enter="$event.target.blur()"
            min="0"
            :max="config?.totalTime"
          />
        </div>
        <div class="time-separator"></div>
        <div class="zoom-level">
          <v-icon size="14">mdi-magnify</v-icon>
          <span>{{ Math.round((config?.zoomLevel?.current || 1) * 100) }}%</span>
        </div>
      </div>

      <!-- Keyframe Controls -->
      <div class="controls-group keyframe-controls">
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn add-key"
          @click="onAddKey"
          title="Add keyframe"
        >
          <v-icon size="18">mdi-rhombus-outline</v-icon>
        </v-btn>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn delete-key"
          @click="onDeleteKey"
          :title="selectedKeys.length > 0 ? `Delete ${selectedKeys.length} keyframe(s)` : 'Delete keyframe at current time'"
        >
          <v-icon size="18">mdi-delete-outline</v-icon>
        </v-btn>
      </div>

      <!-- Ease Interpolation Select -->
      <div class="controls-group ease-controls" v-if="selectedKeys.length > 0">
        <v-select
          :model-value="getSelectedEase()"
          @update:model-value="onEaseChange"
          :items="[
            { title: 'Linear', value: 'linear' },
            { title: 'Ease In', value: 'ease-in' },
            { title: 'Ease Out', value: 'ease-out' },
            { title: 'Ease In-Out', value: 'ease-in-out' }
          ]"
          density="compact"
          variant="outlined"
          hide-details
          class="ease-select"
          title="Interpolation ease"
        >
          <template v-slot:prepend-inner>
            <v-icon size="16">mdi-chart-bell-curve</v-icon>
          </template>
        </v-select>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          :class="['control-btn', { 'active': bezierModeEnabled }]"
          @click="onToggleBezierMode"
          title="Toggle bezier curve editor"
          :disabled="selectedKeys.length < 2"
        >
          <v-icon size="16">mdi-vector-bezier</v-icon>
        </v-btn>
      </div>

      <!-- Selection & View Options -->
      <div class="controls-group view-options">
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          :class="['control-btn', 'select-btn', { 'active': selectState }]"
          @click="onToggleSelectMode"
          title="Selection mode"
        >
          <v-icon size="16">mdi-selection</v-icon>
        </v-btn>
        <v-btn 
          icon 
          size="small" 
          variant="flat"
          class="control-btn"
          title="Settings"
        >
          <v-icon size="16">mdi-cog-outline</v-icon>
        </v-btn>
      </div>
    </div>
    
    <div style="position: relative;">
      <Selection
          :state="selectMenu"
          :select="selectState"
          shape="rectangle"
          @update:component-event="emitEvent"
          @update:select-event="onMultiSelect"
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
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#2a2a2a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e1e1e;stop-opacity:1" />
          </linearGradient>
          <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="1" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <rect :width="width || config?.width" :height="config?.height" fill="url(#bgGradient)" rx="0" />
        <rect :width="width || config?.width" :height="config?.height" fill="none" stroke="#2f2f2f" stroke-width="1" />

        <!-- ticks -->
        <g v-for="tick in ticks" :key="tick.time">
          <line
              :x1="tick.left"
              :x2="tick.left"
              y1="0"
              :y2="tick.major ? config?.height : config?.height * 0.6"
              :stroke="tick.major ? '#4a4a4a' : '#333333'"
              :stroke-width="tick.major ? '1.5' : '1'"
              opacity="0.8"
          />
          <text
              v-if="tick.major"
              :x="tick.left + 4"
              y="14"
              font-size="10"
              font-family="system-ui, -apple-system, sans-serif"
              font-weight="500"
              fill="#888"
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
              opacity="0.2"
              rx="2"
          />
        </g>

        <!-- Bezier Curves -->
        <g v-for="curve in curveSegments" :key="curve.id" class="curve-segment">
          <template v-if="curve.isSelected || !bezierModeEnabled">
            <path
                :d="getCurvePath(curve)"
                stroke="#4a9eff"
                :stroke-width="curve.isSelected ? 3 : 2"
                fill="none"
                :opacity="curve.isSelected ? 0.8 : 0.4"
                stroke-linecap="round"
            />

            <!-- Control points and handles (only visible in bezier mode for selected non-linear curves) -->
            <g v-if="bezierModeEnabled && curve.isSelected && !curve.isLinear && curve.cp1 && curve.cp2">
              <!-- Control lines -->
              <line
                  :x1="curve.start.left"
                  :y1="config?.height * 0.75"
                  :x2="bezierToSVGCoords(curve.cp1).x"
                  :y2="bezierToSVGCoords(curve.cp1).y"
                  stroke="#666"
                  stroke-width="1"
                  stroke-dasharray="4,4"
                  opacity="0.6"
              />
              <line
                  :x1="curve.end.left"
                  :y1="config?.height * 0.75"
                  :x2="bezierToSVGCoords(curve.cp2).x"
                  :y2="bezierToSVGCoords(curve.cp2).y"
                  stroke="#666"
                  stroke-width="1"
                  stroke-dasharray="4,4"
                  opacity="0.6"
              />

              <!-- Control point 1 -->
              <circle
                  :cx="bezierToSVGCoords(curve.cp1).x"
                  :cy="bezierToSVGCoords(curve.cp1).y"
                  r="5"
                  fill="#f0f"
                  stroke="#fff"
                  stroke-width="2"
                  style="cursor: grab;"
                  class="control-point"
              />

              <!-- Control point 2 -->
              <circle
                  :cx="bezierToSVGCoords(curve.cp2).x"
                  :cy="bezierToSVGCoords(curve.cp2).y"
                  r="5"
                  fill="#f0f"
                  stroke="#fff"
                  stroke-width="2"
                  style="cursor: grab;"
                  class="control-point"
              />
            </g>
          </template>
        </g>

        <!-- keyframes -->
        <g v-for="frame in keyframes" :key="frame.id">
          <!-- Connection line between keyframes -->
          <line
              v-if="frame._next"
              :x1="frame.left"
              :x2="frame._next.left"
              :y1="config?.height*0.75"
              :y2="config?.height*0.75"
              stroke="#4a9eff"
              stroke-width="2"
              opacity="0.4"
          />

          <!-- Keyframe diamond -->
          <g
              :transform="`translate(${frame.left}, ${config?.height * 0.5})`"
              @pointerdown.prevent="onKFPointerDown(frame, $event)"
              style="cursor: pointer;"
              class="keyframe-marker"
          >
            <polygon
                :points="config?.pointShape"
                :fill="selectedKeys.includes(frame.id) ? '#4a9eff' : '#6b6b6b'"
                :stroke="selectedKeys.includes(frame.id) ? '#69b4ff' : '#888'"
                stroke-width="1.5"
                filter="url(#dropShadow)"
                class="keyframe-shape"
            />
            <text
                v-if="config?.zoomLevel.current > 0.8"
                x="14"
                y="5"
                font-size="10"
                font-family="system-ui, -apple-system, sans-serif"
                font-weight="500"
                fill="#ccc"
            >{{ frame.time }}</text>
          </g>
        </g>

        <!-- playHead -->
        <g class="playhead-group">
          <!-- Playhead line -->
          <line
              :x1="playHead"
              :x2="playHead"
              y1="24"
              :y2="config?.height"
              stroke="#4a9eff"
              stroke-width="2"
          />
          <!-- Playhead handle -->
          <g :transform="`translate(${playHead}, 12)`">
            <rect
                x="-8"
                y="0"
                width="16"
                height="16"
                fill="#4a9eff"
                rx="2"
                filter="url(#dropShadow)"
            />
            <polygon
                points="0,16 -4,20 4,20"
                fill="#4a9eff"
            />
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script>
import {defineComponent} from "vue";
import {timelineModel, timelineProps} from "@/models/timeline/model";
import Selection from "@/components/Selection/Selection";

export default defineComponent({
  name: "TimelineComponent",
  props: timelineProps,
  components: {
    Selection
  },
  setup(props, { emit }) {
    const {
      emitEvent, 
      timeline, 
      width, 
      keyframes, 
      ticks, 
      segments, 
      playHead,
      selectedKeys,
      curveSegments,
      bezierModeEnabled,
      bezierToSVGCoords,
      onPlay, 
      onPause, 
      onStop, 
      onWheel, 
      onAddKey, 
      onDeleteKey,
      onMultiSelect,
      onTogglePlay,
      onKFPointerDown,
      onFrameForward,
      onFrameBack,
      onSkipToEnd,
      onTimeInput,
      onToggleRecord,
      onToggleSelectMode,
      onEaseChange,
      onToggleBezierMode,
      getSelectedEase,
      getCurvePath
    } = timelineModel(props, emit);


    return {
      timeline,
      width,
      keyframes,
      ticks,
      segments,
      playHead,
      selectedKeys,
      curveSegments,
      bezierModeEnabled,
      bezierToSVGCoords,
      onPlay,
      onPause,
      onStop,
      onTogglePlay,
      onWheel,
      onAddKey,
      onDeleteKey,
      onMultiSelect,
      onKFPointerDown,
      onFrameForward,
      onFrameBack,
      onSkipToEnd,
      onTimeInput,
      onToggleRecord,
      onToggleSelectMode,
      onEaseChange,
      onToggleBezierMode,
      getSelectedEase,
      getCurvePath,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Timeline';
</style>