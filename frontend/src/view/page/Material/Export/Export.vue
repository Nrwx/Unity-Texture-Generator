<template>
  <div class="mem-view-head">
    <div>
      <strong>Export</strong>
      <span>Blender-kompatibles Materialpaket, Shader Graph und UV-Daten.</span>
    </div>

    <button
        type="button"
        class="mem-ghost-btn"
        :disabled="!canRequestExport"
        @click="requestExport"
    >
      Export anfragen
    </button>
  </div>

  <div class="mem-section">
    <pre class="mem-export-json">{{ exportJson }}</pre>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {exportModel, exportProps} from "@/view/models/page/material/export/model";

export default defineComponent({
    name: "ExportEditor",
    props: exportProps,
    setup(props, { emit }) {
      const model = exportModel(props, emit);
        return {
            ...model
        };
    },
});
</script>

<style scoped lang="scss">
@use "./_Export";
</style>
