<template>
  <div
      class="plugin-shell"
  >

    <!-- Header -->
    <div class="plugin-header">
      <div class="plugin-header__left">
        <div class="plugin-header__icon">
          <v-icon size="24">mdi-puzzle</v-icon>
        </div>

        <div>
          <div class="plugin-header__eyebrow">Plugin Control Center</div>
          <div class="plugin-header__title">Übersicht</div>
          <div class="plugin-header__subtitle">
            Verwalte Downloads, Erweiterungen und lokale Plugin-Daten.
          </div>
        </div>
      </div>

      <div class="plugin-header__actions">
        <v-btn
            class="ide-btn"
            size="small"
            variant="flat"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="refresh"
        >
          Scan
        </v-btn>

        <v-btn
            class="ide-btn ide-btn--primary"
            size="small"
            variant="flat"
            prepend-icon="mdi-package-down"
            :loading="loading"
            @click="installAll"
        >
          Pre-Plugins
        </v-btn>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="plugin-toolbar">
      <v-text-field
          v-model="search"
          class="plugin-search"
          density="compact"
          variant="solo-filled"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
          placeholder="Plugin, Status, Pfad oder Quelle suchen..."
      />

      <v-select
          v-model="filter"
          class="plugin-filter"
          density="compact"
          variant="solo-filled"
          hide-details
          :items="filterOptions"
          item-title="title"
          item-value="value"
          label="Filter"
      />
    </div>

    <!-- Meta Cards -->
    <div class="plugin-stats">
      <div class="ide-stat ide-stat--blue">
        <div class="ide-stat__icon">
          <v-icon size="20">mdi-view-grid-outline</v-icon>
        </div>
        <div>
          <div class="ide-stat__label">Plugins</div>
          <div class="ide-stat__value">{{ pluginStats.total }}</div>
        </div>
      </div>

      <div class="ide-stat ide-stat--green">
        <div class="ide-stat__icon">
          <v-icon size="20">mdi-check-circle-outline</v-icon>
        </div>
        <div>
          <div class="ide-stat__label">Installiert</div>
          <div class="ide-stat__value">{{ pluginStats.installed }}</div>
        </div>
      </div>

      <div class="ide-stat ide-stat--purple">
        <div class="ide-stat__icon">
          <v-icon size="20">mdi-progress-download</v-icon>
        </div>
        <div>
          <div class="ide-stat__label">Laufend</div>
          <div class="ide-stat__value">{{ pluginStats.running }}</div>
        </div>
      </div>

      <div class="ide-stat ide-stat--red">
        <div class="ide-stat__icon">
          <v-icon size="20">mdi-alert-circle-outline</v-icon>
        </div>
        <div>
          <div class="ide-stat__label">Fehler</div>
          <div class="ide-stat__value">{{ pluginStats.errors }}</div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <v-card
        v-if="!loading && filteredPlugins.length === 0"
        class="plugin-empty"
        variant="flat"
    >
      <div class="plugin-empty__icon">
        <v-icon size="38">mdi-puzzle-outline</v-icon>
      </div>

      <div class="plugin-empty__title">Keine Plugins gefunden</div>
      <div class="plugin-empty__text">
        Starte einen Scan oder bereite deine Pre-Plugins vor.
      </div>

      <v-btn
          size="small"
          class="ide-btn ide-btn--primary mt-4"
          variant="flat"
          prepend-icon="mdi-package-down"
          @click="installAll"
      >
        Pre-Plugins vorbereiten
      </v-btn>
    </v-card>

    <!-- Loading skeleton -->
    <div v-if="loading" class="plugin-skeletons">
      <v-skeleton-loader
          v-for="i in 3"
          :key="i"
          class="plugin-skeleton"
          type="list-item-avatar-three-line"
      />
    </div>

    <!-- List -->
    <transition-group
        v-else
        name="plugin-list"
        tag="div"
        class="plugin-list"
    >
      <v-card
          v-for="plugin in filteredPlugins"
          :key="plugin.pluginId"
          class="plugin-card"
          :class="statusClass(plugin)"
          variant="flat"
      >
        <div class="plugin-card__accent" />

        <div class="plugin-card__top">
          <div class="plugin-card__identity">
            <div class="plugin-avatar">
              <v-icon size="24">{{ iconFor(plugin) }}</v-icon>
            </div>

            <div class="plugin-card__main">
              <div class="plugin-title-row">
                <div class="plugin-name">
                  {{ pluginName(plugin) }}
                </div>

                <div class="plugin-chip-row">
                  <v-chip
                      size="x-small"
                      class="ide-chip"
                      :class="`ide-chip--${statusColor(plugin)}`"
                      variant="flat"
                  >
                    <span class="ide-chip__dot" />
                    {{ statusText(plugin) }}
                  </v-chip>

                  <v-chip
                      size="x-small"
                      class="ide-chip ide-chip--muted"
                      variant="flat"
                  >
                    {{ plugin.type || 'plugin' }}
                  </v-chip>

                  <v-chip
                      v-if="plugin.install === false"
                      size="x-small"
                      class="ide-chip ide-chip--warning"
                      variant="flat"
                  >
                    install:false
                  </v-chip>

                  <v-chip
                      size="x-small"
                      class="ide-chip"
                      :class="plugin.active === false ? 'ide-chip--muted' : 'ide-chip--success'"
                      variant="flat"
                  >
                    {{ plugin.active === false ? 'inaktiv' : 'aktiv' }}
                  </v-chip>
                </div>
              </div>

              <div class="plugin-id-line">
                <span>ID</span>
                <code>{{ plugin.pluginId }}</code>
              </div>

              <div
                  v-if="pluginPath(plugin)"
                  class="plugin-path"
              >
                <v-icon size="14">mdi-folder-outline</v-icon>
                <span>{{ pluginPath(plugin) }}</span>
              </div>

              <div
                  v-if="pluginError(plugin)"
                  class="plugin-error"
              >
                <v-icon size="15">mdi-alert-circle-outline</v-icon>
                <span>{{ pluginError(plugin) }}</span>
              </div>
            </div>
          </div>

          <div class="plugin-actions">
            <v-btn
                class="icon-action"
                size="small"
                variant="flat"
                icon="mdi-information-outline"
                title="Details"
                @click="selectPlugin(plugin)"
            />

            <v-btn
                class="icon-action"
                size="small"
                variant="flat"
                :class="plugin.active === false ? 'icon-action--muted' : 'icon-action--success'"
                :icon="plugin.active === false ? 'mdi-toggle-switch-off-outline' : 'mdi-toggle-switch-outline'"
                :title="plugin.active === false ? 'Aktivieren' : 'Deaktivieren'"
                :loading="actionId === `${plugin.pluginId}:toggle`"
                :disabled="isRunning(plugin) || isPauseRequested(plugin)"
                @click="toggle(plugin)"
            />

            <v-btn
                v-if="isRunning(plugin) || isPauseRequested(plugin)"
                class="icon-action icon-action--warning"
                size="small"
                variant="flat"
                icon="mdi-pause-circle-outline"
                title="Download pausieren"
                :loading="actionId === `${plugin.pluginId}:pause` || (isPauseRequested(plugin) && isRunning(plugin))"
                :disabled="isPaused(plugin) || !isRunning(plugin)"
                @click="pause(plugin)"
            />

            <v-btn
                class="icon-action icon-action--warning"
                size="small"
                variant="flat"
                icon="mdi-refresh"
                title="Reparieren"
                :loading="actionId === `${plugin.pluginId}:repair` || isRepairing(plugin)"
                :disabled="isRunning(plugin) || isPauseRequested(plugin)"
                @click="repair(plugin)"
            />

            <v-btn
                class="install-action"
                size="small"
                variant="flat"
                :class="`install-action--${installButtonColor(plugin)}`"
                :loading="installingId === plugin.pluginId || isRunning(plugin)"
                :disabled="isRunning(plugin) || isPauseRequested(plugin) || (isInstalled(plugin) && !pluginError(plugin) && !isPaused(plugin))"
                @click="install(plugin)"
            >
              {{ installButtonText(plugin) }}
            </v-btn>

            <v-btn
                class="icon-action icon-action--danger"
                size="small"
                variant="flat"
                icon="mdi-delete-outline"
                title="Deinstallieren"
                :loading="actionId === `${plugin.pluginId}:uninstall`"
                :disabled="isRunning(plugin) || isPauseRequested(plugin)"
                @click="uninstall(plugin)"
            />
          </div>
        </div>

        <!-- Tracking -->
        <div
            v-if="hasTracking(plugin)"
            class="tracking-panel"
        >
          <div class="tracking-panel__header">
            <div>
              <div class="tracking-panel__label">
                {{ trackingLabel(plugin) }}
              </div>

              <div
                  v-if="plugin.status?.message"
                  class="tracking-panel__message"
              >
                {{ plugin.status.message }}
              </div>
            </div>

            <div class="tracking-panel__percent">
              {{ trackingProgress(plugin) }}%
            </div>
          </div>

          <div class="ide-progress-wrap">
            <v-progress-linear
                class="ide-progress"
                :model-value="trackingProgress(plugin)"
                height="8"
                rounded
                :color="trackingColor(plugin)"
                :indeterminate="trackingIndeterminate(plugin)"
            />
          </div>

          <div
              v-if="hasDownloadDetails(plugin)"
              class="download-grid"
          >
            <div
                v-if="downloadText(plugin)"
                class="download-pill"
            >
              <span>Gesamt</span>
              <strong>{{ downloadText(plugin) }}</strong>
            </div>

            <div
                v-if="currentFileText(plugin)"
                class="download-pill download-pill--wide"
            >
              <span>Aktuelle Datei</span>
              <strong>{{ currentFileText(plugin) }}</strong>
            </div>

            <div
                v-if="currentFileProgressText(plugin)"
                class="download-pill"
            >
              <span>Datei</span>
              <strong>{{ currentFileProgressText(plugin) }}</strong>
            </div>

            <div
                v-if="currentFileRemainingText(plugin)"
                class="download-pill"
            >
              <span>Datei-Rest</span>
              <strong>{{ currentFileRemainingText(plugin) }}</strong>
            </div>

            <div
                v-if="remainingText(plugin)"
                class="download-pill"
            >
              <span>Rest</span>
              <strong>{{ remainingText(plugin) }}</strong>
            </div>

            <div
                v-if="networkCurrentDownloadSpeedText(plugin)"
                class="download-pill"
            >
              <span>Netzwerk</span>
              <strong>{{ networkCurrentDownloadSpeedText(plugin) }}</strong>
            </div>

            <div
                v-if="etaText(plugin)"
                class="download-pill"
            >
              <span>ETA</span>
              <strong>{{ etaText(plugin).replace('ETA ', '') }}</strong>
            </div>
          </div>

          <div
              v-if="currentFileText(plugin)"
              class="current-file-progress"
          >
            <div class="current-file-progress__top">
              <span>Aktuelle Datei Fortschritt</span>
              <strong>{{ currentFileProgressPercent(plugin) }}%</strong>
            </div>

            <v-progress-linear
                :model-value="currentFileProgressPercent(plugin)"
                height="5"
                rounded
                color="cyan"
            />
          </div>

          <div
              v-if="downloadProblemText(plugin)"
              class="problem-line"
              :class="plugin.status?.phase === 'error' ? 'problem-line--error' : 'problem-line--warning'"
          >
            <v-icon size="15">
              {{ plugin.status?.phase === 'error' ? 'mdi-alert-circle-outline' : 'mdi-alert-outline' }}
            </v-icon>
            <span>{{ downloadProblemText(plugin) }}</span>
          </div>
        </div>

        <!-- Details -->
        <v-expand-transition>
          <div
              v-if="selectedId === plugin.pluginId"
              class="plugin-details"
          >
            <div class="details-divider" />

            <div class="details-header">
              <div>
                <div class="details-title">Plugin Details</div>
                <div class="details-subtitle">
                  Runtime, Manifest, Download-Monitoring und Dateistatus
                </div>
              </div>

              <v-chip
                  size="x-small"
                  class="ide-chip ide-chip--muted"
                  variant="flat"
              >
                {{ plugin.status?.phase || 'idle' }}
              </v-chip>
            </div>

            <div class="detail-grid">
              <div class="detail-tile detail-tile--wide">
                <span>Root</span>
                <strong class="path-line">{{ plugin.root || plugin.paths?.root || '—' }}</strong>
              </div>

              <div class="detail-tile detail-tile--wide">
                <span>Manifest</span>
                <strong class="path-line">{{ plugin.manifest || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Quelle</span>
                <strong>{{ plugin.source || plugin.data?.source || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Aktion</span>
                <strong>
                  {{ plugin.status?.action || '—' }}
                  <template v-if="plugin.status?.phase">
                    / {{ plugin.status.phase }}
                  </template>
                </strong>
              </div>

              <div class="detail-tile">
                <span>Status</span>
                <strong>
                  installed={{ plugin.status?.installed ?? false }},
                  saved={{ plugin.status?.saved ?? false }},
                  running={{ plugin.status?.running ?? false }}
                </strong>
              </div>

              <div class="detail-tile">
                <span>Fortschritt</span>
                <strong>{{ trackingProgress(plugin) }}%</strong>
              </div>

              <div class="detail-tile">
                <span>Downloadgröße</span>
                <strong>{{ downloadText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Datei-Live</span>
                <strong>{{ currentSpeedText(plugin) || '0 B/s' }}</strong>
              </div>

              <div class="detail-tile detail-tile--wide">
                <span>Aktuelle Datei</span>
                <strong class="path-line">{{ plugin.status?.currentFile || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Aktuelle Datei Fortschritt</span>
                <strong>{{ currentFileProgressText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Aktuelle Datei Rest</span>
                <strong>{{ currentFileRemainingText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Gesamt-Rest</span>
                <strong>{{ remainingText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Netzwerk Ø-Speed</span>
                <strong>{{ networkCurrentDownloadSpeedText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>ETA über Netzwerk Ø</span>
                <strong>{{ etaText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Netzwerk Live</span>
                <strong>{{ networkCurrentText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Downloadzeit</span>
                <strong>{{ formatDuration(plugin.status?.downloadElapsedSeconds) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Geglättet</span>
                <strong>{{ speedText(plugin) || '—' }}</strong>
              </div>

              <div class="detail-tile">
                <span>Pause</span>
                <strong>
                  paused={{ plugin.status?.paused ?? false }},
                  requested={{ plugin.status?.pauseRequested ?? false }}
                </strong>
              </div>

              <div class="detail-tile">
                <span>Bytes intern</span>
                <strong>
                  present={{ formatBytes(plugin.status?.presentBytes || 0) }},
                  monitor={{ formatBytes(plugin.status?.monitorBytes || 0) }}
                </strong>
              </div>

              <div class="detail-tile">
                <span>Cache / Final</span>
                <strong>
                  cache={{ formatBytes(plugin.status?.partialCacheBytes || 0) }},
                  final={{ formatBytes(plugin.status?.finalPresentBytes || 0) }}
                </strong>
              </div>

              <div class="detail-tile">
                <span>Dateien</span>
                <strong>
                  {{ plugin.status?.completeFileCount ?? 0 }}
                  / {{ plugin.status?.expectedFileCount ?? 0 }} vollständig
                </strong>
              </div>

              <div class="detail-tile">
                <span>Fehlende Dateien</span>
                <strong>{{ plugin.status?.missingFileCount ?? 0 }}</strong>
              </div>

              <div class="detail-tile">
                <span>Partielle Dateien</span>
                <strong>{{ plugin.status?.partialFileCount ?? 0 }}</strong>
              </div>

              <div class="detail-tile">
                <span>Gestartet</span>
                <strong>{{ formatTime(plugin.status?.startedAt) }}</strong>
              </div>

              <div class="detail-tile">
                <span>Heartbeat</span>
                <strong>{{ formatTime(plugin.status?.heartbeatAt) }}</strong>
              </div>

              <div class="detail-tile">
                <span>Beendet</span>
                <strong>{{ formatTime(plugin.status?.finishedAt) }}</strong>
              </div>

              <div
                  v-if="plugin.status?.message"
                  class="detail-tile detail-tile--wide"
              >
                <span>Meldung</span>
                <strong>{{ plugin.status.message }}</strong>
              </div>
            </div>

            <div
                v-if="Array.isArray(plugin.status?.missingFiles) && plugin.status.missingFiles.length"
                class="file-section"
            >
              <div class="file-section__title">
                <v-icon size="16">mdi-file-question-outline</v-icon>
                Fehlende Dateien
              </div>

              <div class="file-list">
                <v-chip
                    v-for="file in plugin.status.missingFiles.slice(0, 16)"
                    :key="file"
                    size="x-small"
                    class="ide-chip ide-chip--warning"
                    variant="flat"
                >
                  {{ file }}
                </v-chip>
              </div>
            </div>

            <div
                v-if="Array.isArray(plugin.status?.partialFiles) && plugin.status.partialFiles.length"
                class="file-section"
            >
              <div class="file-section__title">
                <v-icon size="16">mdi-file-alert-outline</v-icon>
                Partielle Dateien
              </div>

              <div class="file-list">
                <v-chip
                    v-for="file in plugin.status.partialFiles.slice(0, 16)"
                    :key="file.path || file"
                    size="x-small"
                    class="ide-chip ide-chip--error"
                    variant="flat"
                >
                  {{ file.path || file }}
                </v-chip>
              </div>
            </div>
          </div>
        </v-expand-transition>
      </v-card>
    </transition-group>
  </div>
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
</style>