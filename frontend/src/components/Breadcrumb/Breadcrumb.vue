<template>
  <v-breadcrumbs class="py-2">
    <v-breadcrumbs-item
        v-for="(link, index) in items"
        :key="index"
        :disabled="link.disabled"
        :href="link.href"
    >
      {{ link.text }}
    </v-breadcrumbs-item>
  </v-breadcrumbs>
</template>

<script>
export default {
  name: 'BreadcrumbComponent',
  props: {
    items: {
      type: Array,
      default: () => [
        { text: 'Home', href: '/' },
        { text: 'Page', href: '/page' },
      ],
    },
  },
};
</script>

<style scoped>
.v-breadcrumbs {
  font-size: 14px;
}
</style>
