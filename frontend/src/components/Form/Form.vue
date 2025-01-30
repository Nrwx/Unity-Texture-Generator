<template v-if="operation[item.method]">
  <div v-for="(prop, key) in operation[item.method]" :key="key">
    <!-- Textfeld für Zahlen -->
    <v-text-field
        v-if="prop.type === 'number' && prop.active"
        v-model.number="item[key]"
        :label="prop.label"
        :type="prop.inputType || 'number'"
        outlined
    ></v-text-field>
    <!-- Slider -->
    <v-slider
        v-if="prop.type === 'slider' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        :min="prop.min"
        :max="prop.max"
        :step="prop.step || 1"
        thumb-label
    ></v-slider>
    <!-- Checkbox -->
    <v-checkbox
        v-else-if="prop.type === 'checkbox' && prop.active"
        v-model="item[key]"
        :label="prop.label"
    ></v-checkbox>

    <!-- Switch -->
    <v-switch
        v-else-if="prop.type === 'switch' && prop.active"
        v-model="item[key]"
        :label="prop.label"
    ></v-switch>

    <!-- Dropdown -->
    <v-select
        v-else-if="prop.type === 'select' && prop.active"
        v-model="item[key]"
        :items="prop.options"
        :label="prop.label"
        :multiple="prop.multi"
        item-title="title"
        item-value="value"
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-select>

    <!-- Farbwähler -->
    <v-color-picker
        width="100%"
        v-else-if="prop.type === 'color' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        flat
        elevation="0"
        rounded
    ></v-color-picker>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {formModel, formProps} from "@/models/form/model";

export default defineComponent({
  name: "FormComponent",
  props: formProps,
  setup(props, { emit }) {
    const { selected, emitEvent } = formModel(emit);
    return {
      selected,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
</style>