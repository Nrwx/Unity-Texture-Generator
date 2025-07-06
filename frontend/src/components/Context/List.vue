<template>
  <v-card
      ref="menu"
      class="overflow-hidden"
      elevation="10"
      :theme="theme"
      min-width="200"
  >
    <v-list density="compact">
      <v-list-item
          v-for="(item, index) in data"
          :key="index"
          class="cursor-pointer"
          :disabled="item.disabled"
          :hidden="!item.active"
          @mouseenter="hovered = index"
          @mouseleave="hovered = null"
          @click.stop="handleClick(item)"
      >
        <!-- Icon -->
        <template #prepend>
          <v-icon v-if="item.icon" :icon="item.icon" size="18" class="mr-2" />
        </template>

        <!-- Label -->
        <v-list-item-title>{{ item.label }}</v-list-item-title>

        <!-- Submenu indicator -->
        <template #append>
          <v-icon
              v-if="item.children?.length > 0"
              :icon="hovered !== index ? 'mdi-chevron-right' : 'mdi-chevron-down'"
              size="16"
          />
        </template>

        <!-- Submenu -->
        <div
            v-if="item.children && hovered === index"
            style="position: fixed; z-index: 2"
            :style="submenuStyle"
        >
          <List
              :data="item.children"
              @select="$emit('select', $event)"
              :parent-coords="submenuCoords"
          />
        </div>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import {listModel, listProps} from "@/models/context/list/model";
import List from './List.vue'

export default defineComponent({
  name: "ListComponent",
  props: listProps,
  components: {
    List
  },
  setup(props, { emit }) {
    const { emitEvent, handleClick, submenuCoords, submenuStyle, hovered } = listModel(props, emit);
    return {
      hovered,
      submenuCoords,
      emitEvent,
      handleClick,
      submenuStyle,
    };
  },
});
</script>

<style lang="scss">
@import '_List.scss';
</style>
