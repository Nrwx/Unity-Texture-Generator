<template>
  <div class="orbit" aria-hidden="true"></div>
</template>


<script>
import { defineComponent } from "vue";
import {orbitModel, orbitProps} from "@/models/orbit/model";

export default defineComponent({
  name: "OrbitComponent",
  props: orbitProps,
  setup() {
    const model = orbitModel();
    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Orbit";
</style>
