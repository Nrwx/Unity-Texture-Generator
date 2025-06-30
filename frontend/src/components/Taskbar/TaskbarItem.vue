<template>
  <div style="width: 100%; height: 40px;" class="text-center">
    <v-tooltip location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
            v-if="!item.subComponent"
            v-bind="props"
            icon
            width="100%"
            size="small"
            class="rounded-0"
            elevation="0"
            :color="item.active ? 'yellow-lighten-4' : ''"
            @click="emitEvent"
        >
          <!-- Optional: Speed Dial -->
          <template v-if="hasMenu">
            <v-speed-dial
                v-model="menu"
                :location="'right center'"
                activator="parent"
                transition="slide-y-reverse-transition"
            >
              <v-btn
                  v-for="menuItem in item.menuItems"
                  :key="menuItem.id"
                  :color="menuItem.active ? 'yellow-lighten-4' : ''"
                  icon
                  flat
                  rounded="0"
                  @click="emitMenuEvent(menuItem)"
              >
                <v-icon :size="20">{{ menuItem.icon }}</v-icon>
              </v-btn>
            </v-speed-dial>
          </template>

          <v-icon>{{ item.icon }}</v-icon>
        </v-btn>

        <v-btn
            v-else
            v-bind="props"
            icon
            width="100%"
            size="small"
            class="rounded-0"
            elevation="0"
        >
          <component
              :is="item.subComponent.path"
              v-bind="item.subComponent.props"
              @update:componentEvent="emitEvent"
          />
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
    const { menu, hasMenu, emitMenuEvent, emitEvent } = taskbarItemModel(props, emit);
    return {
      hasMenu,
      emitMenuEvent,
      menu,
      emitEvent,
    };
  },
});
</script>
