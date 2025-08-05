<template>
  <!-- Path-Liste -->
  <v-list
      density="comfortable"
      two-line
      class="path-list overflow-hidden"
      bg-color="transparent"
  >
    <v-list-item
        v-for="(path) in data.filter(x => !x.default)"
        :key="path.id"
        :data-id="path.id"
        class="path-item"
    >

      <template v-slot:prepend>
        <v-icon color="grey" size="x-small" @click="add(path)">
          mdi-plus
        </v-icon>
      </template>

      <template v-slot:append>
        <v-icon color="grey" size="x-small" @click="emitEvent('path:delete', path.id)">
          mdi-delete
        </v-icon>
      </template>

      <div class="d-flex align-baseline">
        <v-text-field
            v-model="path.name"
            variant="outlined"
            min-width="100"
            max-width="150"
            :hide-details="true"
            @click.stop
        >
          <template v-slot:prepend-inner>
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-avatar v-bind="props" rounded="0" variant="elevated">
                  <v-img :src="path?.thumbnail" :alt="path.name" />
                </v-avatar>
              </template>
              {{ path.name }}
            </v-tooltip>
          </template>
        </v-text-field>
      </div>
    </v-list-item>
  </v-list>
</template>

<script>
import { defineComponent } from "vue";
import { pathProps, pathModel } from "@/models/path/model";

export default defineComponent({
  name: "PathComponent",
  props: pathProps,
  setup(props, { emit }) {
    const {add, emitEvent } = pathModel(props, emit);
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
