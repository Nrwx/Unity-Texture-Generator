<template>
  <v-card-title style="width: 100%;" class="text-h5 mb-2">Screenshot erstellen</v-card-title>
  <v-card-text class="d-flex flex-column gap-4">
    <Form @component-event="emitEvent" v-model:operation="operation" v-model:item="config" />
    <div v-if="screenshots.length">
      <h3 class="text-subtitle-1 font-weight-bold mt-6">Gespeicherte Screenshots</h3>
      <v-row>
        <v-col
            v-for="shot in screenshots"
            :key="shot.id"
            cols="12" sm="6" md="4"
        >
          <v-card class="rounded-lg" outlined>
            <v-img :src="shot.url" height="150" cover />
            <v-card-subtitle class="text-truncate px-4 mt-1">{{ shot.title }}</v-card-subtitle>
            <v-card-text class="px-4 pt-0">
              <div class="text-caption">{{ shot.date }}</div>
              <div class="text-caption text-grey">{{ shot.mode }} · {{ shot.time }}ms</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </v-card-text>
  <v-tooltip text="Screenshot erstellen" location="top">
    <template #activator="{ props }">
      <v-btn
          class="fab-option"
          color="#007BFF"
          icon
          v-bind="props"
          fab
          size="small"
          @click="screenshot"
          :loading="isLoading"
          style="position: absolute;"
      >
        <v-icon>mdi-camera</v-icon>
      </v-btn>
    </template>
  </v-tooltip>
</template>

<script>
import { defineComponent } from "vue";
import {screenshotModel, screenshotProps} from "@/view/models/page/screenshot/model";
import Form from "@/components/Form/Form";
import {screenshotData} from "@/dataLayer/local";

export default defineComponent({
  name: "ScreenshotPage",
  props: screenshotProps,
  components: { Form },
  setup(props, { emit }) {
    const { isLoading, config, operation, screenshot, download, updateSelection, emitEvent } = screenshotModel(props, emit);
    return {
      isLoading,
      screenshots: screenshotData.history.value,
      config,
      operation,
      screenshot,
      updateSelection,
      download,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Screenshot';
</style>
