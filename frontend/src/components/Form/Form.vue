<template v-if="operation[item.method]">
  <div class="d-block overflow-hidden" v-for="(prop, key) in operation[item.method]" :key="key">
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
        :prepend-icon="prop.icon"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />
    <!-- Textfeld für Array-Numbers -->
    <v-text-field
        v-else-if="prop.type === 'text-array-number' && prop.active"
        :label="prop.label"
        type="text"
        :model-value="(item[key] || []).join(', ')"
        outlined
        :prepend-icon="prop.icon"
        @update:modelValue="val => updateTextArrayNumber(val, prop, item, key)"
    />
    <!-- Textfeld für Zahlen -->
    <v-text-field
        v-else-if="prop.type === 'number' && prop.active"
        v-model.number="item[key]"
        :label="prop.label"
        :type="prop.inputType || 'number'"
        outlined
        :prepend-icon="prop.icon"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />
    <!-- Slider -->
    <v-slider
        v-else-if="prop.type === 'slider' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        :min="prop.min"
        :max="prop.max"
        :step="prop.step || 1"
        :prepend-icon="prop.icon"
        thumb-label
        @update:modelValue="emitEvent(prop.event, item[key])"
    ></v-slider>
    <!-- Checkbox -->
    <v-checkbox
        v-else-if="prop.type === 'checkbox' && prop.active"
        v-model="item[key]"
        :prepend-icon="prop.icon"
        :label="prop.label"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />

    <!-- Switch -->
    <v-switch
        v-else-if="prop.type === 'switch' && prop.active"
        v-model="item[key]"
        :prepend-icon="prop.icon"
        :label="prop.label"
        @update:modelValue="emitEvent(prop.event, item[key])"
    />

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
    />

    <!-- Farbwähler -->
    <v-color-picker
        width="100%"
        v-else-if="prop.type === 'color' && prop.active"
        v-model="item[key]"
        :label="prop.label"
        mode="hex"
        variant="flat"
        rounded
        @update:modelValue="emitEvent(prop.event, item[key])"
    />

    <!-- Button bar -->
    <template v-else-if="prop.type === 'button-bar' && prop.active">
      <div class="d-flex align-center overflow-hidden" :class="prop.class">
        <div v-if="prop.label && prop.hint" class="d-flex align-center flex-wrap" style="max-width: 70%;">
          <div class="v-card-title text-truncate" style="width: 100%;">{{ prop.label }}</div>
          <div class="v-card-subtitle text-truncate" style="width: 100%;">{{ prop.hint }}</div>
        </div>
        <v-spacer v-if="prop.label"/>
        <v-btn-toggle
            v-model="item[key]"
            color="primary"
            variant="outlined"
            divided
        >
          <v-btn
              v-for="option in prop.options"
              :key="option.mode"
              :value="option.mode"
              icon
              @click="emitEvent(option.event, option)"
          >
            <v-tooltip location="bottom" close-on-content-click>
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props">
                  {{ option.icon }}
                </v-icon>
              </template>
              {{ option.title }}
            </v-tooltip>
          </v-btn>
        </v-btn-toggle>
      </div>
    </template>

    <!-- Dimmer Overlay -->
    <div
        v-if="dimmer"
        class="dimmer"
        @click="hideDimmer"
    />
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