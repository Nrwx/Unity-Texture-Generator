<template>
  <File @component-event="emitEvent" v-model:file="file"/>
  <v-divider class="py-4"/>
  <Form @component-event="emitEvent" v-model:operation="methods" v-model:item="config"/>
</template>

<script>
import { defineComponent } from "vue";
import {uploadModel, uploadProps} from "@/view/models/page/upload/model";
import File from "@/components/File/File";
import Form from "@/components/Form/Form";
import {localData} from "@/dataLayer/local";

export default defineComponent({
  name: "FilePage",
  components: {Form, File},
  props: uploadProps,
  setup(props, { emit }) {
    const { emitEvent, methods, config } = uploadModel(emit);
    return {
      emitEvent,
      methods,
      config,
      file: localData.file.value
    };
  },
});
</script>