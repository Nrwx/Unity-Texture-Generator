<template>
  <v-card flat height="100%">
    <v-card-title class="headline d-flex align-center">
      Protokoll
      <v-spacer />
      <v-btn icon :disabled="cursor <= 0" @click="moveCursor(cursor - 1)">
        <v-icon>mdi-undo</v-icon>
      </v-btn>
      <v-btn icon :disabled="cursor >= modifiers.length - 1" @click="moveCursor(cursor + 1)">
        <v-icon>mdi-redo</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text class="overflow-y-auto" style="max-height: 70vh;">
      <v-list dense>
        <v-list-item
            v-for="(modifier, index) in localData.modified"
            :key="index"
            @click="moveCursor(index)"
            :class="{ 'text--disabled': index > cursor }"
        >
          <v-list-item-title>
            {{ index + 1 }}. {{ modifier.description }}
          </v-list-item-title>
          <v-list-item-subtitle>{{ modifier.timestamp }}</v-list-item-subtitle>
          <v-list-item-action v-if="index === cursor">
            <v-icon color="primary">mdi-check</v-icon>
          </v-list-item-action>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import {protocolModel, protocolProps} from "@/view/models/page/protocol/model";
import {localData} from "@/dataLayer/local";

export default defineComponent({
  name: "ProtocolPage",
  props: protocolProps,
  setup(props, { emit }) {
    const { emitEvent, modifiers, cursor, moveCursor } = protocolModel(props, emit);
    return {
      emitEvent,
      modifiers,
      cursor,
      moveCursor,
      localData
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Protocol';
</style>
