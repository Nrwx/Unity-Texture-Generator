<template>
  <div class="cache-component" :class="theme">
    <v-card variant="text" :theme="theme">
      <div class="d-flex justify-space-between align-center mb-4">
        <div class="meta-right" v-if="total.files !== 0">
          <div class="meta-text">
            <strong>{{ total.files }}</strong> Dateien • <strong>{{ fmtMb(total.size_mb) }} MB</strong>
          </div>
        </div>
        <div class="d-flex align-center">
          <v-btn variant="tonal" max-width="32" max-height="32" title="Aktualisieren" icon @click="onRefresh">
            <v-icon size="16">mdi-refresh</v-icon>
          </v-btn>
          <v-btn class="ml-3" variant="outlined" color="error" max-width="32" max-height="32" title="Cache löschen" icon :disabled="!canClearCacheGlobally" @click="onClearCache">
            <v-icon size="16">mdi-delete</v-icon>
          </v-btn>
        </div>
      </div>

      <div class="d-flex flex-wrap ga-2">
        <div class="left-col flex-1-1">
          <div class="total-title mb-3">Speicher-Auslastung</div>

          <!-- center radial (ring) overlay -->
          <div class="radial-wrap cursor-none d-flex align-center justify-center ml-auto mr-auto" aria-hidden="false">
            <svg viewBox="0 0 200 200" class="radial-svg overflow-visible" role="img" :aria-label="radialAria">
              <defs>
                <!-- optional defs -->
              </defs>

              <g transform="rotate(-90 100 100)">
                <!-- background ring -->
                <circle class="ring-bg" cx="100" cy="100" r="88" />

                <!-- asset circle -->
                <circle
                    class="arc asset-arc"
                    cx="100" cy="100" r="88"
                    :stroke-width="10"
                    :stroke-dasharray="arcDash.asset"
                    :stroke-dashoffset="arcOffset.asset"
                />

                <!-- session circle -->
                <circle
                    class="arc session-arc"
                    cx="100" cy="100" r="88"
                    :stroke-width="10"
                    :stroke-dasharray="arcDash.session"
                    :stroke-dashoffset="arcOffset.session"
                />

                <!-- cache circle -->
                <circle
                    class="arc cache-arc"
                    cx="100" cy="100" r="88"
                    :stroke-width="10"
                    :stroke-dasharray="arcDash.cache"
                    :stroke-dashoffset="arcOffset.cache"
                />
              </g>
            </svg>

            <div class="radial-center absolute cursor-none rounded-circle d-flex align-center flex-column justify-center">
              <div class="files-count">{{ total.files }}</div>
              <div class="files-sub">Dateien • {{ fmtMb(total.size_mb) }} MB</div>
            </div>
          </div>

          <div class="total-gauge relative d-flex align-center overflow-hidden" role="img" :aria-label="`Total: ${total.files} Dateien, ${fmtMb(total.size_mb)} MB`">
            <div
                class="segment h-100 asset-gradient"
                :style="{width: `${segWidths.asset}%`}"
            />
            <div
                class="segment h-100 session-gradient"
                :style="{width: `${segWidths.session}%`}"
            />
            <div
                class="segment h-100 cache-gradient"
                :style="{width: `${segWidths.cache}%`}"
            />
          </div>

          <div class="legend mt-3 d-flex ga-3 mt-2">
            <div class="legend-item d-flex align-center">
              <span class="legend-swatch d-inline-block mr-2 asset-gradient"></span> System
            </div>
            <div class="legend-item d-flex align-center">
              <span class="legend-swatch d-inline-block mr-2 session-gradient"></span> Session
            </div>
            <div class="legend-item d-flex align-center">
              <span class="legend-swatch d-inline-block mr-2 cache-gradient"></span> Cache
            </div>
          </div>
        </div>

        <div class="right-col flex-1-1">
          <div class="pill-list d-flex flex-column ga-4">
            <div class="pill-item d-flex flex-wrap align-center pa-2"
                 :class="item?.color ? ' ' + item.color : ''"
                 v-for="item in pillItems"
                 :key="item.key">
              <div class="pill-meta flex-1-1">
                <div class="pill-title">{{ item.title }}</div>
              </div>

              <div class="pill-stats text-right flex-1-1">
                <div class="pct">{{ item.value.percent }}%</div>
                <div class="files-pct">{{ filePercents[item.key] }}% Dateien</div>
              </div>

              <div class="pill-gauge w-100 d-flex align-center justify-center flex-1-1-100">
                <div class="pill-bg overflow-hidden relative flex-1-1 rounded-pill">
                  <div
                      class="pill-fill h-100 rounded-pill animated-fill"
                      :class="item?.class ? ' ' + item.class : ''"
                      :style="{width: `${fillWidths[item.key]}%`}"
                  />
                  <div class="pill-pattern absolute inset cursor-none"></div>
                </div>
                <div class="pill-sub absolute">{{ item.value.files }} Dateien • {{ fmtMb(item.value.size_mb) }} MB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { cacheModel, cacheProps } from "@/models/cache/model";

export default defineComponent({
  name: "CacheComponent",
  props: cacheProps,
  setup(props, { emit }) {
    const model = cacheModel(props, emit);

    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Cache";
</style>
