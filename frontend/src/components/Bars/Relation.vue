<template>
  <div class="relations pa-3">
    <svg class="d-block" :width="width" :height="height" viewBox="0 0 800 280">
      <defs>
        <linearGradient id="ln1" x1="0" x2="1"><stop offset="0" stop-color="#6dd3ff"/><stop offset="1" stop-color="#6a5cff"/></linearGradient>
      </defs>

      <!-- edges -->
      <g class="links">
        <path
            v-for="(link, idx) in links"
            :key="idx"
            :d="link.path"
            fill="none"
            stroke="url(#ln1)"
            stroke-width="2"
            stroke-opacity="0.9"
        />
      </g>

      <!-- nodes -->
      <g class="nodes">
        <g v-for="(n) in nodes" :key="n.id" class="node" :transform="`translate(${n.x},${n.y})`">
          <circle :r="n.r" :class="['node-body', n.type]" />
          <text class="nlabel" y="-12" text-anchor="middle">{{ n.title }}</text>
          <text class="nval" y="4" text-anchor="middle">{{ n.value }}</text>
        </g>
      </g>
    </svg>

    <div class="legend d-flex ga-3 mt-3">
      <div class="legend-item d-flex align-center ga-2"><span class="dot d-inline-block running"></span> Running</div>
      <div class="legend-item"><span class="dot d-inline-block pending"></span> Pending</div>
      <div class="legend-item"><span class="dot d-inline-block complete"></span> Completed</div>
      <div class="legend-item"><span class="dot d-inline-block failed"></span> Failed</div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {relationModel, relationProps} from "@/models/bars/relation/model";

export default defineComponent({
  name: "RelationComponent",
  props: relationProps,
  setup(props, { emit }) {
    return relationModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@use "./_Relation";
</style>
