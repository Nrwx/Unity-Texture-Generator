<template>
  <v-card
      ref="menu"
      class="bg-white rounded-lg shadow-lg min-w-[180px] overflow-hidden"
      elevation="10"
  >
    <v-list density="compact">
      <v-list-item
          v-for="(item, index) in data"
          :key="index"
          class="cursor-pointer hover:bg-grey-lighten-3 relative"
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
              v-if="item.children?.length > 0 && hovered !== index"
              icon="mdi-chevron-right"
              size="16"
          />
        </template>

        <!-- Submenu -->
        <div
            v-if="item.children && hovered === index"
            class="absolute top-0"
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
