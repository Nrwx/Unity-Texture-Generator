<template>
  <div v-show="state" class="pen-canvas-wrapper">
    <canvas
        ref="canvas"
    ></canvas>
    <Dialog :data="config" @update:component-event="emitEvent" :state="pathState || pathImport" :loading="loading" :theme="theme">
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
        <v-btn v-if="pathState && !pathImport" @click="handlePath({edit: true})" color="error" variant="flat">
          Weiter
        </v-btn>
        <v-btn v-else @click="cancel" color="grey" variant="flat">
          Abbrechen
        </v-btn>
        <v-spacer/>
        <v-btn @click="handlePath" color="error" variant="flat">
          {{ pathState && !pathImport ? 'Pfad schließen' : 'Pfad importieren' }}
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
    const model = penModel(props, emit);
    return {...model};
  },
});
</script>

<style scoped lang="scss">
@import "./_Pen";
</style>
