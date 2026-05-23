<template>
  <div class="mesh-edit-panel" :class="{ 'is-active': edit?.enabled }">
    <div class="mesh-edit-panel__header">
      <strong>Geometry Edit</strong>
      <button type="button" @click="emitAction('tab-cycle')">
        {{ edit?.enabled ? `${edit?.mode || 'vertex'} →` : 'TAB / Edit' }}
      </button>
    </div>

    <div class="mesh-edit-panel__hint">TAB: Vertex → Edge → Face → Aus. Linke Maustaste selektiert/zieht nur im Edit Mode.</div>

    <div class="mesh-edit-panel__modes">
      <button type="button" :class="{ active: edit?.mode === 'vertex' }" @click="setMode('vertex')">1 Vertex</button>
      <button type="button" :class="{ active: edit?.mode === 'edge' }" @click="setMode('edge')">2 Edge</button>
      <button type="button" :class="{ active: edit?.mode === 'face' }" @click="setMode('face')">3 Face</button>
    </div>

    <div class="mesh-edit-panel__modes">
      <button type="button" :class="{ active: edit?.tool === 'move' }" @click="setTool('move')">Move</button>
      <button type="button" :class="{ active: edit?.tool === 'scale' }" @click="setTool('scale')">Scale</button>
      <button type="button" :class="{ active: edit?.showAll }" @click="setField('showAll', !edit?.showAll)">Show All</button>
    </div>

    <div class="mesh-edit-panel__tools">
      <button type="button" @click="emitAction('add-vertex')">Add Vertex</button>
      <button type="button" @click="emitAction('connect')">Connect</button>
      <button type="button" @click="emitAction('make-face')">Make Face</button>
      <button type="button" @click="emitAction('path')">Path</button>
      <button type="button" @click="emitAction('extrude')">Extrude</button>
      <button type="button" @click="emitAction('delete')">Delete</button>
      <button type="button" @click="emitAction('select-all')">All</button>
      <button type="button" @click="emitAction('clear')">Clear</button>
    </div>

    <div class="mesh-edit-panel__selection">
      V {{ edit?.selection?.vertices?.length || 0 }} ·
      E {{ edit?.selection?.edges?.length || 0 }} ·
      F {{ edit?.selection?.faces?.length || 0 }}
    </div>

    <div v-if="edit?.lastError" class="mesh-edit-panel__error">{{ edit.lastError }}</div>
    <div v-else-if="edit?.lastAction" class="mesh-edit-panel__status">{{ edit.lastAction }}</div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { meshEditPanelModel, meshEditPanelProps } from "@/view/models/page/material/meshEdit/panel/model";

export default defineComponent({
  name: "MeshEditPanel",
  props: meshEditPanelProps,
  emits: ["update:component-event"],
  setup(props, { emit }) {
    return meshEditPanelModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import './MeshEditPanel.scss';
</style>
