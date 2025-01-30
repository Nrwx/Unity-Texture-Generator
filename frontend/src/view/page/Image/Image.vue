<template>
  <Form @update:component-event="emitEvent" v-model:operation="methods" v-model:item="config"></Form>
</template>

<script>
import { defineComponent } from "vue";
import {imageOptionsModel, imageOptionsProps} from "@/view/models/page/image/options/model";
import Form from "@/components/Form/Form";

export default defineComponent({
  name: "ImageOptionsComponent",
  props: imageOptionsProps,
  components: {
    Form
  },
  setup(props, { emit }) {
    const { methods, config, emitEvent } = imageOptionsModel(emit);
    return {
      emitEvent,
      methods,
      config
    };
  },
});
</script>