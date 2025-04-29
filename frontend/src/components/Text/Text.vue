<template>
  <div
      v-if="state"
      class="text-layer"
      ref="textLayer"
      :style="wrapperStyle"
      @mousedown="startResize"
  >
    <v-textarea
        v-if="state"
        v-model="layer.text"
        class="text-area"
        auto-grow
        :style="textareaStyle"
        @blur="finishEditing"
    />
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { textProps, textModel } from "@/models/text/model";

export default defineComponent({
  name: "TextComponent",
  props: textProps,
  setup(props, { emit }) {
    const {layer, isEditing, isResizing, startEditing, finishEditing, startResize, wrapperStyle, textareaStyle, emitEvent} = textModel(props, emit);
    return {
      layer,
      isEditing,
      isResizing,
      startEditing,
      finishEditing,
      startResize,
      wrapperStyle,
      textareaStyle,
      emitEvent,
    };
  },
});
</script>

<style lang="scss" scoped>
@import "./_Text.scss";
</style>