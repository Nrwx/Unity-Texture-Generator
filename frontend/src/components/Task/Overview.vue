<template>
  <div class="fragment overview">
    <div class="header">
      <h4>Zusammenfassung</h4>
      <p class="sub text-caption">ihre aktuellen Task-Daten.</p>
    </div>

    <div class="grid">
      <div class="card big d-flex justify-center align-center flex-wrap">
        <Radial
            :theme="theme"
            :value="meta.total_tasks || 0"
            :max="Math.max(1, (meta.total_tasks || 1))"
            :size="200"
            :text-position="'upper'"
            title="Gesamt"
            :description="`Default: ${meta.default_tasks || 0} • Custom: ${meta.custom_tasks || 0}`"
            label="Verfügbar"
        />
      </div>

      <div class="card stats d-flex align-center flex-wrap">
        <Bar
            :theme="theme"
            :value="meta.tasks_progress_avg || 0"
            :max="100"
            title="Durchschnittlicher Fortschritt"
            description="Durchschnitt aller Tasks"
            suffix=""
            :metaText="`${(meta.tasks_progress_avg||0).toFixed(1)}%`"
        />

        <div class="small-grid mt-2">
          <div class="mini">
            <div class="num">{{ meta.active_task_count || 0 }}</div>
            <div class="label">Aktiv</div>
          </div>
          <div class="mini">
            <div class="num">{{ meta.running_tasks_count || 0 }}</div>
            <div class="label">Running</div>
          </div>
          <div class="mini">
            <div class="num">{{ meta.pending_tasks || 0 }}</div>
            <div class="label">Pending</div>
          </div>
          <div class="mini">
            <div class="num">{{ meta.completed_tasks || 0 }}</div>
            <div class="label">Complete</div>
          </div>
          <div class="mini">
            <div class="num">{{ meta.failed_tasks || 0 }}</div>
            <div class="label">Failed</div>
          </div>
        </div>
      </div>

      <div class="card list">
        <div class="card-title">Default Tasks</div>
        <div class="chips">
          <span v-for="(d,i) in defaultList" :key="i" class="chip">{{ d }}</span>
        </div>

        <div class="meta-row">
          <div>Tasks with Chains</div>
          <div class="bold">{{ meta.tasks_with_custom_chain || 0 }}</div>
        </div>

        <div class="meta-row small">
          <div>Letzte Aktualisierung</div>
          <div>{{ formattedLastUpdated }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import Radial from "@/components/Bars/Radial.vue";
import Bar from "@/components/Bars/Bar.vue";
import {taskOverviewModel, taskOverviewProps} from "@/models/tasks/overview/model";

export default defineComponent({
  name: "TaskOverviewComponent",
  props: taskOverviewProps,
  components: { Radial, Bar },
  setup(props, { emit }) {
    return taskOverviewModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Overview";
</style>
