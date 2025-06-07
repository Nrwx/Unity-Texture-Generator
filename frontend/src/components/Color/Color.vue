<template>
  <div class="wheel-container" @contextmenu.prevent="rotateToMain">
    <div class="color-wheel">
      <v-menu
          v-model="state"
          location="bottom"
          :close-on-content-click="false"
      >
        <template #activator="{ props }">
          <div
              v-for="(color, i) in colors"
              :key="i"
              class="color-box"
              :class="'pos-' + i"
              :style="{ backgroundColor: color }"
              v-bind="props"
              @click="open(i)"
          />
        </template>

        <v-color-picker
            v-model="colors[selectedIndex]"
            hide-inputs
            mode="hex"
            @update:model-value="onColorChange"
        ></v-color-picker>
      </v-menu>
    </div>
  </div>
</template>


<script>
import { defineComponent } from "vue";
import {colorModel, colorProps} from "@/models/color/model";

export default defineComponent({
  name: "ColorComponent",
  props: colorProps,
  setup(props, { emit }) {
    const { close, colors, open, colorRefs, state, selectedIndex, visibleColors, rotateToMain, emitEvent, onColorChange } = colorModel(props, emit);
    return {
      close,
      colors,
      open,
      colorRefs,
      state,
      selectedIndex,
      visibleColors,
      emitEvent,
      onColorChange,
      rotateToMain
    };
  },
});
</script>

<style scoped lang="scss">
@import 'Color';
</style>