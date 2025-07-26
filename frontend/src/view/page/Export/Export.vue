<template>
  <Dialog @update:component-event="emitEvent" :state="windowStates.export.value" :data="config" :loading="localData.loading.value" :theme="theme">
    <template #content>
      <v-row no-gutters>
        <!-- Preview (70%) -->
        <v-col cols="12" md="8" class="pa-2">
          <v-img
              :src="localData.exportData.src"
              :key="localData.exportData.id"
              class="rounded border"
              height="100%"
              max-width="100%"
              cover
          />
        </v-col>

        <!-- Settings (30%) -->
        <v-col cols="12" md="4" class="pa-2">
          <v-form>
            <v-select
                v-model="exportType"
                :items="exportTypes"
                label="Export Typ"
                prepend-icon="mdi-export"
                density="comfortable"
                class="mb-4"
            />


            <v-btn block class="mt-6" color="primary" @click="exportContent">
              Exportieren
            </v-btn>
          </v-form>
        </v-col>
      </v-row>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import {exportModel, exportProps} from "@/view/models/page/export/model";
import Dialog from "@/components/Dialog/Dialog";
import {windowStates} from "@/dataLayer/state";
import {localData} from "@/dataLayer/local";

export default defineComponent({
  name: "ExportPage",
  props: exportProps,
  components: {
    Dialog
  },
  setup(props, { emit }) {
    const { config, theme, emitEvent } = exportModel(props, emit);
    return {
      localData,
      windowStates,
      config,
      theme,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Export';
</style>

