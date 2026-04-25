<template>
  <v-dialog
      v-model="state"
      :width="data.width"
      :height="data.height"
      :max-width="data.maxWidth"
      :fullscreen="data.fullscreen"
      :theme="theme"
      :scrim="'#000000'"
  >
      <v-card :class="!data?.fullscreen ? `px-6 pt-3 pb-2 elevation-1 ${data?.variant === 'rounded' ?  'rounded-xl' : data?.variant === 'shaped' ?  'rounded-shaped' : ''}` : data?.class || ''" style="background: linear-gradient(180deg, #1f2129 0%, #1b1e27 60%) !important;">
        <LoadingComponent v-if="loading"/>
        <template v-else>
          <template v-if="data.fullscreen && !data.hideClose">
            <v-btn class="absolute" icon style="top: 32px; right: 32px;" @click="emitEvent(data.emit, false)">
              <v-icon>mdi-close</v-icon>
            </v-btn>
            <slot name="absolute"/>
          </template>
          <v-card-title v-if="data.title" :class="!data.fullscreen ? 'pa-0' : ''">
            <template v-if="!$slots.header">
              <div class="d-flex justify-space-between align-center mb-2">
                <h6 v-if="data?.textVariant === 'id'" style="min-width: 60%;">
                  {{data.title}}
                </h6>
                <h5 v-else style="min-width: 60%;">
                  {{data.title}}
                </h5>
                <template
                    v-if="!$slots.header && data.subtitle !== ''"
                >
                  <div class="text-caption text-id-color text-truncate" :style="data?.textVariant === 'id' ? 'font-size: .6rem !important;' : ''">
                    {{data.subtitle}}
                  </div>
                </template>
              </div>
            </template>
            <slot v-if="$slots.header" name="header"/>
          </v-card-title>

          <v-card-text :style="data.maxHeight ? `max-height: ${data.maxHeight}px; overflow: hidden; overflow-y: auto;` : ''" :class="data.fullscreen && data.title ? 'mt-6' : 'pa-0'">
            <template v-if="!data.fullscreen">
              <div class="detail-container">
                <div class="detail-card">
                  <slot name="content"/>
                </div>
              </div>
            </template>
            <template v-else>
              <slot name="content"/>
            </template>
          </v-card-text>

          <v-card-actions class="mt-2 pa-0" style="width: 100%;" v-if="$slots.action || !data.fullscreen">

            <v-btn v-if="!data.hideClose" class="secondary" @click="emitEvent(data.emit, false)">Schließen</v-btn>
            <v-spacer v-if="!data.hideClose" />

            <slot name="action"/>
          </v-card-actions>

        </template>
      </v-card>
  </v-dialog>
</template>

<script>
import { defineComponent } from "vue";
import { dialogModel, dialogProps } from "@/models/dialog/model";
import LoadingComponent from "@/components/Loading/Loading.vue";

export default defineComponent({
  name: "DialogComponent",
  components: {LoadingComponent},
  props: dialogProps,
  setup(props, { emit }) {
    const { emitEvent } = dialogModel(props, emit);
    return {
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Dialog";
</style>