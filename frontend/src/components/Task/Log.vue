<template>
  <div class="fragment logging">
    <div class="header">
      <h4>Task Logs (Ledger Style)</h4>
      <p class="sub text-caption">Dokumentarische Auflistung: Zeitstempel, Status & Details</p>
    </div>

    <div class="top-cards">
      <div class="card stat">
        <div class="k">Logs</div>
        <div class="v">{{ meta.logs?.length || 0 }}</div>
        <div class="subl">Gesamt-Einträge</div>
      </div>
      <div class="card stat">
        <div class="k">Letzter Log</div>
        <div class="v">{{ lastLogTime }}</div>
        <div class="subl">zuletzt aktualisiert</div>
      </div>
      <div class="card stat">
        <div class="k">Fehler</div>
        <div class="v">{{ meta.failed_tasks || 0 }}</div>
        <div class="subl">Fehlgeschlagene Tasks</div>
      </div>
    </div>

    <div class="ledger">
      <div class="ledger-header align-center">
        <div class="col ts">Timestamp</div>
        <div class="col id">Task / Module</div>
        <div class="col state">State</div>
        <div class="col prog">Progress</div>
        <div class="col details">Details</div>
      </div>

      <div class="ledger-body">
        <div v-for="(l, idx) in logSlice" :key="l.id + '-' + idx" class="ledger-row align-center" :class="rowClass(l)">
          <div class="col ts text-truncate">{{ formatTime(l?.updated||l?.created) }}</div>
          <div class="col id"><strong>{{ l.module || l.id }}</strong><div class="subid text-truncate">{{ l.id }}</div></div>
          <div class="col state text-truncate">{{ l.state }}</div>
          <div class="col prog">
            <div class="pwrap">
              <div class="pbar" :style="{ width: (l.progress||0) + '%' }"></div>
            </div>
            <div class="ppct">{{ l.progress || 0 }}%</div>
          </div>
          <div class="col details">
            <div class="msg">{{ l?.message || l?.logs || '' }}</div>
            <div v-if="l.context" class="ctx">Context: {{ l.context }}</div>
          </div>
        </div>

        <div v-if="!(meta.logs || []).length" class="empty">Noch keine Logs vorhanden.</div>
      </div>

      <div class="pager">
        <button type="button" @click="prevPage" :disabled="page===0">Prev</button>
        <div class="pageinfo">Seite {{ page+1 }} / {{ totalPages }}</div>
        <button type="button" @click="nextPage" :disabled="page>=totalPages-1">Next</button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import {taskLogModel, taskLogProps} from "@/models/tasks/log/model";

export default defineComponent({
  name: "TaskLogComponent",
  props: taskLogProps,
  setup(props, { emit }) {
    return taskLogModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "./_Log";
</style>
