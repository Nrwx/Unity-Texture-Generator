<template>
  <v-container class="page-header" fluid>
    <template v-if="breadcrumb">
      <Breadcrumb />
    </template>

    <v-row align="center" class="align-center d-flex">
      <div v-if="$slots.icon">
        <slot name="icon">{{ $slots.icon }}</slot>
      </div>
      <div class="d-flex flex-wrap align-center">
        <div v-if="$slots.header" class="mb-0 text-h3 text-truncate">
          <slot name="header">{{ $slots.header }}</slot>
        </div>
        <div v-if="$slots.subtitle" style="width: 100%;" class="text-subtitle">
          <slot name="subtitle">{{ $slots.subtitle }}</slot>
        </div>
      </div>
      <div v-if="$slots.settingsDesc" class="text-subtitle" :style="$root.$vuetify.display.xs ? 'width: calc(100% - 75px)' : 'width: calc(100% - 100px)'" >
        <slot name="settingsDesc">{{ $slots.settingsDesc }}</slot>
      </div>
      <v-spacer v-if="$slots.action"></v-spacer>
      <div v-if="$slots.action" class="d-flex align-center">
        <slot name="action">{{ $slots.action }}</slot>
      </div>
    </v-row>
  </v-container>
</template>

<script>
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";

export default {
  name: 'PageHeaderComponent',
  components: {
    Breadcrumb,
  },
  props: {
    breadcrumb: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
.page-header {
  background-color: var(--v-surface);
  border-bottom: 1px solid var(--v-border);
}
</style>
