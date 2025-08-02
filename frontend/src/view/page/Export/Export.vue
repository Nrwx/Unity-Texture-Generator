<template>
  <Dialog @update:component-event="emitEvent" :state="windowStates.export.value" :data="setting" :loading="localData.loading.value" :theme="theme">
    <template #content>
      <v-row no-gutters>
        <v-col cols="12" md="8" class="pa-2">
          <div style="max-width: 70%; min-height: 100%;" class="ml-auto mr-auto transparent">
            <v-img
                :src="previewData.src"
                :key="previewData.id"
                class="rounded border ml-auto mr-auto"
                max-height="90vh"
                min-height="100%"
            />
          </div>
        </v-col>

        <!-- Settings (30%) -->
        <v-col cols="12" md="4" class="d-flex flex-wrap pa-2">
          <div class="overflow-hidden overflow-y-auto" style="width: 100%; max-height: 80vh;">
            <Form
                @component-event="emitEvent"
                v-model:operation="operation"
                v-model:item="config"
            />
          </div>

          <div class="mt-auto mb-0 d-flex align-center" style="width: 100%;">
            <v-btn
                color="secondary"
                class="mr-4"
                prepend-icon="mdi-refresh"
                @click="emitEvent('export:update', config)"
            >
              Änderungen anwenden
            </v-btn>
            <v-btn
                color="primary"
                class="ml-auto mr-0"
                :disabled="previewData.file === ''"
                prepend-icon="mdi-download"
                @click="download(previewData.file)"
            >
              Exportieren
            </v-btn>
          </div>
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
import {previewData} from "@/models/export/config/model";
import {localData} from "@/dataLayer/local";
import Form from "@/components/Form/Form";

export default defineComponent({
  name: "ExportPage",
  props: exportProps,
  components: {
    Dialog,
    Form
  },
  setup(props, { emit }) {
    const { config, setting, operation, theme, download, emitEvent } = exportModel(props, emit);
    return {
      previewData,
      windowStates,
      localData,
      setting,
      operation,
      config,
      theme,
      download,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Export';
</style>

