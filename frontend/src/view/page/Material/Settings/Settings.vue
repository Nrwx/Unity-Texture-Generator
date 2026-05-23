<template>
  <div class="mem-view-head">
    <div>
      <strong>Settings</strong>
      <span>Renderer, Blender Export und Preview-Einstellungen.</span>
    </div>
  </div>

  <div class="mem-section">
    <div class="mem-select-card">
      <strong>Preview Renderer</strong>

      <v-select
          :model-value="settings.render_backend"
          :items="RENDER_BACKEND_OPTIONS"
          item-title="title"
          item-value="value"
          label="Renderer"
          density="compact"
          hide-details
          @update:model-value="setSetting('render_backend', $event)"
      />
    </div>

    <div class="mem-select-card">
      <strong>Texture Sampling</strong>

      <v-select
          :model-value="settings.texture_size"
          :items="TEXTURE_SIZE_OPTIONS"
          label="Texture Size"
          density="compact"
          hide-details
          @update:model-value="setTextureSize"
      >
        <template #selection="{ item }">
          {{ item.raw === "Original" ? "Original" : `${item.raw}px` }}
        </template>

        <template #item="{ props, item }">
          <v-list-item
              v-bind="props"
              :title="item.raw === 'Original' ? 'Original' : `${item.raw}px`"
          />
        </template>
      </v-select>
    </div>

    <div class="mem-control-card">
      <header>
        <strong>Cube Size</strong>
        <small>{{ settings.cube_size }}</small>
      </header>

      <v-slider
          :model-value="settings.cube_size"
          :min="64"
          :max="1024"
          :step="1"
          thumb-label
          hide-details
          @update:model-value="setNumberSetting('cube_size', $event)"
      />
    </div>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.rotate_preview }"
    >
      <span class="mem-toggle-icon">
        <v-icon>mdi-axis-z-rotate-clockwise</v-icon>
      </span>

      <span class="mem-toggle-text">
        <strong>Idle Rotation</strong>
        <small>Der Cube rotiert sanft in der Preview.</small>
      </span>

      <v-switch
          :model-value="settings.rotate_preview"
          hide-details
          @update:model-value="setBooleanSetting('rotate_preview', $event)"
      />
    </label>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.wireframe_preview }"
    >
  <span class="mem-toggle-icon">
    <v-icon>mdi-vector-polyline</v-icon>
  </span>

      <span class="mem-toggle-text">
    <strong>Wireframe Render</strong>
    <small>Zeigt Mesh-Kanten in der 3D-Vorschau.</small>
  </span>

      <v-switch
          :model-value="settings.wireframe_preview"
          hide-details
          @update:model-value="setBooleanSetting('wireframe_preview', $event)"
      />
    </label>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.faces_preview }"
    >
  <span class="mem-toggle-icon">
    <v-icon>mdi-grid-large</v-icon>
  </span>

      <span class="mem-toggle-text">
    <strong>Show Faces</strong>
    <small>Hebt sichtbare Flächen in der Preview hervor.</small>
  </span>

      <v-switch
          :model-value="settings.faces_preview"
          hide-details
          @update:model-value="setBooleanSetting('faces_preview', $event)"
      />
    </label>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.vertices_preview }"
    >
  <span class="mem-toggle-icon">
    <v-icon>mdi-vector-point</v-icon>
  </span>

      <span class="mem-toggle-text">
    <strong>Show Vertices</strong>
    <small>Markiert Eckpunkte des Preview-Meshes.</small>
  </span>

      <v-switch
          :model-value="settings.vertices_preview"
          hide-details
          @update:model-value="setBooleanSetting('vertices_preview', $event)"
      />
    </label>

    <div class="mem-select-card">
      <strong>Blend Mode</strong>

      <v-select
          :model-value="settings.blend_mode"
          :items="BLEND_MODE_OPTIONS"
          density="compact"
          hide-details
          @update:model-value="setSetting('blend_mode', $event)"
      />
    </div>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.backface_culling }"
    >
      <span class="mem-toggle-icon">
        <v-icon>mdi-cube-off-outline</v-icon>
      </span>

      <span class="mem-toggle-text">
        <strong>Backface Culling</strong>
        <small>Rendert Rueckseiten nur, wenn Show Backface aktiv ist.</small>
      </span>

      <v-switch
          :model-value="settings.backface_culling"
          hide-details
          @update:model-value="setBooleanSetting('backface_culling', $event)"
      />
    </label>

    <div
        v-if="settings.blend_mode === 'CLIP'"
        class="mem-control-card"
    >
      <header>
        <strong>Clip Threshold</strong>
        <small>{{ settings.alpha_clip }}</small>
      </header>

      <v-slider
          :model-value="settings.alpha_clip"
          :min="0"
          :max="1"
          :step="0.01"
          thumb-label
          hide-details
          @update:model-value="setNumberSetting('alpha_clip', $event)"
      />
    </div>

    <div class="mem-select-card">
      <strong>Shadow Method</strong>

      <v-select
          :model-value="settings.shadow_method"
          :items="SHADOW_METHOD_OPTIONS"
          density="compact"
          hide-details
          @update:model-value="setSetting('shadow_method', $event)"
      />
    </div>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.show_backface }"
    >
      <span class="mem-toggle-icon">
        <v-icon>mdi-flip-to-back</v-icon>
      </span>

      <span class="mem-toggle-text">
        <strong>Show Backface</strong>
        <small>Transparente Rueckseiten bleiben sichtbar.</small>
      </span>

      <v-switch
          :model-value="settings.show_backface"
          hide-details
          @update:model-value="setBooleanSetting('show_backface', $event)"
      />
    </label>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.screen_space_refraction }"
    >
      <span class="mem-toggle-icon">
        <v-icon>mdi-glass-fragile</v-icon>
      </span>

      <span class="mem-toggle-text">
        <strong>Screen Space Refraction</strong>
        <small>Erlaubt Transmission/IOR als Glas-Refraction in WebGL2.</small>
      </span>

      <v-switch
          :model-value="settings.screen_space_refraction"
          hide-details
          @update:model-value="setBooleanSetting('screen_space_refraction', $event)"
      />
    </label>

    <div class="mem-control-card">
      <header>
        <strong>Refraction Depth</strong>
        <small>{{ settings.refraction_depth }} m</small>
      </header>

      <v-slider
          :model-value="settings.refraction_depth"
          :min="0"
          :max="10"
          :step="0.001"
          thumb-label
          hide-details
          @update:model-value="setNumberSetting('refraction_depth', $event)"
      />
    </div>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.subsurface_translucency }"
    >
      <span class="mem-toggle-icon">
        <v-icon>mdi-circle-opacity</v-icon>
      </span>

      <span class="mem-toggle-text">
        <strong>Subsurface Translucency</strong>
        <small>Laesst Subsurface staerker durch Gegenlicht reagieren.</small>
      </span>

      <v-switch
          :model-value="settings.subsurface_translucency"
          hide-details
          @update:model-value="setBooleanSetting('subsurface_translucency', $event)"
      />
    </label>

    <label
        class="mem-toggle-card"
        :class="{ active: settings.use_nodes }"
    >
      <span class="mem-toggle-icon">
        <v-icon>mdi-nodejs</v-icon>
      </span>

      <span class="mem-toggle-text">
        <strong>Use Blender Nodes</strong>
        <small>Exportiert das Material als Node-Material.</small>
      </span>

      <v-switch
          :model-value="settings.use_nodes"
          hide-details
          @update:model-value="setBooleanSetting('use_nodes', $event)"
      />
    </label>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {settingsModel, settingsProps} from "@/view/models/page/material/settings/model";

export default defineComponent({
    name: "SettingsEditor",
    props: settingsProps,
    setup(props, { emit }) {
        return {
            ...settingsModel(props, emit),
        };
    },
});
</script>

<style scoped lang="scss">
@use "./_Settings";
</style>
