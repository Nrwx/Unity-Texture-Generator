<template>
  <section
      v-if="mode === 'panel' || mode === 'control'"
      :id="gizmo.id"
      class="gizmo-panel"
      :class="{ compact, control: mode === 'control', hidden: state === false }"
  >
    <header>
      <div>
        <strong>Gizmo</strong>
        <small>Transform · Pivot · Anzeige</small>
      </div>
    </header>

    <div class="gizmo-segment tools">
      <button
          v-for="tool in gizmoTools"
          :key="tool.key"
          type="button"
          :class="{ active: animatorGizmo.tool === tool.key }"
          @click="setTool(tool.key)"
      >
        <v-icon size="15">{{ tool.icon }}</v-icon>
        <span>{{ tool.label }}</span>
      </button>
    </div>

    <div class="gizmo-segment axis">
      <button
          v-for="axis in axisOptions"
          :key="axis.key"
          type="button"
          :class="{ active: animatorGizmo.axis === axis.key }"
          @click="setAxis(axis.key)"
      >
        {{ axis.label }}
      </button>
    </div>

    <div class="gizmo-segment pivot">
      <button
          v-for="pivot in pivotOptions"
          :key="pivot.key"
          type="button"
          :class="{ active: animatorGizmo.pivot === pivot.key }"
          @click="setPivot(pivot.key)"
      >
        {{ pivot.label }}
      </button>
    </div>

    <div class="gizmo-action-grid">
      <button
          v-for="action in pivotActions"
          :key="action.key"
          type="button"
          @click="runPivotAction(action.key)"
      >
        {{ action.label }}
      </button>
    </div>

    <div class="gizmo-check-grid">
      <label v-for="item in visibilityOptions" :key="item.key" class="gizmo-check">
        <input
            type="checkbox"
            :checked="animatorGizmo[item.key] !== false"
            @change="setVisibility(item.key, $event.target.checked)"
        />
        <span>{{ item.label }}</span>
      </label>
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
  emits: ["select", "axis", "release", "update:component-event"],
  setup(props, { emit }) {
    return { ...gizmoModel(props, emit) };
  },
});
</script>

<style scoped lang="scss">
@import "./_Gizmo";
</style>
