<template>
  <v-file-input
      label="Bild auswählen"
      :file="file"
      @change="emitFile"
      accept="image/*"
  ></v-file-input>
  <!-- Prozess Button -->
  <v-btn class="mt-2" color="primary" block @click="uploadFile">
    Bild hochladen
  </v-btn>
</template>

<script>
import { defineComponent } from "vue";
import {fileModel, fileProps} from "@/models/file/model";

export default defineComponent({
  name: "FileComponent",
  props: fileProps,
  setup(props, { emit }) {
    const { emitFile, uploadFile } = fileModel(props, emit);
    return {
      emitFile,
      uploadFile
    };
  },
});
</script>