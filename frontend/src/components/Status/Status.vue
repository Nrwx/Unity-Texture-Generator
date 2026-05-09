<template>
  <transition name="mini-toolbar-fade">
    <div v-if="shouldShow" class="mini-toolbar-floating" :class="{ docked: docked }">
      <div class="mini-toolbar-stack">
        <div
            v-for="item in visibleItems"
            :key="item.id"
            class="mini-toolbar-item"
            :class="{active: isActive(item),temporary: item.temporary}"
            :title="item.tooltip"
            :style="itemStyle(item)"
        >
          <v-icon size="10" class="mini-toolbar-icon">
            {{ item.icon }}
          </v-icon>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { defineComponent } from "vue";
import {statusBarModel, statusBarProps} from "@/models/status/model";

export default defineComponent({
  name: "MiniToolbar",
  props: statusBarProps,
  setup(props, { emit }) {
    return statusBarModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "_Status";
</style>