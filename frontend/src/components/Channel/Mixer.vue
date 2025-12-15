<template>
  <Dialog
      @update:component-event="emitEvent"
      :theme="theme"
      :data="config"
      :loading="loading"
      :state="state"
  >
    <template #content>
      <div class="channel-mixer w-100 overflow-hidden">
        <section class="mix-body h-100 d-flex">

          <!-- LEFT -->
          <aside class="mix-left flex-0-1 d-flex flex-column align-center pa-3 ga-3">

            <div class="canvas-wrap relative w-100 overflow-hidden d-flex justify-center align-center" ref="wrapper" :id="wrapperId">
              <Canvas :state="data?.active" :viewport="viewport" :id="canvasId" :config="data" @update:component-event="emitEvent"/>
            </div>

            <div class="preview-controls w-100 d-flex justify-center align-center ga-3">

              <div class="control d-flex flex-column ga-1">
                <label>Zoom</label>
                <input type="range" min="0.25" max="2" step="0.25" v-model.number="data.matrix.a"/>
              </div>

              <div class="control">
                <label>Background</label>
                <select v-model="data.background">
                  <option value="checker">Checker</option>
                  <option value="transparent">Transparent</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                </select>
              </div>

              <!-- RESET -->
              <v-btn icon variant="tonal" ref="resetBtn" :id="resetBtnId">
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </div>

          </aside>

          <!-- RIGHT -->
          <aside class="mix-right w-100 d-flex flex-column pa-3 ga-3">

            <div class="section d-flex flex-column ga-2">
              <label class="block">
                <span class="label">Base Channel</span>
                <select v-model="data.target" @change="update('base', data?.target)">
                  <option v-for="opt in refOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </label>
            </div>

            <div class="section">
              <h4 class="section-title mb-2">Layers (max 3)</h4>

              <div class="layers d-flex flex-column ga-2">
                <div
                    v-for="i in data?.layers"
                    :key="i.id"
                    class="layer-row align-center pa-2 ga-2"
                >
                  <select v-model="i.ref" @change="update('overlay', i.id, i.ref)">
                    <option :value="null">— None —</option>
                    <option v-for="opt in refOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>

                  <select v-model="i.blend_mode">
                    <option v-for="m in blendMode" :key="m.key" :value="m.value">
                      {{ m.title }}
                    </option>
                  </select>

                  <input type="range" min="0" max="1" step="0.01" v-model.number="i.opacity" />

                  <v-btn max-width="32" max-height="32" @pointerdown="emitEvent('channel:mixer-remove', i.id)" icon variant="outlined" color="error">
                    <v-icon>
                      mdi-delete
                    </v-icon>
                  </v-btn>
                </div>
              </div>

              <div class="layer-actions d-flex align-center ga-2">
                <v-btn class="btn" ref="addBtn" :id="addBtnId" :disabled="data?.layers.length >= data?.slots">
                  + Add Layer
                </v-btn>

              </div>
            </div>

            <div class="notes pa-2">
              Channels können gemischt werden wie in Photoshop.<br />
              Du kannst “Combined” wählen, um aus allen eine Basis zu bauen.
            </div>

          </aside>
        </section>

        <footer class="mix-footer">
          Blend Modes: normal, multiply, screen, overlay, difference, lighten, darken.
        </footer>
      </div>
    </template>

    <template #action>
      <v-btn ref="saveBtn" variant="outlined" :id="saveBtnId" class="btn save">
        Speichern
      </v-btn>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import {channelMixerModel, channelMixerProps} from "@/models/channel/mixer/model";
import Dialog from "@/components/Dialog/Dialog.vue";
import Canvas from "@/components/Canvas/Canvas.vue";

export default defineComponent({
  name: "MixerComponent",
  components: {Dialog, Canvas},
  props: channelMixerProps,
  setup(props, { emit }) {
    const model = channelMixerModel(props, emit);
    return { ...model };
  },
});
</script>

<style lang="scss">
@use "./_Mixer";
</style>