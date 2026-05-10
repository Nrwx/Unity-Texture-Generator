<template>
  <v-card
      class="pa-3"
      variant="outlined"
      style="border-color: rgb(var(--v-theme-border-light)) !important"
  >
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-3">
      <div class="d-flex align-center">
        <v-icon size="22" class="mr-2 text-primary">mdi-puzzle</v-icon>
        <div>
          <div class="text-subtitle-1 font-weight-medium">Übersicht</div>
          <div class="text-caption text-grey-darken-1">
            Verwalte Downloads und Erweiterungs-Plugins
          </div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="refresh"
        >
          Scan
        </v-btn>

        <v-btn
            size="small"
            color="primary"
            variant="elevated"
            prepend-icon="mdi-package-down"
            :loading="loading"
            @click="installAll"
        >
          Pre-Plugins
        </v-btn>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="d-flex align-center mb-3 ga-2">
      <v-text-field
          v-model="search"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          placeholder="Plugin suchen..."
      />

      <v-select
          v-model="filter"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 180px"
          :items="filterOptions"
          item-title="title"
          item-value="value"
          label="Filter"
      />
    </div>

    <!-- Meta Cards -->
    <v-row dense class="mb-3">
      <v-col cols="6" md="3">
        <v-card variant="tonal" class="pa-3 stat-card">
          <div class="text-caption text-grey-darken-1">Plugins</div>
          <div class="text-h6 font-weight-medium">{{ pluginStats.total }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card variant="tonal" color="success" class="pa-3 stat-card">
          <div class="text-caption">Installiert</div>
          <div class="text-h6 font-weight-medium">{{ pluginStats.installed }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card variant="tonal" color="primary" class="pa-3 stat-card">
          <div class="text-caption">Laufend</div>
          <div class="text-h6 font-weight-medium">{{ pluginStats.running }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card variant="tonal" color="error" class="pa-3 stat-card">
          <div class="text-caption">Fehler</div>
          <div class="text-h6 font-weight-medium">{{ pluginStats.errors }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty -->
    <v-card
        v-if="!loading && filteredPlugins.length === 0"
        variant="tonal"
        class="pa-4 text-center"
    >
      <v-icon size="34" class="mb-2 text-grey">mdi-puzzle-outline</v-icon>
      <div class="text-body-2 text-grey-darken-1">
        Keine Plugins gefunden.
      </div>

      <v-btn
          size="small"
          class="mt-3"
          color="primary"
          variant="tonal"
          @click="installAll"
      >
        Pre-Plugins vorbereiten
      </v-btn>
    </v-card>

    <!-- Loading skeleton -->
    <div v-if="loading">
      <v-skeleton-loader
          v-for="i in 3"
          :key="i"
          class="mb-2"
          type="list-item-two-line"
      />
    </div>

    <!-- List -->
    <v-row v-else dense>
      <v-col
          v-for="plugin in filteredPlugins"
          :key="plugin.pluginId"
          cols="12"
      >
        <v-card
            variant="outlined"
            class="pa-3 plugin-card"
            style="border-color: rgb(var(--v-theme-border-light)) !important"
        >
          <div class="d-flex justify-space-between align-start plugin-card-inner">
            <div class="d-flex align-start plugin-left">
              <v-avatar
                  size="42"
                  rounded="lg"
                  color="primary"
                  variant="tonal"
                  class="mr-3"
              >
                <v-icon>{{ iconFor(plugin) }}</v-icon>
              </v-avatar>

              <div class="plugin-main">
                <div class="d-flex align-center flex-wrap ga-2">
                  <span class="text-subtitle-2 font-weight-medium">
                    {{ pluginName(plugin) }}
                  </span>

                  <v-chip
                      size="x-small"
                      variant="tonal"
                      :color="statusColor(plugin)"
                  >
                    {{ statusText(plugin) }}
                  </v-chip>

                  <v-chip
                      size="x-small"
                      variant="outlined"
                  >
                    {{ plugin.type || 'plugin' }}
                  </v-chip>

                  <v-chip
                      v-if="plugin.install === false"
                      size="x-small"
                      color="warning"
                      variant="tonal"
                  >
                    install:false
                  </v-chip>

                  <v-chip
                      size="x-small"
                      :color="plugin.active === false ? 'grey' : 'success'"
                      variant="tonal"
                  >
                    {{ plugin.active === false ? 'inaktiv' : 'aktiv' }}
                  </v-chip>
                </div>

                <div class="text-caption text-grey-darken-1 mt-1">
                  ID: {{ plugin.pluginId }}
                </div>

                <div
                    v-if="pluginPath(plugin)"
                    class="text-caption text-grey mt-1 path-line"
                >
                  {{ pluginPath(plugin) }}
                </div>

                <div
                    v-if="pluginError(plugin)"
                    class="text-caption text-error mt-2"
                >
                  {{ pluginError(plugin) }}
                </div>

                <!-- XHR / Action Tracking -->
                <div
                    v-if="hasTracking(plugin)"
                    class="mt-3 tracking-box"
                >
                  <div class="d-flex align-center justify-space-between mb-1">
                    <div class="text-caption text-grey-darken-1">
                      {{ trackingLabel(plugin) }}
                    </div>

                    <div class="text-caption text-grey">
                      {{ trackingProgress(plugin) }}%
                    </div>
                  </div>

                  <v-progress-linear
                      :model-value="trackingProgress(plugin)"
                      height="6"
                      rounded
                      :color="trackingColor(plugin)"
                      :indeterminate="trackingIndeterminate(plugin)"
                  />

                  <div class="download-meta mt-1">
                    <div
                        v-if="plugin.status?.message"
                        class="text-caption text-grey text-truncate download-message"
                    >
                      {{ plugin.status.message }}
                    </div>

                    <div class="download-stats">
                      <span
                          v-if="downloadText(plugin)"
                          class="text-caption text-grey text-no-wrap"
                      >
                        {{ downloadText(plugin) }}
                      </span>

                      <span
                          v-if="speedText(plugin) || etaText(plugin) || speedFallbackText(plugin)"
                          class="text-caption text-grey text-no-wrap"
                      >
                        <span v-if="speedText(plugin)">{{ speedText(plugin) }}</span>
                        <span v-else-if="speedFallbackText(plugin)">{{ speedFallbackText(plugin) }}</span>
                        <span v-if="speedText(plugin) && etaText(plugin)"> · </span>
                        <span v-if="etaText(plugin)">{{ etaText(plugin) }}</span>
                      </span>

                      <span
                          v-if="networkText(plugin)"
                          class="text-caption text-grey text-no-wrap"
                      >
                        WLAN {{ networkText(plugin) }}
                      </span>
                    </div>
                  </div>

                  <div
                      v-if="downloadProblemText(plugin)"
                      class="text-caption mt-1"
                      :class="plugin.status?.phase === 'error' ? 'text-error' : 'text-warning'"
                  >
                    {{ downloadProblemText(plugin) }}
                  </div>
                </div>
              </div>
            </div>

            <div class="d-flex align-center ga-2 plugin-actions">
              <v-btn
                  size="small"
                  variant="text"
                  icon="mdi-information-outline"
                  title="Details"
                  @click="selectPlugin(plugin)"
              />

              <v-btn
                  size="small"
                  variant="text"
                  :color="plugin.active === false ? 'grey' : 'success'"
                  :icon="plugin.active === false ? 'mdi-toggle-switch-off-outline' : 'mdi-toggle-switch-outline'"
                  :title="plugin.active === false ? 'Aktivieren' : 'Deaktivieren'"
                  :loading="actionId === `${plugin.pluginId}:toggle`"
                  :disabled="isRunning(plugin) || isPauseRequested(plugin)"
                  @click="toggle(plugin)"
              />

              <v-btn
                  v-if="isRunning(plugin) || isPauseRequested(plugin)"
                  size="small"
                  variant="text"
                  color="warning"
                  icon="mdi-pause-circle-outline"
                  title="Download pausieren"
                  :loading="actionId === `${plugin.pluginId}:pause` || (isPauseRequested(plugin) && isRunning(plugin))"
                  :disabled="isPaused(plugin) || !isRunning(plugin)"
                  @click="pause(plugin)"
              />

              <v-btn
                  size="small"
                  variant="text"
                  color="warning"
                  icon="mdi-refresh"
                  title="Reparieren"
                  :loading="actionId === `${plugin.pluginId}:repair` || isRepairing(plugin)"
                  :disabled="isRunning(plugin) || isPauseRequested(plugin)"
                  @click="repair(plugin)"
              />

              <v-btn
                  size="small"
                  :color="installButtonColor(plugin)"
                  variant="tonal"
                  :loading="installingId === plugin.pluginId || isRunning(plugin)"
                  :disabled="isRunning(plugin) || isPauseRequested(plugin) || (isInstalled(plugin) && !pluginError(plugin) && !isPaused(plugin))"
                  @click="install(plugin)"
              >
                {{ installButtonText(plugin) }}
              </v-btn>

              <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  icon="mdi-delete-outline"
                  title="Deinstallieren"
                  :loading="actionId === `${plugin.pluginId}:uninstall`"
                  :disabled="isRunning(plugin) || isPauseRequested(plugin)"
                  @click="uninstall(plugin)"
              />
            </div>
          </div>

          <v-expand-transition>
            <div v-if="selectedId === plugin.pluginId" class="mt-3">
              <v-divider class="mb-3" />

              <v-row dense>
                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Root</div>
                  <div class="text-body-2 path-line">
                    {{ plugin.root || plugin.paths?.root || '—' }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Manifest</div>
                  <div class="text-body-2 path-line">
                    {{ plugin.manifest || '—' }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Quelle</div>
                  <div class="text-body-2">
                    {{ plugin.source || plugin.data?.source || '—' }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Status</div>
                  <div class="text-body-2">
                    installed={{ plugin.status?.installed ?? false }},
                    saved={{ plugin.status?.saved ?? false }},
                    skipped={{ plugin.status?.skipped ?? false }},
                    xhr={{ plugin.status?.xhr ?? false }},
                    running={{ plugin.status?.running ?? false }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Aktion</div>
                  <div class="text-body-2">
                    {{ plugin.status?.action || '—' }}
                    <span v-if="plugin.status?.phase">
                      / {{ plugin.status.phase }}
                    </span>
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Fortschritt</div>
                  <div class="text-body-2">
                    {{ trackingProgress(plugin) }}%
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Downloadgröße</div>
                  <div class="text-body-2">
                    {{ downloadText(plugin) || '—' }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Geschwindigkeit</div>
                  <div class="text-body-2">
                    {{ speedText(plugin) || speedFallbackText(plugin) || '—' }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Verbleibend</div>
                  <div class="text-body-2">
                    {{ etaText(plugin) || '—' }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Pause</div>
                  <div class="text-body-2">
                    paused={{ plugin.status?.paused ?? false }},
                    requested={{ plugin.status?.pauseRequested ?? false }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Bytes intern</div>
                  <div class="text-body-2">
                    present={{ formatBytes(plugin.status?.presentBytes || 0) }},
                    monitor={{ formatBytes(plugin.status?.monitorBytes || 0) }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Cache / Final</div>
                  <div class="text-body-2">
                    cache={{ formatBytes(plugin.status?.partialCacheBytes || 0) }},
                    final={{ formatBytes(plugin.status?.finalPresentBytes || 0) }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Dateien</div>
                  <div class="text-body-2">
                    {{ plugin.status?.completeFileCount ?? 0 }}
                    / {{ plugin.status?.expectedFileCount ?? 0 }} vollständig
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Fehlende Dateien</div>
                  <div class="text-body-2">
                    {{ plugin.status?.missingFileCount ?? 0 }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Partielle Dateien</div>
                  <div class="text-body-2">
                    {{ plugin.status?.partialFileCount ?? 0 }}
                  </div>
                </v-col>

                <v-col
                    cols="12"
                    v-if="Array.isArray(plugin.status?.missingFiles) && plugin.status.missingFiles.length"
                >
                  <div class="text-caption text-grey">Fehlt</div>
                  <div class="file-list mt-1">
                    <v-chip
                        v-for="file in plugin.status.missingFiles.slice(0, 8)"
                        :key="file"
                        size="x-small"
                        variant="tonal"
                        color="warning"
                        class="mr-1 mb-1"
                    >
                      {{ file }}
                    </v-chip>
                  </div>
                </v-col>

                <v-col
                    cols="12"
                    v-if="Array.isArray(plugin.status?.partialFiles) && plugin.status.partialFiles.length"
                >
                  <div class="text-caption text-grey">Partiell</div>
                  <div class="file-list mt-1">
                    <v-chip
                        v-for="file in plugin.status.partialFiles.slice(0, 8)"
                        :key="file.path || file"
                        size="x-small"
                        variant="tonal"
                        color="error"
                        class="mr-1 mb-1"
                    >
                      {{ file.path || file }}
                    </v-chip>
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Gestartet</div>
                  <div class="text-body-2">
                    {{ formatTime(plugin.status?.startedAt) }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Heartbeat</div>
                  <div class="text-body-2">
                    {{ formatTime(plugin.status?.heartbeatAt) }}
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="text-caption text-grey">Beendet</div>
                  <div class="text-body-2">
                    {{ formatTime(plugin.status?.finishedAt) }}
                  </div>
                </v-col>

                <v-col cols="12" v-if="plugin.status?.message">
                  <div class="text-caption text-grey">Meldung</div>
                  <div class="text-body-2">
                    {{ plugin.status.message }}
                  </div>
                </v-col>
              </v-row>
            </div>
          </v-expand-transition>
        </v-card>
      </v-col>
    </v-row>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import { pluginModel, pluginProps } from "@/models/plugin/model";

export default defineComponent({
  name: "PluginManager",
  props: pluginProps,
  setup(props, { emit }) {
    const model = pluginModel(props, emit);

    return {
      ...model,
    };
  },
});
</script>

<style scoped lang="scss">
@use "./_Plugin";

.plugin-card {
  transition:
      border-color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
}

.plugin-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.plugin-card-inner {
  gap: 12px;
}

.plugin-left {
  min-width: 0;
  flex: 1 1 auto;
}

.plugin-main {
  min-width: 0;
  flex: 1 1 auto;
}

.plugin-actions {
  flex-shrink: 0;
}

.path-line {
  word-break: break-all;
  font-family: monospace;
  font-size: 12px;
}

.tracking-box {
  max-width: 680px;
}

.stat-card {
  height: 100%;
}

.file-list {
  max-height: 96px;
  overflow: auto;
}

.download-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.download-message {
  min-width: 0;
  flex: 1 1 auto;
}

.download-stats {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
}

@media (max-width: 720px) {
  .plugin-card-inner {
    flex-direction: column;
  }

  .plugin-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
    width: 100%;
  }

  .tracking-box {
    max-width: 100%;
  }

  .download-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .download-stats {
    justify-content: flex-start;
  }
}
</style>