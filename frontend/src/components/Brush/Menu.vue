<template>
  <div v-if="visible" class="brush-context-menu" :style="menuStyle">
    <div class="menu-container">
      <nav class="side-nav">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['nav-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
        >
          <i :class="['mdi', tab.icon]" class="icon" />
        </button>
      </nav>
      <div class="content">
        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="tab-content">
          <div class="control">
            <label class="mr-2">Größe</label>
            <v-slider class="mr-6" :color="sliderColor" hide-details v-model="config.size" @click.stop="emitEvent('update:brush-settings', {key: 'size', data: config.size})" :step="1" :min="1" :max="500" />
            <span>{{ config.size }}px</span>
          </div>
          <div class="control">
            <label class="mr-2">Deckkraft</label>
            <v-slider class="mr-6" :color="sliderColor" hide-details @click.stop="emitEvent('update:brush-settings', {key: 'opacity', data: config.opacity})" v-model="config.opacity" :min="0" :max="1" step="0.01" />
            <span>{{ (config.opacity * 100).toFixed(0) }}%</span>
          </div>
          <div class="brush-list-container">
            <div class="brush-list">
              <div
                  class="brush-item"
                  v-for="(brush, index) in brushItems"
                  :key="index"
                  @click="emitEvent('update:selected-brush', brush)"
              >
                <img :src="brush?.imageUrl" class="brush-thumb" />
                <div class="brush-info">
                  <strong>{{ brush.categoryName }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="control">
            <label class="mr-2">Spacing</label>
            <v-slider class="mr-6" :color="sliderColor" hide-details @click.stop="emitEvent('update:brush-settings', {key: 'spacing', data: config.spacing})" v-model="config.spacing" step="1" :min="0" :max="100" />
            <span>{{ config.spacing }}%</span>
          </div>
          <div class="control">
            <label class="mr-2">Flow</label>
            <v-slider class="mr-6" :color="sliderColor" hide-details @click.stop="emitEvent('update:brush-settings', {key: 'flow', data: config.flow})" v-model="config.flow" :min="0" :max="1" step="0.01" />
            <span>{{ (config.flow * 100).toFixed(0) }}%</span>
          </div>
          <div class="control">
            <label class="mr-2">Jitter</label>
            <v-slider class="mr-6" :color="sliderColor" hide-details v-model="config.jitter" @click.stop="emitEvent('update:brush-settings', {key: 'jitter', data: config.jitter})" step="1" :min="0" :max="100" />
            <span>{{ config.jitter }}%</span>
          </div>
          <div class="control radial flex-wrap">
            <label style="width: 100%;">Orientierung</label>
            <div class="radial-control mr-2">
              <svg width="60" height="60" viewBox="0 0 100 100">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 Z" />
                  </marker>
                </defs>
                <line
                    :x2="50 + 40 * Math.cos(Number(angleRad)).toFixed(0)"
                    :y2="50 + 40 * Math.sin(Number(angleRad)).toFixed(0)"
                    x1="50" y1="50"
                    stroke="black" stroke-width="2" marker-end="url(#arrow)"
                />
              </svg>
            </div>
            <v-slider class="mr-6" :color="sliderColor" hide-details v-model="config.angle" min="0" max="360" @click.stop="emitEvent('update:brush-settings', {key: 'angle', data: config.angle})" />
            <span>{{ config.angle.toFixed(0) }}°</span>
          </div>
          <div class="control">
            <label class="mr-2">Random</label>
            <input type="checkbox" v-model="config.randomize" @change.stop="emitEvent('update:brush-settings', {key: 'randomize', data: config.randomize})" />
          </div>
        </div>
        <!-- Save Tab -->
        <div v-if="activeTab === 'save'" class="tab-content">
          <div class="control">
            <label class="mr-2">Preset-Name</label>
            <input type="text" v-model="presetName" placeholder="Name eingeben" />
          </div>
          <button class="btn" @click="savePreset">Speichern</button>
        </div>
        <!-- Upload Tab -->
        <div v-if="activeTab === 'upload'" class="tab-content">
          <div class="control">
            <label class="mr-2">Brush Datei</label>
            <input type="file" accept=".png,.jpg" @change="uploadBrush" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import { brushMenuModel, brushMenuProps } from '@/models/brush/menu/model';

export default defineComponent({
  name: 'BrushContextMenu',
  props: brushMenuProps,
  setup(props, { emit }) {
    const {brushItems, config, sliderColor, tabs, activeTab, blendModes, layouts, presetName, menuStyle, angleRad, savePreset, uploadBrush, emitEvent} = brushMenuModel(props, emit);

    return {
      brushItems,
      config,
      sliderColor,
      tabs,
      activeTab,
      blendModes,
      layouts,
      presetName,
      menuStyle,
      angleRad,
      savePreset,
      uploadBrush,
      emitEvent
    };
  }
});
</script>



<style lang="scss" scoped>
@import "./_Menu";
</style>
