<template>
  <aside class="sculpt-brush-editor" :class="{ active: brush?.enabled }">
    <header class="sculpt-brush-editor__header">
      <strong>Sculpt Brush <span class="sculpt-brush-editor__shortcut">B</span></strong>
      <button type="button" @click="toggleEnabled">
        {{ brush?.enabled ? "ON" : "OFF" }}
      </button>
    </header>

    <label>
      Tool
      <select :value="brush?.tool" @change="setField('tool', $event.target.value)">
        <option v-for="mode in modes" :key="mode.key" :value="mode.key">
          {{ mode.label }}
        </option>
      </select>
    </label>

    <label>
      Radius
      <input type="range" min="0.02" max="2" step="0.01" :value="brush?.radius" @input="setField('radius', Number($event.target.value))" />
      <span>{{ Number(brush?.radius || 0).toFixed(2) }}</span>
    </label>

    <label>
      Strength
      <input type="range" min="0.001" max="0.35" step="0.001" :value="brush?.strength" @input="setField('strength', Number($event.target.value))" />
      <span>{{ Number(brush?.strength || 0).toFixed(3) }}</span>
    </label>

    <label>
      Sharpness
      <input type="range" min="0" max="1" step="0.01" :value="brush?.sharpness" @input="setField('sharpness', Number($event.target.value))" />
      <span>{{ Math.round(Number(brush?.sharpness || 0) * 100) }}%</span>
    </label>

    <label>
      Hardness
      <input type="range" min="0" max="1" step="0.01" :value="brush?.hardness" @input="setField('hardness', Number($event.target.value))" />
      <span>{{ Math.round(Number(brush?.hardness || 0) * 100) }}%</span>
    </label>

    <label>
      Spacing
      <input type="range" min="0.02" max="1" step="0.01" :value="brush?.spacing" @input="setField('spacing', Number($event.target.value))" />
      <span>{{ Math.round(Number(brush?.spacing || 0) * 100) }}%</span>
    </label>

    <label>
      Smoothness
      <input type="range" min="0" max="1" step="0.01" :value="brush?.smoothness" @input="setField('smoothness', Number($event.target.value))" />
      <span>{{ Math.round(Number(brush?.smoothness || 0) * 100) }}%</span>
    </label>

    <label class="sculpt-brush-editor__check">
      <input type="checkbox" :checked="brush?.invert" @change="setField('invert', $event.target.checked)" />
      Eindrücken / Invert
    </label>

    <section class="sculpt-brush-editor__detail">
      <label class="sculpt-brush-editor__check">
        <input type="checkbox" :checked="brush?.detail?.enabled" @change="setField('detail.enabled', $event.target.checked)" />
        Dynamic Detail Pen
      </label>

      <label>
        Detail
        <input type="range" min="0" max="200" step="1" :value="brush?.detail?.detailPercent" @input="setField('detail.detailPercent', Number($event.target.value))" />
        <span>{{ Math.round(Number(brush?.detail?.detailPercent || 0)) }}%</span>
      </label>

      <label>
        Tolerance
        <input type="range" min="0.001" max="1" step="0.001" :value="brush?.detail?.tolerance" @input="setField('detail.tolerance', Number($event.target.value))" />
        <span>{{ Math.round(Number(brush?.detail?.tolerance || 0) * 100) }}%</span>
      </label>
    </section>
  </aside>
</template>

<script>
import { defineComponent } from "vue";
import { brushEditorModel, brushEditorProps } from "@/view/models/page/material/brush/model";

export default defineComponent({
  name: "SculptBrushEditor",
  props: brushEditorProps,
  emits: ["update:component-event"],
  setup(props, { emit }) {
    return brushEditorModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_BrushEditor";
</style>
