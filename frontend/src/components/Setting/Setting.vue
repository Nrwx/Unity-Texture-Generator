<template>
  <v-dialog v-model="state" max-width="500">
    <v-card>
      <v-card-title>Systemeinstellungen</v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-switch v-model="settings.use_gpu" label="Use GPU"></v-switch>
          <v-text-field v-model="settings.cpu_threads" label="CPU Threads" type="number"></v-text-field>
          <v-select
              v-model="settings.preferred_unit"
              :items="['GPU', 'CPU']"
              label="Preferred Unit"
          ></v-select>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" text @click="emitEvent('save-setting', settings)">Save</v-btn>
        <v-btn text @click="emitEvent('setting-state', false)">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>


<script>
import { defineComponent } from "vue";
import {settingModel, settingProps} from "@/models/setting/model";

export default defineComponent({
  name: "SettingComponent",
  props: settingProps,
  setup(props, { emit }) {
    const { emitEvent } = settingModel(emit);
    return {
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
</style>