<template>
  <div
      v-show="state"
      class="edit-text-overlay absolute"
      ref="overlay"
      :id="overlayId"
  >
    <div
        v-show="layer"
        ref="container"
        :id="containerId"
        class="edit-text-layer d-flex flex-column absolute"
        :style="wrapperStyle"
    >
      <textarea
          ref="textarea"
          :id="textareaId"
          v-model="draft.text"
          class="edit-textarea"
          :style="textareaStyle"
          placeholder="Text bearbeiten..."
          @input="resizeEditor"
          @keydown.stop
      />

      <div class="edit-action-buttons d-flex justify-center align-center">
        <v-btn
            ref="confirm"
            :id="confirmId"
            icon
            size="20"
            variant="flat"
            color="#87ff8c80"
            title="Änderungen übernehmen"
        >
          <v-icon size="14" color="white" icon="mdi-check"/>
        </v-btn>

        <v-btn
            ref="cancel"
            :id="cancelId"
            icon
            size="20"
            variant="flat"
            color="#e5222880"
            title="Bearbeitung abbrechen"
        >
          <v-icon size="14" color="white" icon="mdi-close"/>
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {editTextModel, editTextProps} from "@/models/text/edit/model";

export default defineComponent({
  name: "EditTextComponent",
  props: editTextProps,
  setup(props, { emit }) {
    const model = editTextModel(props, emit);

    return {
      ...model,
    };
  },
});
</script>

<style lang="scss" scoped>
@import "./_Edit.scss";
</style>