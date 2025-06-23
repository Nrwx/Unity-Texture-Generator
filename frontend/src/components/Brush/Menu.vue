// src/components/BrushContextMenu.vue
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
            <label>Größe</label>
            <input @input.stop="emitEvent('update:brush-settings', localSettings.size)" type="range" v-model.number="localSettings.size" :min="1" :max="500" />
            <span>{{ localSettings.size }}px</span>
          </div>
          <div class="control">
            <label>Spacing</label>
            <input type="range" @input.stop="emitEvent('update:brush-settings', localSettings.spacing)" v-model.number="localSettings.spacing" :min="0" :max="100" />
            <span>{{ localSettings.spacing }}%</span>
          </div>
          <div class="control">
            <label>Deckkraft</label>
            <input @input.stop="emitEvent('update:brush-settings', localSettings.opacity)" type="range" v-model.number="localSettings.opacity" :min="0" :max="1" step="0.01" />
            <span>{{ (localSettings.opacity * 100).toFixed(0) }}%</span>
          </div>
          <div class="control">
            <label>Flow</label>
            <input @input.stop="emitEvent('update:brush-settings', localSettings.flow)" type="range" v-model.number="localSettings.flow" :min="0" :max="1" step="0.01" />
            <span>{{ (localSettings.flow * 100).toFixed(0) }}%</span>
          </div>
          <div class="control">
            <label>Blendmodus</label>
            <select v-model="localSettings.blendMode">
              <option v-for="mode in blendModes" :key="mode" :value="mode">{{ mode }}</option>
            </select>
          </div>
          <div class="control">
            <label>Jitter</label>
            <input type="range" v-model.number="localSettings.jitter" @input.stop="emitEvent('update:brush-settings', localSettings.jitter)" :min="0" :max="100" />
            <span>{{ localSettings.jitter }}%</span>
          </div>
          <div class="control radial">
            <label>Orientierung</label>
            <div class="radial-control">
              <svg width="60" height="60" viewBox="0 0 100 100">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 Z" />
                  </marker>
                </defs>
                <line
                    :x2="50 + 40 * Math.cos(Number(angleRad))"
                    :y2="50 + 40 * Math.sin(Number(angleRad))"
                    x1="50" y1="50"
                    stroke="black" stroke-width="5" marker-end="url(#arrow)"
                />
              </svg>
              <input type="range" v-model.number="localSettings.angle" min="0" max="360" @input.stop="emitEvent('update:brush-settings', localSettings.angle)" />
              <span>{{ localSettings.angle }}°</span>
            </div>
          </div>
          <div class="control">
            <label>Random</label>
            <input type="checkbox" v-model="localSettings.randomize" @change.stop="emitEvent('update:brush-settings', localSettings.randomize)" />
          </div>
          <div class="control">
            <label>Layouts</label>
            <select v-model="localSettings.layout" @change="emitEvent('update:brush-settings', localSettings.layout)">
              <option v-for="l in layouts" :key="l" :value="l">{{ l }}</option>
            </select>
          </div>
        </div>
        <!-- Save Tab -->
        <div v-if="activeTab === 'save'" class="tab-content">
          <div class="control">
            <label>Preset-Name</label>
            <input type="text" v-model="presetName" placeholder="Name eingeben" />
          </div>
          <button class="btn" @click="savePreset">Speichern</button>
        </div>
        <!-- Upload Tab -->
        <div v-if="activeTab === 'upload'" class="tab-content">
          <div class="control">
            <label>Brush Datei</label>
            <input type="file" accept=".png,.jpg" @change="uploadBrush" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {defineComponent, ref, computed, reactive} from 'vue';

export default defineComponent({
  name: 'BrushContextMenu',
  props: {
    visible: Boolean,
    menuPos: { type: Object, required: true },
    settings: { type: Object, required: true }
  },
  emits: ['update:settings', 'save-preset', 'upload-brush'],
  setup(props, { emit }) {
    const presetName = ref('');
    const tabs = [
      { id: 'settings', icon: 'mdi-cog' },
      { id: 'save', icon: 'mdi-content-save' },
      { id: 'upload', icon: 'mdi-upload' }
    ];

    const activeTab = ref('settings');
    const blendModes = ['normal', 'multiply', 'screen', 'overlay'];
    const layouts = ['Default', 'Scatter', 'Line', 'Grid'];

    const localSettings = reactive(props.settings);

    const emitEvent = (event, payload) => {
      emit("update:menu-event", event, payload);
    };

    const angleRad = computed(() => (localSettings.angle - 90) * (Math.PI / 180));

    const menuStyle = computed(() => ({
      top: `${props.menuPos.y}px`,
      left: `${props.menuPos.x}px`,
      maxWidth: '380px'
    }));

    const savePreset = () => {
      emitEvent('save-preset', {name: presetName.value, data: localSettings});
      presetName.value = '';
    };

    const uploadBrush = (e) => {
      const file = e.target.files[0];
      if (file) emitEvent('upload-brush', file);
    };

    return {
      tabs,
      activeTab,
      blendModes,
      layouts,
      presetName,
      localSettings,
      menuStyle,
      angleRad,
      savePreset,
      uploadBrush,
      emitEvent
    };
  }
});
</script>



<style scoped lang="scss">
.brush-context-menu { position: absolute; background: #fff; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; }
.menu-container { display: flex; width: 100%; }
.side-nav { display: flex; flex-direction: column; background: #f7f7f7; padding: 8px; }
.nav-button { background: transparent; border: none; padding: 12px; margin-bottom: 4px; cursor: pointer; border-radius: 4px; }
.nav-button.active, .nav-button:hover { background: #e0e0e0; }
.icon { font-size: 20px; }
.content { flex: 1; padding: 12px; }
.tab-content { display: flex; flex-direction: column; gap: 12px; }
.control { display: flex; align-items: center; justify-content: space-between; }
.radial-control { display: flex; align-items: center; gap: 8px; }
.btn { align-self: flex-end; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #007aff; color: #fff; }
</style>
