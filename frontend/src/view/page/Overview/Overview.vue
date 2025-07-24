<template>
  <v-card-text>
    <div class="d-flex flex-nowrap" style="max-width: 100%;">
      <div style="width: 30%; max-width: 30%;">
        <Form
            @component-event="emitEvent"
            v-model:operation="operation"
            v-model:item="config"
        />
      </div>
      <div style="width: 70%; max-width: 70%;" class="pl-4">
        <div class="grid gap-2" :style="gridStyle">
          <div
              v-for="tile in tiles"
              :key="tile.id"
              class="tile"
              :style="getTileStyle(tile)"
              @click="() => onTileClick(tile)"
          >
            <v-icon v-if="tile.icon" size="28" class="mb-1">{{ tile.icon }}</v-icon>
            <div class="text-sm font-weight-medium">{{ tile.label }}</div>
            <div class="text-xs text-grey">{{ tile.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </v-card-text>
</template>

<script>
import { defineComponent } from "vue";
import {overviewModel, overviewProps} from "@/view/models/page/overview/model";
import Form from "@/components/Form/Form";
export default defineComponent({
  name: "OverviewPage",
  props: overviewProps,
  components: {
    Form
  },
  setup(props, { emit }) {
    const { gridStyle, tiles, getTileStyle, onTileClick, config, operation, emitEvent } = overviewModel(props, emit);

    return {
      config,
      operation,
      gridStyle,
      tiles,
      getTileStyle,
      onTileClick,
      emitEvent
    };
  },
});
</script>