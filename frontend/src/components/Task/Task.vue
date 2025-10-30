<template>
  <div class="tm-container">
    <div class="tm-header">
      <div class="title">
        <h4>Verfügbare Tasks</h4>
        <p class="sub text-caption">Verwenden Sie bestehende Tasks oder erstellen Sie neue Aufgaben.</p>
      </div>

      <div class="tm-header-actions">
        <v-btn variant="flat" color="transparent" max-width="32" max-height="32" title="Aktualisieren" icon @click="emitEvent('task:fetch-list')">
          <v-icon size="16">mdi-refresh</v-icon>
        </v-btn>
        <v-btn variant="flat" class="primary" title="Neue Aufgabe" @click="openCreate">
          <v-icon size="16">mdi-plus</v-icon>
          Neue Aufgabe
        </v-btn>
      </div>
    </div>

    <div class="tm-body">
      <!-- LEFT SIDE: TASK LIST -->
      <aside class="tm-list">
        <div class="list-controls">
          <input class="search" placeholder="Search module / id / type" v-model="filterText" />
          <select v-model="filterState">
            <option value="">All states</option>
            <option value="pending">pending</option>
            <option value="running">running</option>
            <option value="complete">complete</option>
            <option value="failed">failed</option>
          </select>
        </div>

        <div class="task-table">
          <div class="task-row header">
            <div class="col-name text-truncate">Name / Module</div>
            <div class="col-type text-truncate">Type</div>
            <div class="col-default text-truncate">Default</div>
            <div class="col-active text-truncate">Active</div>
            <div class="col-state text-truncate">State</div>
            <div class="col-progress text-truncate">Progress</div>
            <div class="col-time text-truncate">Time</div>
            <div class="col-actions text-truncate">Actions</div>
          </div>

          <div
              v-for="task in visibleTasks"
              :key="task.id"
              class="task-row"
              :class="{ 'is-default': task.default }"
          >
            <div class="col-name" @click="selectTask(task)">
              <div class="title text-truncate">{{ task.module || task.type }}</div>
              <div class="meta text-truncate">{{ task.id }}</div>
            </div>

            <div class="col-type">{{ task.type }}</div>

            <div class="col-default d-flex">
              <span class="chip default text-truncate" v-if="task.default">Default</span>
              <span class="chip custom text-truncate" v-else>Custom</span>
            </div>

            <div class="col-active">
              <label class="switch">
                <input
                    type="checkbox"
                    :checked="task.active"
                    @change="emitEvent('task:update', task)"
                />
                <span class="slider"></span>
              </label>
            </div>

            <div class="col-state d-flex">
              <span class="text-truncate " :class="['state', stateClass(task.state)]">{{ task.state || 'unknown' }}</span>
            </div>

            <div class="col-progress">
              <div class="progress-wrap">
                <div class="progress-bar" :style="{ width: (task.progress || 0) + '%' }"></div>
              </div>
            </div>

            <div class="col-time">
              {{ (task.time_val === null || task.time_val === undefined) ? '-' : task.time_val }}
            </div>

            <div class="col-actions">
              <v-btn variant="flat" color="transparent" max-width="24" max-height="24" title="Aufgabe starten" icon @click="emitEvent('task:run', { id: task.id })">
                <v-icon size="12">mdi-play</v-icon>
              </v-btn>
              <v-btn variant="flat" color="transparent" max-width="24" max-height="24" title="Aufgabe planen" icon @click="openSchedule(task)">
                <v-icon size="12">mdi-calendar-clock</v-icon>
              </v-btn>
              <v-btn variant="flat" color="transparent" max-width="24" max-height="24" title="Aufgabe stoppen" icon @click="emitEvent('task:stop', { id: task.id })">
                <v-icon size="12">mdi-stop</v-icon>
              </v-btn>
              <v-btn variant="flat" color="transparent" max-width="24" max-height="24" title="Aufgabe bearbeiten" icon @click="openEdit(task)">
                <v-icon size="12">mdi-calendar-edit</v-icon>
              </v-btn>
              <v-btn variant="flat" color="transparent" max-width="24" max-height="24" title="Aufgabe löschen" icon @click="emitEvent('task:delete', { id: task.id })">
                <v-icon size="12">mdi-delete-outline</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </aside>

      <!-- DETAIL / EDITOR -->
      <Dialog
          @update:component-event="emitEvent"
          :state="edit"
          :data="editConfig"
          :loading="editLoading"
          :theme="theme"
      >
        <template #content>
          <div class="form" v-if="editing?.entry">
            <label>Type</label>
            <input type="text" v-model="editing.entry.type" />

            <label>Module</label>
            <input type="text" v-model="editing.entry.module" placeholder="module name (e.g. storage)" />

            <div class="row-2">
              <div>
                <label>Active</label>
                <input type="checkbox" v-model="editing.entry.active" />
              </div>
              <div>
                <label>State</label>
                <select v-model="editing.entry.state">
                  <option value="pending">pending</option>
                  <option value="running">running</option>
                  <option value="complete">complete</option>
                  <option value="failed">failed</option>
                </select>
              </div>
            </div>

            <label>Progress</label>
            <input type="number" v-model.number="editing.entry.progress" min="0" max="100" />
            <div class="progress-wrap small">
              <div class="progress-bar" :style="{ width: (editing.entry.progress || 0) + '%' }"></div>
            </div>

            <label>Time (seconds)</label>
            <input type="number" v-model.number="editing.entry.time_val" />

            <!-- Chain editor -->
            <label>Custom Chain</label>
            <div class="chain-editor">
              <div class="chain-controls">
                <input
                    placeholder="module name"
                    v-model="chainInput"
                    @keydown.enter.prevent="addChainItem"
                />
                <button type="button" class="icon-btn" @click="addChainItem" title="Add">+</button>
                <button type="button" @click="sortChainByTime" title="Sort by time">⤓</button>
                <button type="button" @click="resetChain" title="Clear">✖</button>
              </div>

              <div class="chain-list">
                <div v-for="(c, idx) in editing.entry.custom" :key="idx" class="chain-item">
                  <div>
                    <div class="cname">{{ c.module }}</div>
                    <div class="cmeta">
                      order: {{ c.order }}
                      <span v-if="c.time_val">• time: {{ c.time_val }}</span>
                    </div>
                  </div>
                  <div class="chain-actions">
                    <button type="button" @click="moveChainUp(idx)" :disabled="idx === 0">▲</button>
                    <button
                        @click="moveChainDown(idx)"
                        :disabled="idx === editing.entry.custom.length - 1"
                    >▼</button>
                    <button type="button" @click="removeChainItem(idx)">✖</button>
                  </div>
                </div>

                <div v-if="editing.entry.custom.length === 0" class="chain-empty">
                  No chain items
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #action>
          <v-btn variant="tonal" rounded  color="secondary" @click="cancelEditing">
            Zurück
          </v-btn>
          <v-spacer/>
          <v-btn variant="tonal" rounded  color="primary" @click="saveEditing" :disabled="saving">
            Speichern
          </v-btn>
        </template>
      </Dialog>
    </div>

    <!-- Schedule modal -->
    <div v-if="showScheduleDialog" class="modal-backdrop" @click.self="showScheduleDialog = false">
      <div class="modal">
        <h4>Schedule Task</h4>
        <label>Delay (seconds)</label>
        <input type="number" v-model.number="scheduleDelay" />
        <div class="modal-actions">
          <button type="button" class="primary" @click="confirmSchedule">Schedule</button>
          <button type="button" @click="showScheduleDialog = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import taskModel, {taskProps} from "@/models/tasks/model";
import Dialog from "@/components/Dialog/Dialog.vue";

export default defineComponent({
  name: "TaskComponent",
  props: taskProps,
  components: { Dialog },
  setup(props, { emit }) {
    return taskModel(props, emit);
  },
});
</script>

<style scoped lang="scss">
@import "_Task";
</style>
