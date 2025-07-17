<template>
  <v-menu
      v-model="menu"
      :close-on-content-click="false"
      @update:modelValue="handleMenuToggle"
      max-width="340"
  >
    <template #activator="{ props }">
      <v-text-field
          v-bind="props"
          v-model="modelValue"
          :label="label"
          readonly
          outlined
      >
        <template #prepend>
          <v-avatar
              size="20"
              class="me-2"
              :style="{ backgroundColor: modelValue || '#ccc', border: '1px solid #aaa' }"
          ></v-avatar>
        </template>
      </v-text-field>
    </template>

    <v-card>
      <v-tabs
          v-model="tone"
          background-color="transparent"
          grow
      >
        <v-tab value="light">Hell</v-tab>
        <v-tab value="dark">Dunkel</v-tab>
      </v-tabs>

      <v-divider></v-divider>

      <v-sheet max-height="250" class="overflow-y-auto px-4 py-2">
        <div
            v-for="(shades, name) in materialColorShades"
            :key="name"
            class="mb-2"
        >
          <div class="text-caption mb-1 text-medium-emphasis">{{ name }}</div>
          <div class="d-flex flex-wrap">
            <v-btn
                v-for="color in shades[tone]"
                :key="color"
                :style="{ backgroundColor: color}"
                class="ma-1"
                size="small"
                variant="flat"
                rounded
                @click="selectColor(color)"
            >
              {{ color }}
            </v-btn>
          </div>
        </div>
      </v-sheet>
    </v-card>
  </v-menu>
</template>

<script>
import { defineComponent } from "vue";
import {colorPaletteModel, colorPaletteProps} from "@/models/color/palette/model";

export default defineComponent({
  name: "ColorPaletteComponent",
  props: colorPaletteProps,
  setup(props, { emit }) {
    const { menu, tone, materialColorShades, handleMenuToggle, selectColor} = colorPaletteModel(props, emit);
    return {
      menu,
      tone,
      materialColorShades,
      handleMenuToggle,
      selectColor,
    };
  },
});
</script>