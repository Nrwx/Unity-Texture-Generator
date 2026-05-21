<template>
  <div
      class="brush-cursor"
      :class="className"
      :style="style"
  >
    <svg
        :key="cursorVector.key"
        class="brush-cursor__svg"
        :style="preview"
        :viewBox="viewBox"
        preserveAspectRatio="none"
        aria-hidden="true"
    >
      <!-- Schwarzer Kontrast-Stroke -->
      <path
          v-for="(path, index) in cursorVector.paths"
          :key="`shadow-${cursorVector.key}-${index}`"
          :d="path"
          pathLength="1"
          class="brush-cursor__vector-path brush-cursor__vector-path--shadow"
      />

      <!-- Weißer Haupt-Stroke -->
      <path
          v-for="(path, index) in cursorVector.paths"
          :key="`white-${cursorVector.key}-${index}`"
          :d="path"
          pathLength="1"
          class="brush-cursor__vector-path brush-cursor__vector-path--white"
      />

      <!-- Blauer Sweep nur auf erstem Hauptpfad -->
      <g
          v-if="firstPath"
          :key="`sweep-${cursorVector.key}`"
          class="brush-cursor__sweep"
      >
        <path
            :d="firstPath"
            pathLength="1"
            class="brush-cursor__vector-path brush-cursor__vector-path--sweep brush-cursor__vector-path--sweep-a"
            stroke-dasharray="0.78 0.22"
            stroke-dashoffset="1"
        >
          <animate
              attributeName="stroke-dashoffset"
              from="1"
              to="0"
              dur="6.5s"
              repeatCount="indefinite"
              calcMode="linear"
          />
        </path>

        <path
            :d="firstPath"
            pathLength="1"
            class="brush-cursor__vector-path brush-cursor__vector-path--sweep brush-cursor__vector-path--sweep-b"
            stroke-dasharray="0.52 0.48"
            stroke-dashoffset="1.18"
        >
          <animate
              attributeName="stroke-dashoffset"
              from="1.18"
              to="0.18"
              dur="6.5s"
              repeatCount="indefinite"
              calcMode="linear"
          />
        </path>

        <path
            :d="firstPath"
            pathLength="1"
            class="brush-cursor__vector-path brush-cursor__vector-path--sweep brush-cursor__vector-path--sweep-c"
            stroke-dasharray="0.22 0.78"
            stroke-dashoffset="1.36"
        >
          <animate
              attributeName="stroke-dashoffset"
              from="1.36"
              to="0.36"
              dur="6.5s"
              repeatCount="indefinite"
              calcMode="linear"
          />
        </path>
      </g>
    </svg>

    <div class="brush-cursor__dot"></div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {cursorModel, cursorProps} from "@/models/brush/cursor/model";

export default defineComponent({
  name: "CursorComponent",

  props: cursorProps,

  setup(props) {
    return {
      ...cursorModel(props),
    };
  },
});
</script>

<style scoped lang="scss">
@import '_Cursor';
</style>