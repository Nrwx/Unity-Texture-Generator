<template>
  <section
      v-if="mode === 'panel' || mode === 'control'"
      :id="gizmo.id"
      class="gizmo-panel"
      :class="{ compact, control: mode === 'control', hidden: state === false }"
  >
    <header class="gizmo-head">
      <div>
        <strong>Gizmo</strong>
        <small>{{ animatorGizmo.tool }} · {{ animatorGizmo.axis }} · {{ animatorGizmo.pivot }}</small>
      </div>
      <span class="gizmo-led" />
    </header>

    <div class="gizmo-strip tools" aria-label="Gizmo tools">
      <button
          v-for="tool in gizmoTools"
          :key="tool.key"
          type="button"
          :title="tool.label"
          :aria-label="tool.label"
          :class="{ active: animatorGizmo.tool === tool.key }"
          @click="setTool(tool.key)"
      >
        <v-icon size="16">{{ tool.icon }}</v-icon>
      </button>
    </div>

    <div class="gizmo-strip axis" aria-label="Gizmo axis">
      <button
          v-for="axis in axisOptions"
          :key="axis.key"
          type="button"
          :title="axis.label"
          :aria-label="axis.label"
          :class="['axis-' + axis.key, { active: animatorGizmo.axis === axis.key }]"
          @click="setAxis(axis.key)"
      >
        <span>{{ axis.label }}</span>
      </button>
    </div>

    <div class="gizmo-strip pivot" aria-label="Pivot mode">
      <button
          v-for="pivot in pivotOptions"
          :key="pivot.key"
          type="button"
          :title="pivot.label"
          :aria-label="pivot.label"
          :class="{ active: animatorGizmo.pivot === pivot.key }"
          @click="setPivot(pivot.key)"
      >
        <v-icon size="15">{{ pivot.icon }}</v-icon>
      </button>
    </div>

    <div class="gizmo-actions">
      <button
          v-for="action in pivotActions"
          :key="action.key"
          type="button"
          :title="action.label"
          @click="runPivotAction(action.key)"
      >
        <v-icon size="14">{{ action.icon }}</v-icon>
        <span>{{ action.label }}</span>
      </button>
    </div>

    <div class="gizmo-visibility">
      <button
          v-for="item in visibilityOptions"
          :key="item.key"
          type="button"
          :title="item.label"
          :aria-label="item.label"
          :class="{ active: animatorGizmo[item.key] !== false }"
          @click="toggleVisibility(item.key)"
      >
        <v-icon size="14">{{ item.icon }}</v-icon>
      </button>
    </div>
  </section>

  <div v-else :id="gizmo.id" class="gizmo-object legacy-dom-gizmo" aria-hidden="true" />
</template>

<script>
import { defineComponent } from "vue";
import { gizmoModel, gizmoProps } from "@/models/canvas/gizmo/model";

export default defineComponent({
  name: "GizmoComponent",
  props: gizmoProps,
  setup(props, { emit }) {
    return { ...gizmoModel(props, emit) };
  },
});
</script>

<style scoped lang="scss">
@import "./_Gizmo";
</style>
