<template>
  <div class="edit-view-mode-panel">
    <button
        v-for="mode in modes"
        :key="mode.key"
        type="button"
        :class="{ active: value === mode.key }"
        @click="set(mode.key)"
    >
      {{ mode.label }}
    </button>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { viewModePanelModel, viewModePanelProps } from "@/view/models/page/material/meshEdit/viewModePanel/model";

export default defineComponent({
  name: "EditViewModePanel",
  props: viewModePanelProps,
  emits: ["update:component-event"],
  setup(props, { emit }) {
    return viewModePanelModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
.edit-view-mode-panel {
  position: absolute;
  right: 14px;
  top: 14px;
  z-index: 30;
  display: flex;
  gap: 6px;
  padding: 6px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.72);
  backdrop-filter: blur(14px);
}

.edit-view-mode-panel button {
  border: 0;
  border-radius: 9px;
  padding: 5px 8px;
  color: rgba(255,255,255,.82);
  background: rgba(255,255,255,.08);
  font-size: 11px;
  font-weight: 700;
}

.edit-view-mode-panel button.active {
  color: #10151d;
  background: #73dcff;
}
</style>
