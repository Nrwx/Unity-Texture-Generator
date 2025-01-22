<template>
  <div style="width: 100%; height: 40px;" class="text-center">
    <v-tooltip location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
            v-bind="props"
            icon
            width="100%"
            size="small"
            class="rounded-0"
            elevation="0"
            :color="item.active ? 'yellow-lighten-4' : ''"
            @click="emitEvent"
        >
          <v-icon>{{ item.icon }}</v-icon>
        </v-btn>
      </template>
      {{ item.tooltip }}
    </v-tooltip>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {taskbarItemModel, taskbarItemProps} from "@/models/taskbar/item/model";

export default defineComponent({
  name: "TaskbarItem",
  props: taskbarItemProps,
  setup(props, { emit }) {
    const { emitEvent } = taskbarItemModel(emit);
    return {
      emitEvent
    };
  },
});
</script>
