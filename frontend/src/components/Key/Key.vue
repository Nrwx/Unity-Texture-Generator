<template>
  <div class="key-logger d-flex flex-column" :class="{ collapsed: isCollapsed }" :style="{ height: collapsedHeight }" >
    <div class="d-flex justify-center mb-2">
      <v-btn size="16" @click="toggleCollapse" :icon="isCollapsed ? 'mdi-chevron-up' : 'mdi-chevron-down' " variant="plain"></v-btn>
    </div>

    <div class="log-window d-flex justify-center flex-wrap scrollbar-hidden" ref="logWindowRef">
      <div
          v-for="key in keys"
          :key="key.id"
          class="key-entry"
          :class="[{ held: key.held }, getKeySizeClass(key.name)]"
      >
        {{ key.name }}
        <v-icon color="white" v-if="key.held" class="badge" size="10">
          mdi-arrow-down-bold
        </v-icon>
      </div>
      <div v-if="keys.length >= 2" :style="{ height: collapsedHeight }" class="logFade"></div>
    </div>
  </div>
</template>



<script>
import { defineComponent } from "vue";
import {keyModel, keyProps} from "@/models/key/model";

export default defineComponent({
  name: "KeyComponent",
  props: keyProps,
  setup(props) {
    const { isCollapsed, toggleCollapse, collapsedHeight, logWindowRef, getKeySizeClass } = keyModel(props);
    return {
      isCollapsed,
      toggleCollapse,
      collapsedHeight,
      logWindowRef,
      getKeySizeClass
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Key";
</style>
