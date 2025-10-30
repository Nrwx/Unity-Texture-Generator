<template>
  <Dialog
      @update:component-event="emitEvent"
      :state="state"
      :data="config"
      :loading="loading"
      :theme="theme"
  >
    <template #content>
      <v-container fluid class="pa-0 setting-container">
        <v-row no-gutters class="h-100">

          <!-- ===== LEFT SIDEBAR ===== -->
          <v-col
              :cols="sidebarCollapsed ? 1 : 3"
              class="sidebar d-flex flex-column"
          >
            <div :class="!sidebarCollapsed ? 'justify-space-between pa-2' : 'justify-center'" class="sidebar-header d-flex align-center">
              <span v-if="!sidebarCollapsed" class="text-grey-lighten-1 font-weight-medium">Settings</span>
              <v-btn
                  icon
                  size="small"
                  variant="text"
                  @click="sidebarCollapsed = !sidebarCollapsed"
              >
                <v-icon>{{ sidebarCollapsed ? 'mdi-chevron-right' : 'mdi-chevron-left' }}</v-icon>
              </v-btn>
            </div>

            <v-expand-transition>
              <div v-show="!sidebarCollapsed" class="sidebar-content flex-grow-1 relative">
                <!-- Search -->
                <v-text-field
                    v-model="search"
                    density="compact"
                    placeholder="Suchen…"
                    prepend-inner-icon="mdi-magnify"
                    hide-details
                    class="ma-2"
                    variant="outlined"
                ></v-text-field>

                <!-- Category List -->
                <v-list class="menu-scrollbar" max-height="380" variant="text" density="compact" :id="scrollbars[0]" nav>

                  <Scrollbar :target="scrollbars[0]" :pulse="true" @component-event="emitEvent"/>

                  <v-list-subheader>Categories</v-list-subheader>

                  <v-list-group
                      v-for="cat in filteredCategories"
                      :key="cat.id"
                      v-model="expandedCategories[cat.id]"
                      no-action
                  >
                    <template #activator="{ props }">
                      <v-list-item v-bind="props" @click="toggleCategory(cat)">
                        <v-icon v-if="cat.icon && cat.sidebarIcon" size="18" class="mr-2">{{ cat.icon }}</v-icon>
                        <v-list-item-title>{{ cat.name }}</v-list-item-title>
                      </v-list-item>
                    </template>

                    <v-list-item
                        v-for="sub in cat.subCategories"
                        :key="sub.id"
                        @click="selectSubCategory(cat.id, sub.id)"
                        :active="selectedCategory?.id === cat.id && selectedSubCategory === sub.id"
                        class="pl-6"
                    >
                      <v-icon v-if="sub.raw.icon && sub.raw.sidebarIcon" size="16" class="mr-2 text-primary">
                        {{ sub.raw.icon }}
                      </v-icon>
                      <v-list-item-title>{{ sub.name }}</v-list-item-title>
                    </v-list-item>
                  </v-list-group>
                </v-list>

              </div>
            </v-expand-transition>

            <!-- Icon-only view when collapsed -->
            <div v-if="sidebarCollapsed" class="sidebar-icons-only flex-grow-1 relative">
              <v-list elevation="0" class="menu-scrollbar" max-height="380" :id="scrollbars[1]" variant="text" density="compact" nav>
                <Scrollbar :target="scrollbars[1]" :pulse="true" @component-event="emitEvent"/>
                <v-list-item
                    v-for="cat in filteredCategories"
                    :key="cat.id"
                    @click="selectCategory(cat)"
                    :active="selectedCategory?.id === cat.id"
                    class="d-flex justify-center"
                >
                  <v-icon size="20">{{ cat.icon }}</v-icon>
                </v-list-item>
              </v-list>
            </div>
          </v-col>

          <!-- ===== RIGHT CONTENT ===== -->
          <v-col :cols="sidebarCollapsed ? 11 : 9" class="content relative">

            <!-- Prüfen, ob Kategorie gewählt -->
            <v-card
                v-if="selectedCategory"
                class="pa-2 page-scrollbar overflow-hidden overflow-y-auto"
                :id="scrollbars[2]"
                variant="outlined"
                style="max-height: 500px; border-color: rgb(var(--v-theme-border-light)) !important"
            >
              <Scrollbar :target="scrollbars[2]" :pulse="true" @component-event="emitEvent"/>
              <!-- Sticky Hauptkategorie -->
              <div class="sticky-header bg-surface pb-2 mb-3">
                <v-card-title class="d-flex align-center">
                  <v-icon v-if="selectedCategory.icon" size="24" class="mr-2 text-primary">
                    {{ selectedCategory.icon }}
                  </v-icon>
                  <div>
                    <div class="text-h6">{{ selectedCategory.name }}</div>
                    <div class="text-body-2 text-grey-darken-1">
                      {{ selectedCategory.raw?.description || '—' }}
                    </div>
                  </div>
                </v-card-title>
                <v-divider class="mt-2"></v-divider>
              </div>

              <!-- Subkategorien -->
              <div
                  v-for="sub in selectedCategory.subCategories"
                  :key="sub.id"
                  :id="`${selectedCategory.id}-${sub.id}`"
                  class="mb-8 pa-1"
              >
                <!-- Sticky Subcategory Header -->
                <div class="sticky-sub bg-surface d-flex align-center mb-1">
                  <v-icon v-if="sub.icon" size="20" class="mr-2 text-primary">
                    {{ sub.icon }}
                  </v-icon>
                  <h4 class="text-h6 mb-0">{{ sub.name }}</h4>
                </div>
                <p class="text-body-2 text-grey-darken-1 mb-3">
                  {{ sub.raw?.description || '—' }}
                </p>

                <!-- Felder -->
                <v-form>
                  <div v-for="f in sub.raw.fields" :key="f.key" class="mb-3">
                    <v-text-field
                        v-if="f.type === 'input'"
                        :prepend-inner-icon="f.icon"
                        v-model="settings[selectedCategory.id][f.key]"
                        :label="f.title"
                        :hint="f.description"
                        persistent-hint
                        :type="typeof settings[selectedCategory.id][f.key] === 'number' ? 'number' : 'text'"
                        variant="outlined"
                        density="comfortable"
                    ></v-text-field>

                    <v-select
                        v-else-if="f.type === 'select'"
                        :prepend-inner-icon="f.icon"
                        v-model="settings[selectedCategory.id][f.key]"
                        :label="f.title"
                        :hint="f.description"
                        persistent-hint
                        :items="f.options"
                        variant="outlined"
                        density="comfortable"
                    ></v-select>

                    <v-switch
                        v-else-if="f.type === 'toggle'"
                        v-model="settings[selectedCategory.id][f.key]"
                        :label="f.title"
                        :hint="f.description"
                        inset
                        class="mt-2"
                    ></v-switch>

                    <StarRating
                        v-else-if="f.type === 'star-rating'"
                        :rating="setting?.system_rating"
                        :score="setting?.system_score"
                        :recommended="{recommended_cpu_threads: setting?.recommended_cpu_threads, recommended_gpu_gb: setting?.recommended_gpu_gb, recommended_ram_gb: setting?.recommended_ram_gb}"
                        :theme="theme"
                        class="mt-2"
                    ></StarRating>

                    <Cache
                        v-else-if="f.type === 'cache-module'"
                        :data="{assets: setting?.asset_files, session: setting?.session_files, cache: setting?.cache_files, total: setting?.total_files}"
                        :theme="theme"
                        :projectId="projectId"
                        @component-event="emitEvent"
                    />

                    <Task
                        v-else-if="f.type === 'task-module'"
                        :tasks="tasks"
                        :edit="taskEdit"
                        :edit-loading="taskEditLoading"
                        :theme="theme"
                        @component-event="emitEvent"
                    />

                    <TaskOverview
                        v-else-if="f.type === 'task-overview-module'"
                        :theme="theme"
                        :meta="tasksMeta"
                        @component-event="emitEvent"
                    />

                    <TaskControl
                        v-else-if="f.type === 'task-control-module'"
                        :theme="theme"
                        :meta="tasksMeta"
                        @component-event="emitEvent"
                    />

                    <TaskLog
                        v-else-if="f.type === 'task-log-module'"
                        :theme="theme"
                        :meta="tasksMeta"
                        @component-event="emitEvent"
                    />

                    <TaskSummary
                        v-else-if="f.type === 'task-summary-module'"
                        :theme="theme"
                        :meta="tasksMeta"
                        @component-event="emitEvent"
                    />
                  </div>
                </v-form>
              </div>
            </v-card>

            <!-- Platzhalter wenn keine Kategorie gewählt -->
            <v-card v-else class="pa-4 mb-3" variant="outlined">
              <p class="text-grey">Select a category to view or modify settings.</p>
            </v-card>

          </v-col>

        </v-row>
      </v-container>
    </template>

    <template #action>
      <v-btn color="primary" @click="emitEvent('save-setting', settings)">Save</v-btn>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import {settingModel, settingProps} from "@/models/setting/model";
import Dialog from "@/components/Dialog/Dialog.vue";
import StarRating from "@/components/Rating/Star.vue";
import Cache from "@/components/Cache/Cache.vue";
import Task from "@/components/Task/Task.vue";
import TaskOverview from "@/components/Task/Overview.vue";
import TaskControl from "@/components/Task/Control.vue";
import TaskLog from "@/components/Task/Log.vue";
import TaskSummary from "@/components/Task/Summary.vue";
import Scrollbar from "@/components/Scrollbar/Scrollbar.vue";

export default defineComponent({
  name: "SettingComponent",
  components: {Scrollbar, TaskSummary, TaskLog, TaskControl, TaskOverview, Task, Cache, StarRating, Dialog },
  props: settingProps,
  setup(props, { emit }) {
    const model = settingModel(props, emit);
    return {...model};
  },
});
</script>

<style scoped lang="scss">
@use "./_Setting";
</style>