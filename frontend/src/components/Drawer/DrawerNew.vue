<template>
  <v-navigation-drawer
      v-model="taskbarMenu"
      :width="width"
      :theme="theme"
      :location="align"
  >
    <v-card flat>
      <v-card-text class="d-flex align-center flex-nowrap">
        <!-- Titel und Untertitel -->
        <div
            class="d-flex flex-wrap align-center overflow-hidden"
            :class="{ 'text-right': align === 'right'}"
        >
          <div v-if="item?.title" class="mb-0 text-h5 text-truncate" style="width: 100%;">
            {{ item.title }}
          </div>
          <div v-if="item?.subtitle" class="text-subtitle text-truncate" style="width: 100%;">
            {{ item.subtitle }}
          </div>
        </div>
        <!-- Schließen-Button -->
        <div
            class="close-button"
            :class="{ 'mr-auto ml-0': align === 'left', 'ml-auto mr-0': align === 'right' }"
        >
          <v-btn v-if="icon" icon size="small" class="rounded-0" elevation="0" @click="closeDrawer">
            <v-icon>{{ item?.active && icon.length > 1 ? icon[1] : icon[0] }}</v-icon>
          </v-btn>
        </div>
      </v-card-text>
      <v-card-item v-if="item && item.component && item.component.props">
        <component
            class="d-flex flex-wrap"
            :is="item?.component.path"
            v-bind="item?.component.props"
            @component-event="handleComponentEvent"
        />
      </v-card-item>
    </v-card>
  </v-navigation-drawer>
</template>

<script>
import { defineComponent } from "vue";
import { drawerModel, drawerProps } from "@/models/drawer/model";

export default defineComponent({
  name: "DrawerComponent",
  props: drawerProps,
  setup(props, { emit }) {
    const { mobile, activeItem, closeDrawer, handleComponentEvent } = drawerModel(props, emit);

    return {
      mobile,
      activeItem,
      closeDrawer,
      handleComponentEvent,
    };
  },
});
</script>

<style scoped>
.close-button {
  width: 40px;
  height: 40px;
}
</style>
