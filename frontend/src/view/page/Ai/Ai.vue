<template>
  <AiComponent @ai-event="emitEvent"></AiComponent>
</template>

<script>
import { defineComponent } from "vue";
import {aiModel, aiProps} from "@/view/models/page/ai/model";
import AiComponent from "@/components/Ai/Ai";

export default defineComponent({
  name: "AiPage",
  components: {AiComponent},
  props: aiProps,
  setup(props, { emit }) {
    const { emitEvent } = aiModel(emit);
    return {
      emitEvent,
    };
  },
});
</script>