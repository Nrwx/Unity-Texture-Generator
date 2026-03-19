<template>
  <!-- Wrapper zentriert -->
  <div
      class="taskbar-center d-flex flex-column align-center"
      style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); z-index: 10; max-width: 1200px; width: 100%;"
  >
    <!-- Expanded Content separat über der Taskbar -->
    <v-expand-transition>
      <template v-if="expanded">
        <v-card
            v-if="active && active.component && active.component.props"
            variant="flat"
            :max-width="active.component?.maxWidth || 585"
            width="100%"
            class="px-4 py-3 mb-4 rounded-xl"
        >
          <div class="d-flex align-center px-2" style="width: 100%; height: 36px;">
            <v-btn
                icon
                size="x-small"
                class="ml-auto mr-2"
                @click="emitEvent('drawer-center-state', !expanded)"
                variant="text"
            >
              <v-icon size="16">{{ expanded ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
            </v-btn>
          </div>
          <div style="max-height: 700px; overflow-y: auto; pointer-events: auto;">
            <component
                class="d-flex flex-wrap"
                :is="active?.component.path"
                v-bind="active?.component.props"
                @component-event="handleComponentEvent"
            />
          </div>
        </v-card>
      </template>
    </v-expand-transition>

    <!-- Taskbar separat fixiert -->
    <v-sheet
        width="100%"
        :theme="theme"
        class="rounded-xl elevation-0 d-flex flex-column"
        style="overflow: visible; pointer-events: auto;"
    >
      <!-- Taskbar Inhalt -->
      <div
          class="d-flex justify-space-between align-center px-2"
          style="width: 100%;"
      >
        <!-- Left -->
        <div class="d-flex align-center">
          <template v-for="(item, i) in leftItems" :key="'left-' + item.id">
            <TaskbarItem v-if="!item.hidden" align="center" :item="item" @click="emitEvent(item.id)" :center-menu="expanded" />
            <v-divider v-if="leftItems.length > 1 && i < leftItems.length - 1 && !item.hidden" vertical />
          </template>
        </div>

        <!-- Center -->
        <div class="d-flex align-center">
          <template v-for="(item, i) in centerItems" :key="'center-' + item.id">
            <TaskbarItem v-if="!item.hidden" align="center" :item="item" @click="emitEvent(item.id)" :center-menu="expanded"/>
            <v-divider v-if="centerItems.length > 1 && i < centerItems.length - 1  && !item.hidden" vertical />
          </template>
        </div>

        <!-- Right -->
        <div class="d-flex align-center">
          <template v-for="(item, i) in rightItems" :key="'right-' + item.id">
            <TaskbarItem v-if="!item.hidden" align="center" :item="item" @click="emitEvent(item.id)" :center-menu="expanded" />
            <v-divider v-if="rightItems.length > 1 && i < rightItems.length - 1  && !item.hidden" vertical />
          </template>
        </div>
      </div>
    </v-sheet>
  </div>
</template>


<script>
import { defineComponent } from "vue";
import TaskbarItem from "@/components/Taskbar/TaskbarItem";
import {taskbarCenterModel, taskbarCenterProps} from "@/models/taskbar/center/model";

export default defineComponent({
  name: "TaskbarCenterComponent",
  props: taskbarCenterProps,
  components: {
    TaskbarItem
  },
  setup(props, { emit }) {
    const { leftItems, centerItems, rightItems, taskbarUp, emitEvent, handleComponentEvent } = taskbarCenterModel(props, emit);
    return {
      leftItems,
      centerItems,
      rightItems,
      taskbarUp,
      emitEvent,
      handleComponentEvent
    };
  },
});
</script>

<style scoped>
.v-sheet {
  border-radius: 20px;
}
</style>
