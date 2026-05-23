<template>
  <div class="header-chip-status d-flex align-center ga-4 w-100">
    <section class="d-flex align-center ga-3 ml-0 mr-auto">
      <v-icon size="18">{{ config.icon }}</v-icon>

      <div class="d-flex flex-column">
        <strong>{{ config.title }}</strong>
        <span>{{ config.subtitle }}</span>
      </div>
    </section>

    <section
        v-if="config.chip"
        class="d-inline-flex align-center ga-2 ml-auto mr-0"
        :class="{
          active: config.chip.state,
          default: !config.chip.state && config.chip.message?.default && config.chip.message?.default !== ''
        }"
    >
      <span class="overflow-hidden text-truncate" />

      {{config.chip.state ? config.chip.message?.true : !config.chip.state && config.chip.message?.default && config.chip.message?.default  !== '' ? config.chip.message.default : config.chip.message?.false }}
    </section>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {
  headerStatusChipModel,
  headerStatusChipProps,
} from "@/view/models/components/header/model";

export default defineComponent({
  name: "HeaderStatusChip",
  props: headerStatusChipProps,
  setup(props) {
    return {
      ...headerStatusChipModel(props),
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Header";
</style>