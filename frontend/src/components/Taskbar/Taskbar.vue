<template>
  <v-navigation-drawer
      v-model="taskbar"
      :width="width"
      :location="align"
      permanent
      :rail="true"
  >
    <v-card flat>
      <template v-for="(item, i) in items" :key="item.id">
        <TaskbarItem
            :item="item"
            @click="emitEvent(item.id)"
        />
        <v-divider v-if="items.length > 1 && i < items.length - 1"></v-divider>
      </template>
    </v-card>
    </v-navigation-drawer>
</template>

<script>
import { defineComponent } from "vue";
import {taskbarModel, taskbarProps} from "@/models/taskbar/model";
import TaskbarItem from "@/components/Taskbar/TaskbarItem";

export default defineComponent({
  name: "TaskbarComponent",
  props: taskbarProps,
  components: {
    TaskbarItem
  },
  setup(props, { emit }) {
    const { taskbar, emitEvent } = taskbarModel(emit);
    return {
      taskbar,
      emitEvent,
    };
  },
});
</script>