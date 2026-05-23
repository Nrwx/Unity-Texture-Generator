<template>
  <div class="mem-view-head">
    <div>
      <strong>Physics</strong>
      <span>Kollision, Körpertyp, Masse, Reibung und Dämpfung.</span>
    </div>
  </div>

  <div class="mem-physics-layout">
    <section class="mem-physics-card">
      <header>
        <strong>Physics State</strong>
        <small>Aktiviert physikalische Metadaten für das Material-Objekt.</small>
      </header>

      <label
          class="mem-toggle-card"
          :class="{ active: physics.enabled }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-atom</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Physics Enabled</strong>
          <small>Schaltet Physics-Daten für Export oder spätere Simulation frei.</small>
        </span>

        <v-switch
            :model-value="physics.enabled"
            hide-details
            @update:model-value="setPhysicsBoolean('enabled', $event)"
        />
      </label>

      <label
          class="mem-toggle-card"
          :class="{ active: physics.rigid_body }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-cube-scan</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Rigid Body</strong>
          <small>Markiert das Objekt als physikalischen Körper.</small>
        </span>

        <v-switch
            :model-value="physics.rigid_body"
            hide-details
            @update:model-value="setPhysicsBoolean('rigid_body', $event)"
        />
      </label>

      <v-select
          :model-value="physics.body_type"
          :items="BODY_TYPE_OPTIONS"
          label="Body Type"
          density="compact"
          hide-details
          @update:model-value="setPhysicsValue('body_type', $event)"
      />
    </section>

    <section class="mem-physics-card">
      <header>
        <strong>Collision</strong>
        <small>Kollisionsform und Kontaktabstand.</small>
      </header>

      <label
          class="mem-toggle-card"
          :class="{ active: physics.collision_enabled }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-vector-square</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Collision Enabled</strong>
          <small>Aktiviert Kollisionsdaten für Renderer, Export oder Engine.</small>
        </span>

        <v-switch
            :model-value="physics.collision_enabled"
            hide-details
            @update:model-value="setPhysicsBoolean('collision_enabled', $event)"
        />
      </label>

      <v-select
          :model-value="physics.collision_shape"
          :items="COLLISION_SHAPE_OPTIONS"
          label="Collision Shape"
          density="compact"
          hide-details
          @update:model-value="setPhysicsValue('collision_shape', $event)"
      />

      <div class="mem-control-card">
        <header>
          <strong>Collision Margin</strong>
          <small>{{ physics.collision_margin }}</small>
        </header>

        <v-slider
            :model-value="physics.collision_margin"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('collision_margin', $event)"
        />
      </div>

      <label
          class="mem-toggle-card"
          :class="{ active: physics.continuous_collision }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-ray-start-arrow</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Continuous Collision</strong>
          <small>Für schnelle Körper gegen Tunneling.</small>
        </span>

        <v-switch
            :model-value="physics.continuous_collision"
            hide-details
            @update:model-value="setPhysicsBoolean('continuous_collision', $event)"
        />
      </label>
    </section>

    <section class="mem-physics-card">
      <header>
        <strong>Material Response</strong>
        <small>Masse, Reibung und Rückprall.</small>
      </header>

      <div class="mem-control-card">
        <header>
          <strong>Mass</strong>
          <small>{{ physics.mass }}</small>
        </header>

        <v-slider
            :model-value="physics.mass"
            :min="0"
            :max="100"
            :step="0.01"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('mass', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Friction</strong>
          <small>{{ physics.friction }}</small>
        </header>

        <v-slider
            :model-value="physics.friction"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('friction', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Restitution</strong>
          <small>{{ physics.restitution }}</small>
        </header>

        <v-slider
            :model-value="physics.restitution"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('restitution', $event)"
        />
      </div>
    </section>

    <section class="mem-physics-card">
      <header>
        <strong>Damping & Gravity</strong>
        <small>Bewegungsdämpfung und Gravitationseinfluss.</small>
      </header>

      <div class="mem-control-card">
        <header>
          <strong>Linear Damping</strong>
          <small>{{ physics.damping_linear }}</small>
        </header>

        <v-slider
            :model-value="physics.damping_linear"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('damping_linear', $event)"
        />
      </div>

      <div class="mem-control-card">
        <header>
          <strong>Angular Damping</strong>
          <small>{{ physics.damping_angular }}</small>
        </header>

        <v-slider
            :model-value="physics.damping_angular"
            :min="0"
            :max="1"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('damping_angular', $event)"
        />
      </div>

      <label
          class="mem-toggle-card"
          :class="{ active: physics.gravity_enabled }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-arrow-down-bold</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Gravity</strong>
          <small>Objekt reagiert auf Gravitation.</small>
        </span>

        <v-switch
            :model-value="physics.gravity_enabled"
            hide-details
            @update:model-value="setPhysicsBoolean('gravity_enabled', $event)"
        />
      </label>

      <div class="mem-control-card">
        <header>
          <strong>Gravity Scale</strong>
          <small>{{ physics.gravity_scale }}</small>
        </header>

        <v-slider
            :model-value="physics.gravity_scale"
            :min="-4"
            :max="4"
            :step="0.001"
            thumb-label
            hide-details
            @update:model-value="setPhysicsNumber('gravity_scale', $event)"
        />
      </div>

      <label
          class="mem-toggle-card"
          :class="{ active: physics.sleep_enabled }"
      >
        <span class="mem-toggle-icon">
          <v-icon>mdi-sleep</v-icon>
        </span>

        <span class="mem-toggle-text">
          <strong>Sleep Enabled</strong>
          <small>Erlaubt Energiesparen bei ruhenden Objekten.</small>
        </span>

        <v-switch
            :model-value="physics.sleep_enabled"
            hide-details
            @update:model-value="setPhysicsBoolean('sleep_enabled', $event)"
        />
      </label>
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {physicsModel, physicsModelProps,} from "@/view/models/page/material/physics/model";

export default defineComponent({
  name: "PhysicsEditor",
  props: physicsModelProps,
  setup(props, { emit }) {
    const model = physicsModel(props, emit);
    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Physics";
</style>