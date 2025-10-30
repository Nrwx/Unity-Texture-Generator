<template>
  <div class="fragment summary">
    <div class="header">
      <h4>Summary & Relations</h4>
      <p class="sub text-caption">Aggregierte Metriken, Trends & Beziehungen</p>
    </div>

    <div class="layout">
      <div class="left">
        <div class="cards">
          <div class="card large">
            <div class="card-head">
              <div><strong>Total Tasks</strong></div>
              <div class="big">{{ meta.total_tasks || 0 }}</div>
            </div>
            <div class="card-body">
              <div class="pill-row">
                <div class="pill">
                  <div class="k">Default</div><div class="v">{{ meta.default_tasks || 0 }}</div>
                </div>
                <div class="pill">
                  <div class="k">Custom</div><div class="v">{{ meta.custom_tasks || 0 }}</div>
                </div>
                <div class="pill">
                  <div class="k">Chains</div><div class="v">{{ meta.tasks_with_custom_chain || 0 }}</div>
                </div>
              </div>
              <div class="trend">
                <Bar :theme="theme" :value="meta.tasks_progress_avg || 0" :max="100" title="Overall Progress" description="Trend" :metaText="trendText" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="right">
        <div class="insights">
          <div class="insight-card">
            <h4>Insight</h4>
            <p v-if="meta.total_tasks">Von {{ meta.total_tasks }} Tasks sind {{ Math.round((meta.failed_tasks||0)/(meta.total_tasks||1) * 100) }}% fehlgeschlagen.</p>
            <p v-else>Keine Tasks vorhanden — alles ruhig.</p>
          </div>

          <div class="insight-card">
            <h4>Relations</h4>
            <p>Visualisiert wie Tasks-Status miteinander verlinkt sind (Running → Completed, Pending → Failed usw.).</p>
          </div>
        </div>

        <div class="card grid2 mt-2">
          <div class="mini-card">
            <div class="label text-truncate">Active</div>
            <div class="val">{{ meta.active_task_count || 0 }}</div>
          </div>
          <div class="mini-card">
            <div class="label text-truncate">Running</div>
            <div class="val">{{ meta.running_tasks_count || 0 }}</div>
          </div>
          <div class="mini-card">
            <div class="label text-truncate">Pending</div>
            <div class="val">{{ meta.pending_tasks || 0 }}</div>
          </div>
          <div class="mini-card">
            <div class="label text-truncate">Failed</div>
            <div class="val">{{ meta.failed_tasks || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="header mt-4">
      <h4>Prozessverlauf</h4>
      <p class="sub text-caption">Historie zu Ihrem Aufgabenergebnissen.</p>
    </div>

    <div class="relations-card">
      <Relation :theme="theme" :width="'100%'" :height="'100%'" :meta="meta" />
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import Relation from "@/components/Bars/Relation.vue";
import Bar from "@/components/Bars/Bar.vue";
import {taskSummaryModel, taskSummaryProps} from "@/models/tasks/summary/model";

export default defineComponent({
  name: "TaskSummaryComponent",
  props: taskSummaryProps,
  components: { Relation, Bar },
  setup(props, { emit }) {
    return taskSummaryModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Summary";
</style>
