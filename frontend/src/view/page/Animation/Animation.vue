<template>
  <v-card-text>
    <div style="width: 100%;">
      <div class="timeline-container">

        <div class="timeline-bar-wrapper" ref="wrapperRef" :id="wrapperId">
          <!-- SVG timeline (vector) -->
          <Timeline
              :config="timelineData"
              :wrapper-id="wrapperId"
              :state="windowStates.select.value"
              :select-state="windowStates.selectItems.value"
              :selection-box="localData.selectItemsBox.value"
              @component-event="emitEvent"
          />
        </div>
      </div>
    </div>
  </v-card-text>
</template>

<script>
import { defineComponent } from "vue";
import {animationModel, animationProps} from "@/view/models/page/animation/model";
import Timeline from "@/components/Timeline/Timeline";
import {windowStates} from "@/dataLayer/state";
import {timelineData} from "@/models/timeline/config/model";
import {localData} from "@/dataLayer/local";

export default defineComponent({
  name: "AnimationPage",
  props: animationProps,
  components: {
    Timeline
  },
  setup(props, { emit }) {
    const { wrapperRef, wrapperId, timelineBar, emitEvent,} = animationModel(props, emit);
    return {
      timelineData,
      localData,
      windowStates,
      wrapperRef,
      wrapperId,
      timelineBar,
      emitEvent,
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Animation';
</style>