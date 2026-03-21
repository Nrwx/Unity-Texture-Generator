<template>
  <div class="timeline-container">
    <Bar
        :keys="keyframes"
        :selected-keys="selectedKeys"
        :play="playState"
        :record="recordState"
        :time="config?.time"
        :end-time="config?.endTime"
        :zoom="config?.zoomLevel?.current"
        :ease-modes="easeModes"
        :bezier="bezierState"
        :select="selectState"
        :sidebar="sidebarState"
        @update:component-event="emitEvent"
        @update:timeline-bar-start="onStop"
        @update:timeline-bar-back="onFrameBack"
        @update:timeline-bar-toggle-play="onTogglePlay"
        @update:timeline-bar-forward="onFrameForward"
        @update:timeline-bar-end="onSkipToEnd"
        @update:timeline-bar-record="onToggleRecord"
        @update:timeline-bar-input="onTimeInput"
    />

    <!-- direkt unter .timeline-controls -->
    <div class="timeline-sidebar absolute" v-if="sidebarState">
      <div class="sidebar-header d-flex w-100 mb-2">
        <strong class="text-caption">Tracks</strong>
        <button class="close ml-auto mr-0" @click="emitEvent('timeline:sidebar', !sidebarState)">✕</button>
      </div>

      <div class="layer-list menu-scrollbar overflow-y-auto" :id="scrollbars[0]">
        <Scrollbar :target="scrollbars[0]" :pulse="true" @component-event="emitEvent"/>
        <div v-for="layer in layersWithKeys" :key="layer.id" class="layer-item">
          <div class="layer-row">
            <div class="swatch" :style="{ background: trackColor(layer.id) }"></div>
            <div class="layer-name text-caption">{{ layer.name }}</div>
            <button class="toggle" @click="toggleLayerOpen(layer.id)">
              {{ isLayerOpen(layer.id) ? '▾' : '▸' }}
            </button>
          </div>

          <!-- inside .layer-tracks -->
          <div class="layer-tracks" v-if="isLayerOpen(layer.id)">
            <div v-for="sub in ['transform','rotate','scale']" :key="layer.id+'-sub-'+sub" class="track-row d-flex ml-auto mr-0">
              <div class="track-label text-truncate">{{ sub }}</div>
              <div class="track-controls">
                <input type="number"
                       :value="(config._currentByLayer && config._currentByLayer[layer.id] && (sub==='transform' ? config._currentByLayer[layer.id].matrix?.x : (sub==='rotate' ? config._currentByLayer[layer.id].matrix?.rotate : config._currentByLayer[layer.id].matrix?.a)))"
                       @input="$event => emitEvent('timeline:track-offset-input', { layerId: layer.id, trackId: sub, value: Number($event.target.value) })"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="position: relative;" :class="{ 'with-sidebar': sidebarState }">
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
            <stop offset="0%" style="stop-color:rgb(var(--v-theme-background));stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(var(--v-theme-surface));stop-opacity:1" />
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

        <!-- vor dem keyframe-group: render per-layer track rows -->
        <g v-for="(track, i) in trackRows"
           :key="'track-'+track.layer.id"
           :transform="`translate(0, ${trackTop(i)})`">

          <!-- Layer Background nur wenn irgendein Subtrack Offset hat -->
          <rect
              v-if="track.visibleSubTracks && track.visibleSubTracks.length > 0"
              :x="0"
              :y="0"
              :width="width || config?.width"
              :height="trackHeight"
              :fill="track.bg"
              opacity="0.08"
              rx="2"
          />

          <!-- Render SubTracks -->
          <g v-for="subTrack in track.visibleSubTracks" :key="subTrack.trackId">
            <!-- Filter Kurven nach SubTrack -->
            <g v-for="curve in (layerCurveSegments[track.layer.id] || []).filter(c => c.subType === subTrack.trackId)" :key="curve.id">

              <!-- Value Curve -->
              <path
                  :d="getValueGraphPath(curve, track.layer, subTrack.trackId, i)"
                  :stroke="subTrack.trackId === 'transform' ? '#4a9eff' : subTrack.trackId === 'rotate' ? '#ff9f4a' : '#4aff9f'"
                  fill="none"
                  stroke-width="2"
                  opacity="0.8"
              />

              <!-- Value Labels -->
              <g v-for="label in getCurveValueLabels(curve, i)" :key="label.x">
                <text :x="label.x" :y="label.y - 4" font-size="10" fill="white" text-anchor="middle">
                  {{ label.val }}
                </text>
              </g>
            </g>
          </g>

          <!-- 1) per-layer curves (using layerCurveSegments map) -->
          <g v-if="layerCurveSegments[track.layer.id]" >
            <g v-for="curve in layerCurveSegments[track.layer.id]" :key="curve.id" class="curve-segment">

              <!-- Value Graph -->
              <g v-if="curve.isSelected">
                <path
                    :d="getCurveValuePath(curve, i)"
                    stroke="#4a9eff"
                    fill="none"
                    stroke-width="2"
                    stroke-linecap="round"
                    opacity="0.6"
                />
                <!-- Speed Graph -->
                <path
                    :d="getCurveSpeedPath(curve, i)"
                    stroke="orange"
                    fill="none"
                    stroke-width="1.5"
                    stroke-dasharray="4,3"
                    opacity="0.7"
                />
                <!-- Live Labels -->
                <g v-for="label in getCurveValueLabels(curve, i)" :key="label.x">
                  <text :x="label.x" :y="label.y" font-size="8" fill="#fff">{{ label.val }}</text>
                </g>
              </g>

              <path
                  :d="getCurvePath(curve, i)"
                  stroke="#4a9eff"
                  :stroke-width="curve.isSelected ? 3 : 2"
                  fill="none"
                  :opacity="curve.isSelected ? 0.8 : 0.4"
                  stroke-linecap="round"
              />
              <g v-if="bezierState && curve.isSelected && !curve.isLinear">
                <template v-if="curve.showCp1 && curve.cp1">
                  <line
                      :x1="curve.start.left"
                      :y1="getCurveBaseY(i)"
                      :x2="bezierToSVGCoords(curve.cp1, i).x"
                      :y2="bezierToSVGCoords(curve.cp1, i).y"
                      stroke="#666"
                      stroke-width="1"
                      stroke-dasharray="4,4"
                      opacity="0.6"
                      style="pointer-events: none;"
                  />
                  <circle
                      :cx="bezierToSVGCoords(curve.cp1, i).x"
                      :cy="bezierToSVGCoords(curve.cp1, i).y"
                      r="5"
                      fill="#f0f"
                      stroke="#fff"
                      stroke-width="2"
                      style="cursor: grab; pointer-events: all;"
                      class="control-point"
                      @pointerdown.prevent.stop="onKFPointerDown(null, $event)"
                  />
                </template>

                <template v-if="curve.showCp2 && curve.cp2">
                  <line
                      :x1="curve.end.left"
                      :y1="getCurveBaseY(i)"
                      :x2="bezierToSVGCoords(curve.cp2, i).x"
                      :y2="bezierToSVGCoords(curve.cp2, i).y"
                      stroke="#666"
                      stroke-width="1"
                      stroke-dasharray="4,4"
                      opacity="0.6"
                      style="pointer-events: none;"
                  />
                  <circle
                      :cx="bezierToSVGCoords(curve.cp2, i).x"
                      :cy="bezierToSVGCoords(curve.cp2, i).y"
                      r="5"
                      fill="#f0f"
                      stroke="#fff"
                      stroke-width="2"
                      style="cursor: grab; pointer-events: all;"
                      class="control-point"
                      @pointerdown.prevent.stop="onKFPointerDown(null, $event)"
                  />
                </template>
              </g>
            </g>
          </g>

          <!-- 2) per-layer connection lines + diamonds (use track.keyframes) -->
          <g v-if="track.keyframes && track.keyframes.length > 0">
            <g v-for="(kf, idx) in track.keyframes" :key="'marker-'+kf.id">
              <!-- draw connection line to next keyframe (per layer) -->
              <line
                  v-if="track.keyframes[idx+1]"
                  :x1="kf.left"
                  :x2="track.keyframes[idx+1].left"
                  :y1="getCurveBaseY(i)"
                  :y2="getCurveBaseY(i)"
                  stroke="#4a9eff"
                  stroke-width="2"
                  opacity="0.35"
              />
              <!-- diamond marker -->
              <g
                  :transform="`translate(${kf.left}, ${trackHeight*0.5})`"
                  @pointerdown.prevent="onKFPointerDown({ id: kf.id, time: kf.time, layerId: track.layer.id }, $event)"
                  style="cursor: pointer;"
                  class="keyframe-marker"
              >
                <polygon
                    :points="config?.pointShape"
                    :fill="selectedKeys.includes(kf.id) ? '#4a9eff' : '#6b6b6b'"
                    :stroke="selectedKeys.includes(kf.id) ? '#69b4ff' : '#888'"
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
                >{{ kf.time }}</text>
              </g>
            </g>
          </g>
        </g>

        <!-- playHead -->
        <g class="playhead-group" style="cursor: ew-resize;">
          <!-- Playhead line -->
          <line
              :x1="playHead"
              :x2="playHead"
              y1="24"
              :y2="config?.height"
              stroke="#4a9eff"
              stroke-width="2"
              style="pointer-events: none;"
          />
          <!-- Playhead handle -->
          <g
              :transform="`translate(${playHead}, 12)`"
              @pointerdown.prevent.stop="onPlayheadPointerDown"
              style="cursor: ew-resize; pointer-events: all;"
          >
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
import Scrollbar from "@/components/Scrollbar/Scrollbar";
import Bar from "@/components/Timeline/Bar";

export default defineComponent({
  name: "TimelineComponent",
  props: timelineProps,
  components: {
    Selection,
    Scrollbar,
    Bar
  },
  setup(props, { emit }) {
    const model = timelineModel(props, emit);
    return {...model};
  },
});
</script>

<style scoped lang="scss">
@import '_Timeline';
</style>