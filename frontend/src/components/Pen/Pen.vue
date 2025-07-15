<template>
  <div v-show="state" class="pen-canvas-wrapper">
    <canvas
        ref="canvas"
    ></canvas>
    <Dialog :data="config" @update:component-event="emitEvent" :state="pathState" :loading="loading" :theme="theme">
      <template #header>
        <div class="d-flex align-center flex-wrap">
          <div>
            Pfad schließen ?
          </div>
          <div class="points-circle mx-auto mb-4">
            <div class="points-value">{{ pointsLength }}</div>
            <div class="points-label">Punkte</div>
          </div>
        </div>
      </template>
      <template #content>
        <div>
          Du hast <strong>{{ pointsLength }}</strong> Punkte gesetzt.<br>
          Möchtest du den Pfad jetzt schließen oder weiterzeichnen?
        </div>
      </template>

      <template #action>
        <v-btn @click="handlePath({edit: true})" color="error" variant="flat">
          Weiter
        </v-btn>
        <v-spacer/>
        <v-btn @click="handlePath" color="error" variant="flat">
          Pfad schließen
        </v-btn>
      </template>
    </Dialog>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import {penModel, penProps} from '@/models/pen/model';
import Dialog from "@/components/Dialog/Dialog";

export default defineComponent({
  name: 'PenComponent',
  components: {Dialog},
  props: penProps,
  setup(props, { emit }) {
    const {
      pointsLength,
      canvas,
      config,
      handlePath,
      emitEvent
    } = penModel(props, emit);

    return {
      pointsLength,
      canvas,
      config,
      handlePath,
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Pen";
</style>
