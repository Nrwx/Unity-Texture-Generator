<template>
  <div class="fragment control">
    <div class="header">
      <h4>Task Steuerung</h4>
      <p class="sub text-caption">Direkte Aktionen & Kontrolle über laufende Tasks</p>
    </div>

    <div class="grid">
      <div class="card action">
        <div class="row">
          <div>
            <div class="label">Active tasks</div>
            <div class="big">{{ meta.active_task_count || 0 }}</div>
            <div class="desc">Aktivierte System- & Benutzeraufträge</div>
          </div>

          <div class="buttons">
            <button type="button" class="btn primary" @click="emitEvent('tasks:refresh')">Refresh</button>
            <button type="button" class="btn" @click="emitEvent('tasks:run-all')">Run All</button>
            <button type="button" class="btn danger" @click="emitEvent('tasks:stop-all')">Stop All</button>
          </div>
        </div>

        <div class="live">
          <Bar
              :theme="theme"
              :value="meta.tasks_progress_avg || 0"
              :max="100"
              title="System Progress"
              description="Aggregierter Fortschritt"
              :metaText="progressMeta"
          />
        </div>
      </div>

      <div class="card smalllist">
        <div class="card-title">Running Tasks</div>
        <ul>
          <li v-for="id in (meta.running_task_ids || []).slice(0,8)" :key="id">
            <span class="dot"></span> <span class="id">{{ id }}</span>
          </li>
          <li v-if="!(meta.running_task_ids || []).length" class="empty">Keine laufenden Tasks</li>
        </ul>

        <div class="meta-stats">
          <div><strong>{{ meta.running_tasks_count || 0 }}</strong> Running</div>
          <div><strong>{{ meta.pending_tasks || 0 }}</strong> Pending</div>
          <div><strong>{{ meta.failed_tasks || 0 }}</strong> Failed</div>
        </div>
      </div>

      <div class="card actions-log">
        <div class="card-title">Quick Actions</div>
        <div class="actions">
          <button type="button" @click="emitEvent('task:create-sample')" class="btn">Create Sample Task</button>
          <button type="button" @click="emitEvent('task:clear-failed')" class="btn">Clear Failed</button>
          <button type="button" @click="emitEvent('task:archive-completed')" class="btn">Archive Completed</button>
        </div>

        <div class="hint">Hinweis: Aktionen erzeugen Events, die vom Parent verarbeitet werden.</div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import Bar from "@/components/Bars/Bar.vue";
import {taskControlModel, taskControlProps} from "@/models/tasks/control/model";

export default defineComponent({
  name: "TaskControlComponent",
  props: taskControlProps,
  components: { Bar },
  setup(props, { emit }) {
    return taskControlModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Control";
</style>
