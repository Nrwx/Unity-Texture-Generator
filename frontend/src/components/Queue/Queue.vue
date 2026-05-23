<template>
  <v-card
      v-if="state && queue"
      width="300"
      :height="expanded ? 100 : 70"
      @click="handleCLick"
      :theme="theme"
      class="queue d-flex flex-column pa-4 transition-fast"
      variant="flat"
  >
    <div class="route-icon-wrapper d-flex align-center">
      <v-icon
          :icon="routeIcon"
          class="route-bg-icon ml-auto mr-4"
      />
    </div>

    <div class="d-flex align-center">
      <v-icon :class="{'queue-wait': queue?.wait}" :icon="methodIcon" size="20" class="mr-2" color="primary" />
      <div class="text-subtitle-1 font-weight-medium text-truncate">
        {{ queue?.title || 'Synchronisieren...' }}
      </div>
    </div>

    <div v-if="expanded" class="text-caption text-grey-darken-1 mb-2 text-truncate">
      {{ queue?.subTitle || 'Initialisiere Hintergrundprozess.' }}
    </div>

    <v-progress-linear
        :model-value="queue?.percent"
        :indeterminate="queue?.indeterminate"
        color="deep-purple-accent-4"
        height="6"
        rounded
        striped
    />
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import {queueModel, queueProps} from "@/models/queue/model";

export default defineComponent({
  name: "QueueComponent",
  props: queueProps,
  setup(props, { emit }) {
    const {expanded, methodIcon, routeIcon, getDayProgress, handleCLick} = queueModel(props, emit);
    return {
      expanded,
      methodIcon,
      routeIcon,
      getDayProgress,
      handleCLick
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Queue";
</style>
