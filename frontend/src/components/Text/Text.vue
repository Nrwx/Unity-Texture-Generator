<template>
  <!-- Zeichenfläche (Overlay), aktiv bei `state === true` -->
  <div
      v-show="state"
      class="drawing-overlay absolute"
      ref="overlay"
      :id="overlayId"
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
    <div v-show="drawn" ref="container" :id="containerId">
      <div
          class="text-layer d-flex flex-column absolute"
          :style="wrapperStyle"
      >
          <textarea
              :id="textareaId"
              v-model="layer.text"
              class="custom-textarea"
              ref="textarea"
              :style="textareaStyle"
          />
        <div class="action-buttons d-flex justify-center align-center">
          <v-btn ref="confirm" :id="confirmId" icon size="20" variant="flat" color="#87ff8c80" title="Bestätigen">
            <v-icon size="14" color="white" icon="mdi-check"/>
          </v-btn>
          <v-btn ref="cancel" :id="cancelId" icon size="20" variant="flat" color="#e5222880" title="Abbrechen">
            <v-icon size="14" color="white" icon="mdi-close"/>
          </v-btn>
        </div>

        <!-- Resize Handle (bottom right) -->
        <v-btn ref="resize" :id="resizeId" class="resize-handle" rounded="0" icon size="24" variant="flat" color="transparent" title="Rahmen neu anordnen">
          <v-icon size="24" color="white" icon="mdi-resize-bottom-right"/>
        </v-btn>
      </div>
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
    const {drawing, container, containerId, wrapperStyle, textareaStyle, drawn, overlay, overlayId, textarea, textareaId, cancel, cancelId, confirm, confirmId, resize, resizeId, selectionSvgStyle, predictedFontSize } = textModel(props, emit);
    return {
      drawing,
      container,
      containerId,
      drawn,
      wrapperStyle,
      textareaStyle,
      overlay,
      overlayId,
      textarea,
      textareaId,
      confirm,
      cancel,
      cancelId,
      confirmId,
      resize,
      resizeId,
      selectionSvgStyle,
      predictedFontSize
    };
  },
});
</script>

<style lang="scss" scoped>
@import "./_Text.scss";
</style>