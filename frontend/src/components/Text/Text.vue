<template>
  <!-- Zeichenfläche (Overlay), aktiv bei `state === true` -->
  <div
      v-if="state"
      class="drawing-overlay absolute"
      ref="overlay"
      @mousedown="handleOverlayClick"
  >
    <!-- Textebene nach erfolgreichem Zeichnen -->
    <div
        v-if="drawn"
        class="text-layer"
        :style="wrapperStyle"
        @dblclick="editAgain"
    >
      <textarea
          v-model="layer.text"
          class="custom-textarea"
          ref="textarea"
          :style="textareaStyle"
          @blur="finishEditing"
          @mousedown.stop
          @input="autoGrow"
      />
      <div class="action-buttons d-flex justify-center align-center">
        <v-btn icon size="20" elevation="0" color="#87ff8c80" title="Bestätigen" @click="confirmText">
          <v-icon size="14" color="white" icon="mdi-check"/>
        </v-btn>
        <v-btn icon size="20" elevation="0" color="#e5222880" title="Abbrechen" @click="cancelText">
          <v-icon size="14" color="white" icon="mdi-close"/>
        </v-btn>
      </div>

      <!-- Resize Handle (bottom right) -->
      <v-btn class="resize-handle" rounded="0" icon size="24" elevation="0" color="transparent" title="Rahmen neu anordnen" @mousedown="startResize">
        <v-icon size="24" color="white" icon="mdi-resize-bottom-right"/>
      </v-btn>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { textProps, textModel } from "@/models/text/model";

export default defineComponent({
  name: "TextComponent",
  props: textProps,
  setup(props, { emit }) {
    const {layer, finishEditing, wrapperStyle, textareaStyle, startDraw, drawn, overlay, textarea, editAgain, handleOverlayClick, confirmText, cancelText,autoGrow, startResize} = textModel(props, emit);
    return {
      layer,
      drawn,
      startDraw,
      finishEditing,
      wrapperStyle,
      textareaStyle,
      overlay,
      textarea,
      editAgain,
      handleOverlayClick,
      confirmText,
      cancelText,
      autoGrow,
      startResize
    };
  },
});
</script>

<style lang="scss" scoped>
@import "./_Text.scss";
</style>