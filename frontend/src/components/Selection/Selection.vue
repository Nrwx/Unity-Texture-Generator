<template>
  <div
      v-show="state"
      ref="panel"
      class="selection-root absolute w-h"
      tabIndex="0"
  >
    <SelectionVectorBox
        v-if="activeBox"
        :box="activeBox"
        :shape="shape"
    />

    <slot/>
  </div>
</template>

<script>
import {defineComponent} from "vue";
import SelectionVectorBox from "./Box.vue";
import {selectionModel, selectionProps} from "@/models/selection/model";

export default defineComponent({
  name: "SelectionComponent",
  components: {
    SelectionVectorBox,
  },
  props: selectionProps,
  setup(props, {emit}) {
    const model = selectionModel(props, emit);

    return {
      ...model,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Selection.scss";
</style>