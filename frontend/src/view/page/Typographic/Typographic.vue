<template>
  <div style="height: 50px;" class="mt-6 p-4 border rounded" :style="computedStyle">
    <p>Das ist die Typografie-Vorschau.</p>
  </div>
  <v-divider class="py-4"/>
  <Form @component-event="emitEvent" v-model:operation="operation" v-model:item="config"/>
</template>

<script>
import { defineComponent } from "vue";
import { typographicModel, typographicProps } from "@/view/models/page/typographic/model";
import Form from "@/components/Form/Form.vue";

export default defineComponent({
  name: "TypographicPage",
  components: {Form},
  props: typographicProps,
  setup(props, { emit }) {
    const { config, operation,computedStyle, emitEvent } = typographicModel(props, emit);
    return {
      operation,
      config,
      computedStyle,
      emitEvent,
    };
  },
});
</script>
