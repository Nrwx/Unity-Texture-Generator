<template v-if="operation[item.method]">
  <div v-for="(prop, key) in operation[item.method]" :key="key">
    <!-- Titel und Untertitel -->
    <div
        v-if="prop.active"
        class="d-flex flex-wrap align-center overflow-hidden"
        :class="{ 'text-right': prop.align === 'right'}"
    >
      <div v-if="prop?.title" class="mb-0 text-h6 text-truncate" style="width: 100%;">
        {{ prop.title }}
      </div>
      <div v-if="prop?.subtitle" class="text-subtitle-2 text-truncate" style="width: 100%;">
        {{ prop.subtitle }}
      </div>
    </div>
    <!-- Textfeld für Text -->
    <v-text-field
        v-if="prop.type === 'text' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        outlined
        @update:modelValue="emitEvent(prop.event, item[key])"
    />
    <!-- Textfeld für Array-Numbers -->
    <v-text-field
        v-else-if="prop.type === 'text-array-number' && prop.active"
        :label="prop.label"
        type="text"
        :model-value="(item[key] || []).join(', ')"
        outlined
        @update:modelValue="val => updateTextArrayNumber(val, prop, item, key)"
    />
    <!-- Textfeld für Zahlen -->
    <v-text-field
        v-else-if="prop.type === 'number' && prop.active"
        v-model.number="item[key]"
        :label="prop.label"
        :type="prop.inputType || 'number'"
        outlined
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-text-field>
    <!-- Slider -->
    <v-slider
        v-else-if="prop.type === 'slider' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        :min="prop.min"
        :max="prop.max"
        :step="prop.step || 1"
        thumb-label
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-slider>
    <!-- Checkbox -->
    <v-checkbox
        v-else-if="prop.type === 'checkbox' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-checkbox>

    <!-- Switch -->
    <v-switch
        v-else-if="prop.type === 'switch' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-switch>

    <!-- MDI Icon Picker -->
    <icon-list
        v-else-if="prop.type === 'icon' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        :prepend-icon="item[key]"
        @open="showDimmer"
        @close="hideDimmer"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />

    <!-- Color Palette -->
    <color-palette
        v-else-if="prop.type === 'color-palette' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        :prepend-icon="item[key]"
        @open="showDimmer"
        @close="hideDimmer"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />

    <!-- Gradient Editor -->
    <gradient-editor
        v-else-if="prop.type === 'gradient-editor' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        @open="showDimmer"
        @close="hideDimmer"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />

    <!-- Dimmer Overlay -->
    <div
        v-if="dimmer"
        class="dimmer"
        @click="hideDimmer"
    ></div>

    <!-- Dropdown -->
    <v-select
        v-else-if="prop.type === 'select' && prop.active"
        v-model="item[key]"
        :density="prop.dense"
        :hide-details="prop.dense"
        :items="prop.options"
        :disabled="prop.disabled"
        :label="prop.label"
        :prepend-icon="prop.prependIcon"
        :append-icon="prop.appendIcon"
        :multiple="prop.multi"
        item-title="title"
        :item-value="prop.return ? (opt) => opt : 'value'"
        @update:modelValue="(val) => selectUpdate(prop, val)"
    ></v-select>

    <!-- Farbwähler -->
    <v-color-picker
        width="100%"
        v-else-if="prop.type === 'color' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        flat
        mode="hex"
        elevation="0"
        rounded
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-color-picker>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {formModel, formProps} from "@/models/form/model";
import IconList from "@/components/Icon/List";
import ColorPalette from "@/components/Color/Palette";
import GradientEditor from "@/components/Color/Gradient";

export default defineComponent({
  name: "FormComponent",
  props: formProps,
  components: {IconList, ColorPalette, GradientEditor},
  setup(props, { emit }) {
    const { selectUpdate, emitEvent, dimmer, showDimmer, hideDimmer, updateTextArrayNumber } = formModel(props, emit);
    return {
      selectUpdate,
      dimmer,
      showDimmer,
      hideDimmer,
      emitEvent,
      updateTextArrayNumber
    };
  },
});
</script>

<style scoped lang="scss">
@import "./Form";
</style>