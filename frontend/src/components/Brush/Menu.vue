<template>
  <div v-if="visible" class="brush-context-menu absolute overflow-hidden" :style="menuStyle">
    <div class="menu-container w-100 d-flex">
      <nav class="side-nav pa-1 d-flex flex-column">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            class="pa-2 mb-1 cursor-pointer"
            :class="['nav-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
        >
          <i :class="['mdi', tab.icon]" class="icon" />
        </button>
      </nav>
      <div class="content flex-1-1 pa-2">
        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="tab-content d-flex flex-column ga-2">
          <div class="brush-list-container overflow-y-auto">
            <div class="brush-list d-flex flex-wrap ga-2">
              <div
                  class="brush-item d-flex flex-wrap align-center justify-center flex-grow-1 ga-2 cursor-pointer pa-1"
                  v-for="(brush, index) in brushItems"
                  :key="index"
                  @click="emitEvent('update:selected-brush', brush)"
              >
                <img :alt="brush.categoryName" :src="brush?.thumbnail || brush?.imageUrl" class="brush-thumb" />
                <div class="brush-info d-flex overflow-hidden">
                  <strong class="text-truncate">{{ brush.categoryName }}</strong>
                </div>
              </div>
            </div>
          </div>
          <MenuItem
              :items="settingsItems"
              v-model="config"
              @update:brush-menu-item="emitEvent('update:brush-settings', $event)"
          />
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
import MenuItem from "@/components/Brush/MenuItem";

export default defineComponent({
  name: 'BrushContextMenu',
  components: {MenuItem},
  props: brushMenuProps,
  setup(props, { emit }) {
    const {settingsItems, brushItems, config, sliderColor, tabs, activeTab, blendModes, presetName, menuStyle, angleRad, savePreset, uploadBrush, emitEvent} = brushMenuModel(props, emit);

    return {
      settingsItems,
      brushItems,
      config,
      sliderColor,
      tabs,
      activeTab,
      blendModes,
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
@use "./_Menu";
</style>
