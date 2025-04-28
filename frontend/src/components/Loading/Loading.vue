<template>
  <div class="atom-wrapper">
    <div class="atom-container">
      <div
          v-for="index in electrons"
          :key="index"
          class="electron"
          :style="{
          animation: `orbit-${index} ${(index % 2 === 0) ? 'normal' : 'reverse'} infinite linear`,
          animationDuration: (1.5 + (index % 4) * 0.7) + 's',
          animationDelay: (index * 0.3) + 's'
        }"
      />
      <div class="atom-core"></div>
    </div>
    <div class="loading-text">
      {{ text }}
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { loadingModel, loadingProps } from "@/models/loading/model";

export default defineComponent({
  name: "LoadingComponent",
  props: loadingProps,
  setup(props, { emit }) {
    const { emitEvent } = loadingModel(props, emit);
    return {
      emitEvent
    };
  },
});
</script>

<style lang="scss">
@import "./_Loading.scss";
</style>
