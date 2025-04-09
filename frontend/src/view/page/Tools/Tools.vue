<template>
  <v-container>
    <v-row v-for="category in categorizedTools" :key="category.name" class="mb-8">
      <!-- Title and Subtitle for each category -->
      <v-col cols="12">
        <h2>{{ category.name }}</h2>
        <p>{{ category.description }}</p>
      </v-col>

      <!-- Buttons Grid -->
      <div style="width: 100%;" class="button-grid">
        <div
            v-for="tool in category.tools"
           :key="tool.label"
           class="d-flex flex-wrap" style="width: 100%;"
        >
          <v-card
              :color="tool.color || 'primary'"
              class="d-flex flex-column align-center justify-center button-card"
              @click="emitEvent(tool.event, tool.val)"
          >
            <v-icon>{{ tool.icon }}</v-icon>
          </v-card>
          <div style="width: 100%" class="text-center">
            <small class="text-truncate mt-1" style="max-width: 100%; text-align: center;">
              {{ tool.action }}
            </small>
          </div>
        </div>
      </div>
    </v-row>
  </v-container>
</template>

<script>
import { defineComponent } from "vue";
import { toolsModel, toolsProps } from "@/view/models/page/tools/model";

export default defineComponent({
  name: "ToolsPage",
  props: toolsProps,
  setup(props, { emit }) {
    const { emitEvent, toolData, categorizedTools } = toolsModel(emit);
    return {
      emitEvent,
      toolData,
      categorizedTools,
    };
  },
});
</script>

<style scoped>
h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

p {
  color: #666;
  margin-bottom: 1rem;
}

.text-truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 10px;
}

.button-card {
  height: 60px;
  width: 60px;
}
</style>