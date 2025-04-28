<template>
  <v-dialog
      v-model="state"
      :width="data.width"
      :height="data.height"
      :max-width="data.maxWidth"
      :max-height="data.maxHeight"
      :fullscreen="data.fullscreen"
  >
      <v-card :class="data.class">
        <LoadingComponent v-if="loading"/>
        <template v-else>
          <template v-if="data.fullscreen">
            <v-btn class="absolute" icon style="top: 32px; right: 32px;" @click="emitEvent(data.emit, false)">
              <v-icon>mdi-close</v-icon>
              <slot name="absolute"/>
            </v-btn>
          </template>
          <v-card-title>
            <template v-if="!$slots.header && data.title">{{data.title}}</template>
            <slot v-if="$slots.header" name="header"/>
          </v-card-title>
          <v-card-text>
            <slot name="content"/>
          </v-card-text>
          <v-card-actions v-if="$slots.action || !data.fullscreen">
            <v-spacer />
            <v-btn @click="emitEvent(data.emit, false)">Schließen</v-btn>
            <slot name="action"/>
          </v-card-actions>
        </template>
      </v-card>
  </v-dialog>
</template>

<script>
import { defineComponent } from "vue";
import { dialogModel, dialogProps } from "@/models/dialog/model";
import LoadingComponent from "@/components/Loading/Loading.vue";

export default defineComponent({
  name: "DialogComponent",
  components: {LoadingComponent},
  props: dialogProps,
  setup(props, { emit }) {
    const { emitEvent } = dialogModel(props, emit);
    return {
      emitEvent
    };
  },
});
</script>
