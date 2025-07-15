<template>
  <v-menu v-model="menu" :close-on-content-click="false" @update:modelValue="handleMenuToggle" max-width="350">
    <template #activator="{ props }">
      <v-text-field
          v-bind="props"
          v-model="modelValue"
          :label="label"
          readonly
          :prepend-icon="prependIcon"
          outlined
      />
    </template>

    <v-card>
      <v-text-field
          v-model="search"
          label="Suchen"
          density="compact"
          class="ma-2"
          clearable
      />
      <v-divider />
      <v-sheet max-height="200" class="overflow-y-auto px-2">
        <v-btn
            v-for="icon in filteredIcons"
            :key="icon"
            variant="text"
            class="ma-1"
            size="small"
            @click="selectIcon(icon)"
        >
          <v-icon :icon="icon" />
        </v-btn>
      </v-sheet>
    </v-card>
  </v-menu>
</template>

<script>
import { defineComponent } from "vue";
import {iconListModel, iconListProps} from "@/models/icon/list/model";

export default defineComponent({
  name: "IconListComponent",
  props: iconListProps,
  setup(props, { emit }) {
    const { menu, search, filteredIcons, selectIcon, handleMenuToggle} = iconListModel(props, emit);
    return {
      menu,
      search,
      handleMenuToggle,
      filteredIcons,
      selectIcon,
    };
  },
});
</script>