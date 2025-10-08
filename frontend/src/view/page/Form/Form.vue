<template>
  <v-menu
      v-model="windowStates.form.value"
      location="bottom"
      :theme="appData.theme.value"
      :close-on-content-click="false"
      offset="4"
  >
    <!-- Aktivator: div statt button -->
    <template #activator="{ props }">
      <div class="form-button" v-bind="props">
        <img
            v-if="localData.selectedPath.value?.thumbnail"
            :src="localData.selectedPath.value.thumbnail"
            alt="selected form"
        />
      </div>
    </template>

    <!-- Menü mit Formen-Grid -->
    <v-card variant="flat" max-width="320" max-height="240" class="form-container overflow-y-auto py-4">
      <div
          class="form-item"
          v-for="path in localData.paths.value.filter(x => x.default)"
          :key="path.id"
          @click="selectForm(path)"
          :title="path.name"
      >
        <v-img width="25" height="25" max-height="25" max-width="25" :src="path.thumbnail" alt="Form thumbnail" />
        <div class="form-name">
          <div style="max-width: 45px" class="text-truncate">{{ path.name }}</div>
          <span v-if="path.default" class="default-badge">★</span>
        </div>
      </div>
    </v-card>
  </v-menu>
</template>

<script>
import { defineComponent } from "vue";
import {formModel, formProps} from "@/view/models/page/form/model";
import {appData, localData} from "@/dataLayer/local";
import {windowStates} from "@/dataLayer/state";

export default defineComponent({
  name: "FormPage",
  props: formProps,
  setup(props, { emit }) {
    const {selectForm} = formModel(props, emit);

    return {
      appData,
      windowStates,
      localData,
      selectForm
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Form';
</style>

