<template>
  <v-card-title class="text-h6">
    Form Einstellungen
  </v-card-title>
  <v-card-text style="width: 100%;">
    <Form @component-event="emitEvent" v-model:operation="operation" v-model:item="config"/>
  </v-card-text>
  <v-divider />

  <v-card-actions>
    <v-spacer />
    <v-btn width="50%" text @click="emitEvent('pen:path-state', false)">Abbrechen</v-btn>
    <v-btn width="50%" color="primary" @click="save">Speichern</v-btn>
  </v-card-actions>
</template>

<script>
import { defineComponent } from "vue";
import {pathModel, pathProps} from "@/view/models/page/path/model";
import Form from "@/components/Form/Form";

export default defineComponent({
  name: "PathPage",
  props: pathProps,
  components: {
    Form
  },
  setup(props, { emit }) {
    const { config, operation, emitEvent, save} = pathModel(emit);

    return {
      config,
      operation,
      emitEvent,
      save,
    };
  },
});
</script>

<style scoped>
</style>
