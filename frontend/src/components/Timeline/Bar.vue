<template>
  <div class="timeline-controls">
    <div v-for="group in groups" :key="group.id" :class="group.class">

      <template v-if="group.type === 'input' && group.active">
        <div v-for="child in group?.children" :key="child.id" :class="child.class">

          <template v-if="child.type === 'number' ">
            <div class="time-display">
              <span class="time-label">{{ child.title }}</span>
              <input
                  :type="child.type"
                  :class="child.class"
                  :value="child.value"
                  @change="child.callback(Number($event.target.value))"
                  @keydown.enter="$event.target.blur()"
                  :min="child.min"
                  :max="child.max"
              />
            </div>
          </template>

          <template v-if="group.children.length < 1">
            <div class="time-separator"></div>
          </template>

          <template  v-if="child.type === 'text'">
            <div :class="child.class">
              <v-icon v-if="child.icon" :size="child.icon.size">{{ child.icon.url }}</v-icon>
              <span>{{ child.value }}%</span>
            </div>
          </template>

        </div>
      </template>

      <template v-else-if="group.type === 'button' && group.active">
        <div v-for="child in group?.children" :key="child.id" :class="child.class">

          <template v-if="child.type === 'select' ">
            <v-select
                :model-value="child.value"
                @update:modelValue="(val) => child.callback(val)"
                :items="easeModes"
                density="compact"
                variant="outlined"
                hide-details
                :class="child.class"
            >
              <template v-slot:prepend-inner>
                <v-icon v-if="child.icon" :size="child.icon.size">{{ child.icon.url }}</v-icon>
              </template>
            </v-select>
          </template>

          <template v-else>
            <v-btn
                icon
                size="small"
                variant="flat"
                :class="child.class"
                :disabled="child?.disabled"
                @click="child.callback()"
                :title="child?.title"
            >
              <v-icon v-if="child.icon" :size="child.icon.size">{{ child?.icon?.url }}</v-icon>
            </v-btn>
          </template>

        </div>
      </template>
    </div>
  </div>
</template>



<script>
import { defineComponent } from "vue";
import { timelineBarModel, timelineBarProps } from "@/models/timeline/bar/model";

export default defineComponent({
  name: "TimelineBarComponent",
  props: timelineBarProps,
  setup(props, { emit }) {
    const model = timelineBarModel(props, emit);
    return {...model};
  },
});
</script>

<style scoped lang="scss">
@use "./_Bar.scss";
</style>
