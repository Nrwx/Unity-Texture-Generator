<template>
  <div class="mem-view-head">
    <div>
      <strong>Light</strong>
      <span>Scene-Licht, Surface-Highlights und Normal/Bump-Reaktion fuer Layer3D.</span>
    </div>
  </div>

  <div class="mem-geometry-layout">
    <section class="mem-geometry-card">
      <header>
        <strong>Scene Light</strong>
        <small>Globale Lichtquelle fuer die Canvas-Preview.</small>
      </header>

      <label
          class="mem-toggle-card"
          :class="{ active: state.light.enabled }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-lightbulb-on-outline</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Enabled</strong>
          <small>Aktiviert gerichtetes Licht in Layer3D.</small>
        </span>

        <v-switch
            :model-value="state.light.enabled"
            hide-details
            @update:model-value="setBooleanValue('enabled', $event)"
        />
      </label>

      <v-select
          :model-value="state.light.lightType"
          :items="lightTypeOptions"
          label="Light Type"
          density="compact"
          hide-details
          @update:model-value="setLightValue('lightType', $event)"
      />

      <div class="mem-color-line">
        <input
            :value="state.light.color"
            type="color"
            @input="setLightValue('color', $event.target.value)"
        />

        <span>Direct {{ state.light.color }}</span>
      </div>

      <div class="mem-color-line">
        <input
            :value="state.light.environment_color"
            type="color"
            @input="setLightValue('environment_color', $event.target.value)"
        />

        <span>Reflection {{ state.light.environment_color }}</span>
      </div>

      <div class="mem-color-line">
        <input
            :value="state.light.ambient_color"
            type="color"
            @input="setLightValue('ambient_color', $event.target.value)"
        />

        <span>Ambient {{ state.light.ambient_color }}</span>
      </div>

      <label
          class="mem-toggle-card"
          :class="{ active: state.light.castShadow }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-box-shadow</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Cast Shadow</strong>
          <small>Shadow-Flag fuer spaetere Shadow-Maps.</small>
        </span>

        <v-switch
            :model-value="state.light.castShadow"
            hide-details
            @update:model-value="setBooleanValue('castShadow', $event)"
        />
      </label>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Energy</strong>
        <small>Direktes Licht, Umgebung und weiche Flaechen.</small>
      </header>

      <div class="mem-control-card">
        <header>
          <strong>Intensity</strong>
          <small>{{ state.light.intensity }}</small>
        </header>

        <v-slider
            :model-value="state.light.intensity"
            :min="0"
            :max="2"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('intensity', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Ambient</strong>
          <small>{{ state.light.ambient }}</small>
        </header>

        <v-slider
            :model-value="state.light.ambient"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('ambient', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Softness</strong>
          <small>{{ state.light.softness }}</small>
        </header>

        <v-slider
            :model-value="state.light.softness"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('softness', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Temperature</strong>
          <small>{{ state.light.temperature }}K</small>
        </header>

        <v-slider
            :model-value="state.light.temperature"
            :min="1000"
            :max="20000"
            :step="50"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('temperature', $event)"
        />
      </div>
    </section>

    <section class="mem-geometry-card wide">
      <header>
        <strong>Transform</strong>
        <small>Position und Richtung der Lichtquelle relativ zum Material.</small>
      </header>

      <div class="mem-geometry-vector">
        <v-text-field
            v-if="isPositionLight"
            :model-value="state.light.position_x"
            label="PX"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setNumberValue('position_x', $event)"
        />

        <v-text-field
            v-if="isPositionLight"
            :model-value="state.light.position_y"
            label="PY"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setNumberValue('position_y', $event)"
        />

        <v-text-field
            v-if="isPositionLight"
            :model-value="state.light.position_z"
            label="PZ"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setNumberValue('position_z', $event)"
        />

        <v-text-field
            v-if="isDirectionalLight"
            :model-value="state.light.direction_x"
            label="DX"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setNumberValue('direction_x', $event)"
        />

        <v-text-field
            v-if="isDirectionalLight"
            :model-value="state.light.direction_y"
            label="DY"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setNumberValue('direction_y', $event)"
        />

        <v-text-field
            v-if="isDirectionalLight"
            :model-value="state.light.direction_z"
            label="DZ"
            type="number"
            density="compact"
            hide-details
            @update:model-value="setNumberValue('direction_z', $event)"
        />
      </div>
    </section>

    <section class="mem-geometry-card">
      <header>
        <strong>Falloff</strong>
        <small>Radius, Reichweite und Spot-Kegel.</small>
      </header>

      <div
          v-if="isFalloffLight"
          class="mem-control-card"
      >
        <header>
          <strong>Range</strong>
          <small>{{ state.light.range }}</small>
        </header>

        <v-slider
            :model-value="state.light.range"
            :min="0.001"
            :max="100"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('range', $event)"
        />
      </div>

      <div
          v-if="hasRadius"
          class="mem-control-card"
      >
        <header>
          <strong>{{ radiusLabel }}</strong>
          <small>{{ state.light.radius }}</small>
        </header>

        <v-slider
            :model-value="state.light.radius"
            :min="0"
            :max="10"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('radius', $event)"
        />
      </div>

      <div
          v-if="isFalloffLight"
          class="mem-control-card"
      >
        <header>
          <strong>Decay</strong>
          <small>{{ state.light.decay }}</small>
        </header>

        <v-slider
            :model-value="state.light.decay"
            :min="0"
            :max="4"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('decay', $event)"
        />
      </div>

      <div
          v-if="isSpotLight"
          class="mem-control-card"
      >
        <header>
          <strong>Inner Cone</strong>
          <small>{{ state.light.innerCone }}</small>
        </header>

        <v-slider
            :model-value="state.light.innerCone"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('innerCone', $event)"
        />
      </div>

      <div
          v-if="isSpotLight"
          class="mem-control-card"
      >
        <header>
          <strong>Outer Cone</strong>
          <small>{{ state.light.outerCone }}</small>
        </header>

        <v-slider
            :model-value="state.light.outerCone"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setNumberValue('outerCone', $event)"
        />
      </div>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {
    lightEmits,
    lightModel,
    lightProps,
} from "@/view/models/page/material/light/model";

export default defineComponent({
    name: "LightEditor",
    props: lightProps,
    emits: lightEmits,
    setup(props, { emit }) {
        return {
            ...lightModel(props, emit),
        };
    },
});
</script>

<style scoped lang="scss">
@use "./_Light";
</style>
