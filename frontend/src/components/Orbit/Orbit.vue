<template>
</template>


<script>
import { defineComponent } from "vue";
import {orbitModel, orbitProps} from "@/models/orbit/model";

export default defineComponent({
  name: "OrbitComponent",
  props: orbitProps,
  setup(props, { emit }) {
    const model = orbitModel(props, emit);
    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Orbit";
</style>
