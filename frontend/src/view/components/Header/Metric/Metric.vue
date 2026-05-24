<template>
  <div class="header-metric d-flex align-center ga-3 w-100">
    <!-- COPY / TITLE -->
    <section class="metric-copy d-flex flex-column ml-0 mr-auto">
      <template v-if="activeMetric.eyebrow">
        <v-slide-y-transition mode="out-in">
          <span :key="`eyebrow-${copyKey}`">
            {{ activeMetric.eyebrow }}
          </span>
        </v-slide-y-transition>

        <div class="metric-copy-head">
          <strong>{{ activeMetric.title }}</strong>

          <section
              v-if="showMetricSlider"
              class="metric-switch"
          >
            <button
                type="button"
                aria-label="Vorherige Statistik"
                @click="handlePreviousMetric"
            >
              <v-icon size="11">mdi-chevron-left</v-icon>
            </button>

            <small>{{ metricIndex + 1 }} / {{ metrics.length }}</small>

            <button
                type="button"
                aria-label="Nächste Statistik"
                @click="handleNextMetric"
            >
              <v-icon size="11">mdi-chevron-right</v-icon>
            </button>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="metric-copy-head">
          <strong>{{ activeMetric.title }}</strong>

          <section
              v-if="showMetricSlider"
              class="metric-switch"
          >
            <button
                type="button"
                aria-label="Vorherige Statistik"
                @click="handlePreviousMetric"
            >
              <v-icon size="11">mdi-chevron-left</v-icon>
            </button>

            <small>{{ metricIndex + 1 }} / {{ metrics.length }}</small>

            <button
                type="button"
                aria-label="Nächste Statistik"
                @click="handleNextMetric"
            >
              <v-icon size="11">mdi-chevron-right</v-icon>
            </button>
          </section>
        </div>

        <v-slide-y-reverse-transition mode="out-in">
          <span :key="`subtitle-${copyKey}`">
            {{ activeMetric.subtitle }}
          </span>
        </v-slide-y-reverse-transition>
      </template>
    </section>

    <!-- VALUE / METRIC -->
    <v-slide-x-reverse-transition mode="out-in">
      <div
          :key="`metric-${metricKey}`"
          class="metric-value d-flex align-center"
      >
        <!-- ACTION BUTTON -->
        <section
            v-if="activeMetric.type === 'button'"
            class="action ml-0 mr-0"
        >
          <button
              type="button"
              class="mem-ghost-btn"
              :disabled="activeMetric.disabled"
              @click="$emit('click')"
          >
            {{ activeMetric.label }}
          </button>
        </section>

        <!-- TEXT CHIP -->
        <section
            v-else-if="activeMetric.type === 'text'"
            class="badge ml-0 mr-0"
            :class="{ active: activeMetric.active }"
        >
          {{ activeMetric.label }}
        </section>

        <!-- COUNTER CHIP -->
        <section
            v-else-if="activeMetric.type === 'counter'"
            class="badge ml-0 mr-0"
            :class="{ active: activeMetric.active }"
        >
          {{ metricValueLabel }}
        </section>

        <!-- LINEAR PROGRESS -->
        <section
            v-else-if="activeMetric.type === 'linear'"
            class="linear ml-0 mr-0"
            :class="{ active: activeMetric.active }"
        >
          <div>
            <strong>{{ metricValueLabel }}</strong>
            <span>{{ progressPercent }}%</span>
          </div>

          <v-progress-linear
              :model-value="progressPercent"
              height="5"
              rounded
          />
        </section>

        <!-- RADIAL PROGRESS -->
        <section
            v-else-if="activeMetric.type === 'radial'"
            class="radial ml-0 mr-0"
            :class="{ active: activeMetric.active }"
        >
          <v-progress-circular
              :model-value="progressPercent"
              :size="34"
              :width="4"
          >
            <small>{{ progressPercent }}%</small>
          </v-progress-circular>
        </section>
      </div>
    </v-slide-x-reverse-transition>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {
  headerMetricEmits,
  headerMetricModel,
  headerMetricProps,
} from "@/view/models/components/header/metric/model";

export default defineComponent({
  name: "HeaderStatusMetric",
  props: headerMetricProps,
  emits: headerMetricEmits,
  setup(props) {
    return {
      ...headerMetricModel(props),
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Metric";
</style>