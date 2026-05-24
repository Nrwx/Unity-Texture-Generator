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
        <small>Animator Werkzeug</small>
      </div>
    </header>

    <div class="gizmo-segment">
      <button
          v-for="tool in gizmoTools"
          :key="tool.key"
          type="button"
          :class="{ active: animatorGizmo.tool === tool.key }"
          @click="animatorGizmo.tool = tool.key"
      >
        <v-icon size="15">{{ tool.icon }}</v-icon>
        <span>{{ tool.label }}</span>
      </button>
    </div>

    <div class="gizmo-segment">
      <button
          v-for="pivot in pivotOptions"
          :key="pivot.key"
          type="button"
          :class="{ active: animatorGizmo.pivot === pivot.key }"
          @click="animatorGizmo.pivot = pivot.key"
      >
        {{ pivot.label }}
      </button>
    </div>
  </section>

  <div
      v-else
      :id="gizmo.id"
      class="gizmo-object"
      :class="[
      animatorGizmo.tool,
      {
        active,
        selected,
        compact,
        disabled,
      },
    ]"
      @pointerdown.prevent="emitSelect($event)"
  >
    <span
        v-if="active && animatorGizmo.pivot === 'object'"
        class="gizmo-object-pivot"
        aria-hidden="true"
    />

    <template v-if="animatorGizmo.tool !== 'orbit' || active">
      <button
          type="button"
          class="gizmo-object-core"
          :class="{ active: animatorGizmo.axis === 'free' }"
          :disabled="disabled"
          data-gizmo-handle="true"
          data-gizmo-axis="free"
          data-gizmo-tool="translate"
          @pointerdown.prevent="emitAxis('free', 'translate', $event)"
          @pointerup.prevent="emitRelease($event)"
      >
        <span />
      </button>
    </template>

    <template v-if="animatorGizmo.tool === 'orbit' || animatorGizmo.tool === 'translate'">
      <button
          v-for="axis in axisOptions"
          :key="`translate-${axis.key}`"
          type="button"
          class="gizmo-object-axis"
          :class="[
          axis.key,
          'translate',
          {
            active: animatorGizmo.tool === 'translate' && animatorGizmo.axis === axis.key,
          },
        ]"
          :disabled="disabled"
          data-gizmo-handle="true"
          :data-gizmo-axis="axis.key"
          data-gizmo-tool="translate"
          @pointerdown.prevent="emitAxis(axis.key, 'translate', $event)"
          @pointerup.prevent="emitRelease($event)"
      >
        <i />
        <span>{{ axis.label }}</span>
      </button>
    </template>

    <template v-if="animatorGizmo.tool === 'orbit' || animatorGizmo.tool === 'scale'">
      <button
          v-for="axis in axisOptions"
          :key="`scale-${axis.key}`"
          type="button"
          class="gizmo-object-axis scale-handle"
          :class="[
          axis.key,
          'scale',
          {
            active: animatorGizmo.tool === 'scale' && animatorGizmo.axis === axis.key,
          },
        ]"
          :disabled="disabled"
          data-gizmo-handle="true"
          :data-gizmo-axis="axis.key"
          data-gizmo-tool="scale"
          @pointerdown.prevent="emitAxis(axis.key, 'scale', $event)"
          @pointerup.prevent="emitRelease($event)"
      >
        <i />
        <span>{{ axis.label }}</span>
      </button>
    </template>

    <template v-if="animatorGizmo.tool === 'orbit' || animatorGizmo.tool === 'rotate'">
      <button
          v-for="axis in axisOptions"
          :key="`rotate-${axis.key}`"
          type="button"
          class="gizmo-object-ring"
          :class="[
          axis.key,
          {
            active: animatorGizmo.tool === 'rotate' && animatorGizmo.axis === axis.key,
          },
        ]"
          :disabled="disabled"
          data-gizmo-handle="true"
          :data-gizmo-axis="axis.key"
          data-gizmo-tool="rotate"
          @pointerdown.prevent="emitAxis(axis.key, 'rotate', $event)"
          @pointerup.prevent="emitRelease($event)"
      >
        <span>{{ axis.label }}</span>
      </button>
    </template>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {gizmoModel, gizmoProps} from "@/models/canvas/gizmo/model";

export default defineComponent({
  name: "GizmoComponent",
  props: gizmoProps,
  emits: [
    "select",
    "axis",
    "release",
    "update:component-event",
  ],
  setup(props, { emit }) {
    return {
      ...gizmoModel(props, emit),
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Gizmo";
</style>
