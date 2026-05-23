<template>
  <aside class="engine-camera-panel" :class="{ compact }">
    <section class="engine-camera-panel__hero">
      <div class="engine-camera-panel__title">
        <v-icon size="20">mdi-video-3d</v-icon>
        <div>
          <strong>{{ activeLayer?.name || "Engine View" }}</strong>
          <span>{{ camera.projection }} · {{ Math.round(Number(camera.fov || 0)) }}° · R {{ Number(orbit.radius || camera.radius || 0).toFixed(2) }}</span>
        </div>
      </div>

      <button type="button" class="engine-camera-panel__status" :class="{ active: !!activeLayer }" @click="emitCameraAction('apply')">
        <span />
        {{ activeLayer ? "Save" : "No Layer" }}
      </button>
    </section>

    <section class="engine-camera-panel__row engine-camera-panel__row--projection">
      <button type="button" :class="{ active: camera.projection === 'perspective' }" @click="setProjection('perspective')">
        <v-icon size="14">mdi-perspective-more</v-icon>
        Persp
      </button>
      <button type="button" :class="{ active: camera.projection === 'orthographic' }" @click="setProjection('orthographic')">
        <v-icon size="14">mdi-cube-outline</v-icon>
        Ortho
      </button>
      <button type="button" @click="emitCameraAction('frame')">
        <v-icon size="14">mdi-image-filter-center-focus</v-icon>
        Frame
      </button>
      <button type="button" @click="emitCameraAction('reset')">
        <v-icon size="14">mdi-restore</v-icon>
        Reset
      </button>
    </section>

    <section class="engine-camera-panel__views">
      <button v-for="view in viewButtons" :key="view.key" type="button" @click="setView(view.key)">
        <v-icon size="14">{{ view.icon }}</v-icon>
        {{ view.label }}
      </button>
    </section>

    <section class="engine-camera-panel__fields">
      <label v-for="field in cameraFields" :key="field.key">
        <span>{{ field.label }}</span>
        <input
            type="number"
            :step="field.step"
            :min="field.min"
            :max="field.max"
            :value="fieldValue(field.key)"
            @input="setCameraField(field.key, $event.target.value)"
        />
      </label>
    </section>

    <section class="engine-camera-panel__section">
      <header>
        <strong>Gizmo</strong>
        <small>{{ gizmo.tool }} · {{ gizmo.axis }} · {{ gizmo.pivot }}</small>
      </header>

      <div class="engine-camera-panel__strip tools">
        <button v-for="tool in gizmoTools" :key="tool.key" type="button" :class="{ active: gizmo.tool === tool.key }" @click="setGizmoTool(tool.key)">
          <v-icon size="14">{{ tool.icon }}</v-icon>
        </button>
      </div>

      <div class="engine-camera-panel__strip axis">
        <button v-for="axis in axisOptions" :key="axis.key" type="button" :class="['axis-' + axis.key, { active: gizmo.axis === axis.key }]" @click="setGizmoAxis(axis.key)">
          {{ axis.label }}
        </button>
      </div>

      <div class="engine-camera-panel__strip pivot">
        <button v-for="pivot in pivotOptions" :key="pivot.key" type="button" :class="{ active: gizmo.pivot === pivot.key }" @click="setGizmoPivot(pivot.key)">
          <v-icon size="14">{{ pivot.icon }}</v-icon>
        </button>
      </div>
    </section>

    <section class="engine-camera-panel__section">
      <header>
        <strong>View</strong>
        <small>{{ view.mode }}</small>
      </header>
      <div class="engine-camera-panel__row">
        <button v-for="mode in viewModes" :key="mode.key" type="button" :class="{ active: view.mode === mode.key }" @click="setEditorViewMode(mode.key)">
          {{ mode.label }}
        </button>
      </div>
    </section>

    <section class="engine-camera-panel__section">
      <header>
        <strong>Mesh Edit</strong>
        <small>{{ edit.enabled ? edit.mode : 'Off' }} · {{ edit.tool }}</small>
      </header>
      <div class="engine-camera-panel__row">
        <button type="button" :class="{ active: edit.enabled }" @click="emitMeshAction('tab-cycle')">TAB</button>
        <button v-for="mode in editModes" :key="mode" type="button" :class="{ active: edit.mode === mode }" @click="setMeshMode(mode)">{{ mode }}</button>
      </div>
      <div class="engine-camera-panel__row">
        <button type="button" :class="{ active: edit.tool === 'move' }" @click="setMeshTool('move')">Move</button>
        <button type="button" :class="{ active: edit.tool === 'scale' }" @click="setMeshTool('scale')">Scale</button>
        <button type="button" :class="{ active: edit.showAll }" @click="setMeshField('showAll', !edit.showAll)">All</button>
        <button type="button" @click="emitMeshAction('make-face')">Face</button>
      </div>
      <div class="engine-camera-panel__selection">
        V {{ edit.selection?.vertices?.length || 0 }} · E {{ edit.selection?.edges?.length || 0 }} · F {{ edit.selection?.faces?.length || 0 }}
      </div>
    </section>

    <section class="engine-camera-panel__section engine-camera-panel__section--sculpt">
      <header>
        <strong>Sculpt</strong>
        <small>{{ sculpt.enabled ? 'ON' : 'OFF' }} · {{ sculpt.tool }}</small>
      </header>
      <div class="engine-camera-panel__row">
        <button type="button" :class="{ active: sculpt.enabled }" @click="setSculptField('enabled', !sculpt.enabled)">B</button>
        <button v-for="tool in sculptTools" :key="tool" type="button" :class="{ active: sculpt.tool === tool }" @click="setSculptField('tool', tool)">{{ tool }}</button>
      </div>
      <div class="engine-camera-panel__sliders">
        <label>
          <span>Radius {{ Number(sculpt.radius || 0).toFixed(2) }}</span>
          <input type="range" min="0.02" max="2" step="0.01" :value="sculpt.radius" @input="setSculptField('radius', Number($event.target.value))" />
        </label>
        <label>
          <span>Strength {{ Number(sculpt.strength || 0).toFixed(3) }}</span>
          <input type="range" min="0.001" max="0.35" step="0.001" :value="sculpt.strength" @input="setSculptField('strength', Number($event.target.value))" />
        </label>
        <label>
          <span>Detail {{ Math.round(Number(sculpt.detail?.detailPercent || 0)) }}%</span>
          <input type="range" min="0" max="200" step="1" :value="sculpt.detail?.detailPercent" @input="setSculptField('detail.detailPercent', Number($event.target.value))" />
        </label>
      </div>
    </section>
  </aside>
</template>

<script>
import { defineComponent } from "vue";
import { cameraModel, cameraProps } from "@/view/models/page/material/camera/model";

export default defineComponent({
  name: "CameraPanel",
  props: cameraProps,
  emits: ["update:component-event"],
  setup(props, { emit }) {
    return cameraModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Camera";
</style>
