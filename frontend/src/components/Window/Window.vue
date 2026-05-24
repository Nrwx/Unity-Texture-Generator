<template>
  <aside
      v-if="state"
      ref="windowRef"
      class="floating-window"
      :class="{
    compact,
    disabled,
    dragging: drag.active
  }"
      :style="windowStyle"
      @pointerdown.capture="focusWindow"
  >
    <header
        class="floating-window__bar"
        @pointerdown="startDrag"
    >
      <div class="floating-window__title">
        <v-icon v-if="icon" size="15">{{ icon }}</v-icon>
        <strong>{{ title }}</strong>
      </div>

      <button
          type="button"
          class="floating-window__close"
          @pointerdown.stop
          @click.stop="closeWindow"
      >
        <v-icon size="15">mdi-window-close</v-icon>
      </button>
    </header>

    <section class="floating-window__body">
      <slot />
    </section>
  </aside>
</template>

<script>
import { defineComponent } from "vue";
import {windowModel, windowProps} from "@/models/window/model";

export default defineComponent({
  name: "WindowComponent",
  props: windowProps,
  setup(props, { emit }) {
    return windowModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Window";
</style>