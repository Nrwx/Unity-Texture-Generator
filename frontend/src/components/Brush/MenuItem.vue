<template>
  <div v-for="item in items" :key="item.key" class="control d-flex align-center">
    <label class="text-truncate">{{ item.label }}</label>

    <!-- Slider -->
    <v-slider
        v-if="item.type === 'slider'"
        v-model="modelValue[item.key]"
        :min="item.min"
        :max="item.max"
        :step="item.step"
        :color="sliderColor"
        hide-details
        @click.stop="emitEvent(item.key)"
    />
    <span v-if="item.unit">{{ formattedValue(item) }}</span>

    <!-- Toggle -->
    <input
        v-else-if="item.type === 'toggle'"
        type="checkbox"
        v-model="modelValue[item.key]"
        class="ml-auto mr-0"
        @change.stop="emitEvent(item.key)"
    />

    <!-- Select -->
    <v-select
        v-else-if="item.type === 'select'"
        v-model="modelValue[item.key]"
        :items="item.options"
        class="ml-auto mr-0"
        dense
        theme="dark"
        max-width="100"
        density="compact"
        hide-details
        outlined
        @update:modelValue="emitEvent(item.key)"
    />
  </div>
</template>


<script>
import { defineComponent } from 'vue';
import { brushMenuItemModel, brushMenuItemProps } from '@/models/brush/menu/item/model';

export default defineComponent({
  name: 'BrushContextMenuItem',
  props: brushMenuItemProps,
  setup(props, { emit }) {
    const {sliderColor, formattedValue, emitEvent} = brushMenuItemModel(props, emit);

    return {
      sliderColor,
      formattedValue,
      emitEvent
    };
  }
});
</script>

<style scoped>
.control > label {
  width: 6rem;
}
.control > span {
  margin-left: 0.5rem;
  width: 4rem;
  text-align: right;
}
</style>
