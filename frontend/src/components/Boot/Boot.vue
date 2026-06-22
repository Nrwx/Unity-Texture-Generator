<template>
  <div class="boot-loader d-flex h-100 absolute inset" v-show="state">
    <div class="boot-container d-flex align-center justify-center flex-wrap ma-auto">
      <div class="boot-left-panel flex-1-1 d-flex align-center justify-center flex-wrap">
        <div class="boot-console relative w-100 ga-3">
          <div class="boot-terminal h-100 relative pa-2 d-flex flex-wrap overflow-y-auto" :id="terminalId" ref="terminalRef" role="log" aria-live="polite">
            <div v-for="(line,i) in displayedLines" :key="i" class="term-line w-100 relative d-flex align-start ga-2">
              <span class="time">{{ line.time }}</span>
              <span class="content" v-html="line.html"></span>
            </div>
          </div>
        </div>
        <div class="boot-taskbar-collapsed cursor-auto w-100 mt-2 d-flex align-center justify-space-between ga-3" @click="toggleExpanded"
             role="button" aria-pressed="false">
          <div class="boot-taskbar-left d-flex align-center ga-3">
            <div class="grid-center"><img :src="logoUrl" alt="UG Logo" class="logo" /></div>
            <div class="bar-wrap">
              <div class="bar-track overflow-hidden rounded-pill">
                <div class="bar-fill h-100 w-0 rounded-pill" :style="{ width: pct + '% !important' }"></div>
              </div>
              <div class="bar-meta mt-2 d-flex align-center justify-space-between">
                <span class="bar-pct mr-2">{{ pct }}%</span>
                <span class="ps-msg">{{ topMessage }}</span>
              </div>
            </div>
          </div>
          <div class="boot-taskbar-center d-flex align-center justify-center">
            <div class="spinner grid-center" :class="{ spinning: spinningActive }" aria-hidden="true">
              <svg viewBox="0 0 50 50" class="spinner-svg" aria-hidden="true">
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0" stop-color="#00ffd5"/>
                    <stop offset="1" stop-color="#ff59d6"/>
                  </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="18" fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round"
                        stroke-dasharray="90" stroke-dashoffset="60"/>
              </svg>
            </div>
          </div>
          <div class="boot-taskbar-right d-flex align-center ga-2">
            <div class="ps-timeline-mini d-flex align-center ga-2">
              <div v-for="(t,i) in timelinePreview" :key="i" class="tmini-item d-flex align-center ga-1">
                <span class="d-inline-block rounded-circle" :class="['dot', dotClass(t.status)]"></span>
                <span class="tlabel">{{ t.label }}</span>
              </div>
            </div>
            <button class="toggle cursor-pointer" @click.stop="toggleExpanded" :aria-expanded="expanded">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M12 16l-6-6h12z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="boot-right-panel ml-3">
        <div class="timeline overflow-auto pa-2">
          <div v-for="(node) in timeline" :key="node.key" class="node d-flex align-start ga-2">
            <div class="grid-center rounded-sm" :class="['mark', nodeClass(node.status)]">
              <svg v-if="node.status === 'ok'" viewBox="0 0 24 24" class="icon">
                <path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 20 8l-1.4-1.4z"/>
              </svg>
              <svg v-else-if="node.status === 'fail'" viewBox="0 0 24 24" class="icon">
                <path fill="currentColor"
                      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <div class="node-body">
              <div class="node-title">{{ node.label }}</div>
              <div class="node-sub">{{ node.sub || '' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="boot-progress-large w-100 mt-6">
        <div class="progress-track overflow-hidden rounded-pill">
          <div class="progress-fill h-100 w-0" :style="{ width: pct + '% !important' }"></div>
        </div>
        <div class="progress-info d-flex align-center justify-space-between">
          <div class="ps-left-info">
            <div class="ps-title">Boot Progress</div>
            <div class="ps-meta">{{ processedCount }} / {{ totalCountDisplay }} items</div>
          </div>
          <div class="ps-right-info">
            <div class="ps-pct-large">{{ pct }}%</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import {defineComponent} from "vue";
import {bootModel, bootProps} from "@/models/boot/model";

export default defineComponent({
  name: "BootComponent",
  props: bootProps,
  setup(props, {emit}) {
    const model = bootModel(props, emit);

    return {
      ...model
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Boot";
</style>
