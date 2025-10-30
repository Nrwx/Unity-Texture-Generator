<template>
  <div class="star-rating" :class="theme">
    <div class="top-row">
      <div class="stars" :aria-label="`Score ${percent}%`" role="img">
        <svg
            v-for="i in 5"
            :key="i"
            class="star-svg"
            viewBox="0 0 24 24"
            :width="size"
            :height="size"
            xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath :id="`${uid}-clip-${i}`">
              <!-- viewBox ist 24x24, daher in px rechnen -->
              <rect x="0" y="0" :width="24 * starFraction(percent, i - 1)" height="24" />
            </clipPath>
          </defs>

          <!-- gefüllter Stern (wird geclippt auf Bruchteil) -->
          <path
              :clip-path="`url(#${uid}-clip-${i})`"
              class="star-fill"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />

          <!-- Outline immer sichtbar -->
          <path
              class="star-outline"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />
        </svg>
      </div>

      <div class="score-meta">
        <div class="percent">{{ percent }}%</div>
        <div v-if="ratingDisplay" class="rating-badge" :class="ratingClass">{{ ratingDisplay }}</div>
      </div>
    </div>

    <div class="below-stars">
      <div v-if="percent >= 90" class="compat">✅ <strong>System kompatibel</strong></div>
      <div v-else-if="percent < 50" class="warning">⚠️ <strong>Hardwarevoraussetzungen nicht erfüllt</strong></div>
    </div>

    <!-- Collapsible mit recommended (read-only). Öffnet automatisch wenn percent < 50 -->
    <details ref="detailsRef" :open="panelOpen" class="minreq" @toggle="onToggle">
      <summary class="summary">Mindestvoraussetzungen <small class="summary-note"><v-icon size="20">{{ panelOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}}</v-icon></small></summary>

      <div class="minreq-grid">
        <div class="minreq-item">
          <div class="label">CPU-Threads</div>
          <div class="value">{{ recommended?.recommended_cpu_threads ?? '—' }}</div>
        </div>

        <div class="minreq-item">
          <div class="label">GPU (GB)</div>
          <div class="value">{{ recommended?.recommended_gpu_gb ?? '—' }}</div>
        </div>

        <div class="minreq-item">
          <div class="label">RAM (GB)</div>
          <div class="value">{{ recommended?.recommended_ram_gb ?? '—' }}</div>
        </div>
      </div>
    </details>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {starRatingModel, starRatingProps} from "@/models/rating/star/model";

export default defineComponent({
  name: "StarRatingComponent",
  props: starRatingProps,
  setup(props, { emit }) {
    const {
      emitEvent,
      percent,
      ratingDisplay,
      ratingClass,
      uid,
      panelOpen,
      detailsRef,
      starFraction,
      onToggle
    } = starRatingModel(props, emit);
    return {
      emitEvent,
      percent,
      ratingDisplay,
      ratingClass,
      uid,
      panelOpen,
      detailsRef,
      starFraction,
      onToggle
    };
  },
});
</script>

<style scoped lang="scss">
@import "./Star";
</style>
