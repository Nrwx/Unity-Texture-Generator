<template>
  <section class="path-list">
    <article
        v-for="path in data.filter(x => !x.default)"
        :key="path.id"
        :data-id="path.id"
        class="path-item"
    >
      <button
          type="button"
          class="path-action add"
          @click.stop="add(path)"
      >
        <v-icon size="15">mdi-plus</v-icon>
      </button>

      <div class="path-avatar">
        <img
            v-if="path?.thumbnail"
            :src="path.thumbnail"
            :alt="path.name"
        />
        <v-icon v-else size="18">mdi-vector-polyline</v-icon>
      </div>

      <input
          class="path-name"
          v-model="path.name"
          @blur="emitEvent('path:update', path)"
          @click.stop
      />

      <button
          type="button"
          class="path-action danger"
          @click.stop="emitEvent('path:delete', path.id)"
      >
        <v-icon size="15">mdi-delete</v-icon>
      </button>
    </article>
  </section>
</template>

<script>
import { defineComponent } from "vue";
import { pathProps, pathModel } from "@/models/path/model";

export default defineComponent({
  name: "PathComponent",
  props: pathProps,
  setup(props, { emit }) {
    const { add, emitEvent } = pathModel(props, emit);

    return {
      add,
      emitEvent,
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Path.scss";
</style>