<template>
  <Dialog @update:component-event="emitEvent" :state="state" :data="config" :loading="loading">
    <template #content>
      <v-form ref="form">
        <v-switch v-model="settings.use_gpu" label="Use GPU"></v-switch>
        <v-text-field v-model="settings.cpu_threads" label="CPU Threads" type="number"></v-text-field>
        <v-select
            v-model="settings.preferred_unit"
            :items="['GPU', 'CPU']"
            label="Preferred Unit"
        ></v-select>
      </v-form>
    </template>
    <template #action>
      <v-btn color="primary" @click="emitEvent('save-setting', settings)">Save</v-btn>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import {settingModel, settingProps} from "@/models/setting/model";
import Dialog from "@/components/Dialog/Dialog.vue";

export default defineComponent({
  name: "SettingComponent",
  components: {Dialog},
  props: settingProps,
  setup(props, { emit }) {
    const { emitEvent, config } = settingModel(emit);
    return {
      config,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
</style>