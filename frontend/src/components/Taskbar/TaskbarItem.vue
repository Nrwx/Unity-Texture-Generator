<template>
  <div :style="align === 'center' ? 'width: 40px; height: 100%;' : 'width: 100%; height: 40px;'" class="text-center">
    <v-tooltip location="bottom" :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn
            v-if="!item.subComponent"
            v-bind="props"
            icon
            width="100%"
            size="small"
            class="rounded-0"
            variant="flat"
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
              <template v-for="menuItem in item.menuItems">
                <v-btn
                    v-if="!menuItem.hidden"
                    :key="menuItem.id"
                    :color="menuItem.active ? 'yellow-lighten-4' : ''"
                    icon
                    variant="flat"
                    rounded="0"
                    @click="emitMenuEvent(menuItem)"
                >
                  <v-badge
                      v-if="menuItem.badge && menuItem.badge.content !== 0"
                      :content="menuItem.badge.content"
                      :dot="menuItem.badge.dot && !centerMenu"
                      :icon="menuItem.badge.icon"
                      :color="menuItem.badge.color || 'red'"
                  >
                    <v-icon :color="menuItem.active ? '' : '#fff'" :size="20">{{ menuItem.icon }}</v-icon>
                  </v-badge>
                  <v-icon v-else :color="menuItem.active ? '' : '#fff'" :size="20">{{ menuItem.icon }}</v-icon>
                </v-btn>
              </template>
            </v-speed-dial>
          </template>

          <v-badge
              v-if="item.badge && item.badge.content !== 0"
              :content="item.badge.content"
              :dot="!centerMenu"
              :icon="item.badge.icon"
              :color="item.badge.color || 'red'"
          >
            <v-icon>{{ item.icon }}</v-icon>
          </v-badge>
          <v-icon v-else>{{ item.icon }}</v-icon>
        </v-btn>

        <v-btn
            v-else
            v-bind="props"
            icon
            width="100%"
            size="small"
            class="rounded-0"
            variant="flat"
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
