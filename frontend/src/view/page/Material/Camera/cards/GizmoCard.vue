<template>
  <section class="engine-camera-card engine-camera-card__section">
    <header>
      <strong>Gizmo</strong>
      <small>{{ gizmo.tool }} · {{ gizmo.axis }} · {{ gizmo.pivot }}</small>
    </header>

    <div class="engine-camera-card__strip tools">
      <button v-for="tool in tools" :key="tool.key" type="button" :class="{ active: gizmo.tool === tool.key }" @click="$emit('tool', tool.key)">
        <v-icon size="14">{{ tool.icon }}</v-icon>
      </button>
    </div>

    <div class="engine-camera-card__strip axis">
      <button v-for="axis in axes" :key="axis.key" type="button" :class="['axis-' + axis.key, { active: gizmo.axis === axis.key }]" @click="$emit('axis', axis.key)">
        {{ axis.label }}
      </button>
    </div>

    <div class="engine-camera-card__strip pivot">
      <button v-for="pivot in pivots" :key="pivot.key" type="button" :class="{ active: gizmo.pivot === pivot.key }" @click="$emit('pivot', pivot.key)">
        <v-icon size="14">{{ pivot.icon }}</v-icon>
      </button>
    </div>
  </section>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "GizmoCard",
  props: {
    gizmo: { type: Object, required: true },
    tools: { type: Array, required: true },
    axes: { type: Array, required: true },
    pivots: { type: Array, required: true },
  },
  emits: ["tool", "axis", "pivot"],
});
</script>
