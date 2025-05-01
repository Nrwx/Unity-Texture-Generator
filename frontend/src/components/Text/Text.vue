<template>
  <!-- Zeichenfläche (Overlay), aktiv bei `state === true` -->
  <div
      v-if="state"
      class="drawing-overlay absolute"
      ref="overlay"
      @mousedown="handleOverlayClick"
  >
    <!-- Auswahlrahmen als SVG -->
    <svg
        v-if="drawing"
        class="selection-svg absolute"
        :style="selectionSvgStyle"
    >
      <rect
          x="0" y="0"
          :width="layer.width"
          :height="layer.height"
          rx="10"
          ry="10"
          fill="rgba(33, 150, 243, 0.03)"
          stroke="#2196f3"
          stroke-width="2"
          stroke-dasharray="6 3"
      />
      <text
          x="6"
          y="-8"
          fill="#2196f3"
          font-size="12"
          font-weight="500"
      >
        {{ layer.width }} × {{ layer.height }} px — {{ Math.round(predictedFontSize) }} px
      </text>
    </svg>
    <!-- Textebene nach erfolgreichem Zeichnen -->
    <div
        v-if="drawn"
        class="text-layer d-flex flex-column absolute"
        :style="wrapperStyle"
        @dblclick="editAgain"
    >
      <textarea
          :id="layer.id"
          v-model="layer.text"
          class="custom-textarea"
          ref="textarea"
          :style="textareaStyle"
          @mousedown.stop
          @input="adjustHeight"
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
    const {drawing, finishEditing, wrapperStyle, textareaStyle, startDraw, drawn, overlay, textarea, editAgain, handleOverlayClick, confirmText, cancelText,autoGrow, startResize, adjustHeight, selectionSvgStyle, predictedFontSize } = textModel(props, emit);
    return {
      drawing,
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
      startResize,
      adjustHeight,
      selectionSvgStyle,
      predictedFontSize
    };
  },
});
</script>

<style lang="scss" scoped>
@import "./_Text.scss";
</style>