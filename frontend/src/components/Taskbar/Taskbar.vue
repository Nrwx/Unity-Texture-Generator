<template>
  <v-navigation-drawer
      v-model="taskbar"
      :width="width"
      :location="align"
      :theme="theme"
      permanent
      :rail="true"
  >
    <v-card flat class="d-flex flex-column fill-height justify-space-between">
      <!-- Top Section -->
      <div>
        <template v-for="(item, i) in topItems" :key="'top-' + item.id">
          <TaskbarItem :item="item" @click="emitEvent(item.id)" @update:menu-event="emitEvent" @update:sub-component-event="emitSubEvent"  />
          <v-divider v-if="topItems.length > 1 && i < topItems.length - 1"></v-divider>
        </template>
      </div>

      <!-- Center Section -->
      <div>
        <template v-for="(item, i) in centerItems" :key="'center-' + item.id">
          <TaskbarItem :item="item" @update:menu-event="emitEvent" @update:sub-component-event="emitSubEvent" @click="emitEvent(item.id)" />
          <v-divider v-if="centerItems.length > 1 && i < centerItems.length - 1"></v-divider>
        </template>
      </div>

      <!-- Bottom Section -->
      <div>
        <template v-for="(item, i) in bottomItems" :key="'bottom-' + item.id">
          <TaskbarItem :item="item" @click="emitEvent(item.id)" @update:menu-event="emitEvent" @update:sub-component-event="emitSubEvent"  />
          <v-divider v-if="bottomItems.length > 1 && i < bottomItems.length - 1"></v-divider>
        </template>
      </div>
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
    const model = taskbarModel(props, emit);
    return {...model};
  },
});
</script>