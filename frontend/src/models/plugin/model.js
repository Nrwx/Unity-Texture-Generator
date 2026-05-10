import { computed, onBeforeUnmount, ref, watch } from "vue";

export const pluginProps = {
    plugins: {
        type: Array,
        default: () => [],
    },
    loading: {
        type: Boolean,
        default: false,
    },
    theme: {
        type: String,
        required: true,
    },
};

export function pluginModel(props, emit) {
    const search = ref("");
    const filter = ref("all");
    const selectedId = ref(null);
    const installingId = ref(null);
    const actionId = ref(null);
    const pollTimer = ref(null);
    const forcePollingUntil = ref(0);

    const emitEvent = (event, payload = null) => {
        emit("component-event", event, payload);
        return true;
    };

    const filterOptions = [
        { title: "Alle", value: "all" },
        { title: "Installiert", value: "installed" },
        { title: "Vorbereitet", value: "prepared" },
        { title: "Fehler", value: "error" },
        { title: "Läuft", value: "running" },
        { title: "Pausiert", value: "paused" },
        { title: "Aktiv", value: "active" },
        { title: "Inaktiv", value: "inactive" },
        { title: "Install:false", value: "skip" },
    ];

    const normalizedPlugins = computed(() => {
        if (!Array.isArray(props.plugins)) return [];

        return props.plugins.map((plugin) => {
            const data = plugin.data || {};
            const status = plugin.status || data.status || {};
            const paths = plugin.paths || data.paths || {};

            return {
                ...plugin,
                data,
                status,
                paths,
                pluginId: plugin.pluginId || data.pluginId || data.id,
                id: plugin.id || data.id || plugin.pluginId || data.pluginId,
                name: plugin.name || data.name,
                type: plugin.type || data.type || "plugin",
                source: plugin.source || data.source,
                active: plugin.active ?? data.active ?? true,
                install: plugin.install ?? data.install ?? false,
                root: plugin.root || paths.root,
                manifest: plugin.manifest,
            };
        });
    });

    const isPaused = (plugin) => {
        const status = plugin?.status || {};
        return Boolean(status.paused || status.phase === "paused");
    };

    const isPauseRequested = (plugin) => {
        const status = plugin?.status || {};

        // Sobald wirklich pausiert wurde, darf "pauseRequested" die Buttons nicht mehr sperren.
        if (status.paused || status.phase === "paused") {
            return false;
        }

        return Boolean(status.pauseRequested);
    };

    const isRunning = (plugin) => {
        const status = plugin?.status || {};
        const phase = status.phase;

        if (isPaused(plugin)) return false;

        return Boolean(
            status.running ||
            status.xhr ||
            phase === "prepare" ||
            phase === "copy" ||
            phase === "install" ||
            phase === "repair"
        );
    };

    const isRepairing = (plugin) => {
        return isRunning(plugin) && plugin?.status?.action === "repair";
    };

    const pluginError = (plugin) => {
        const status = plugin?.status || {};
        return status.error || plugin?.data?.status?.error || null;
    };

    const hasMissingOrPartialFiles = (plugin) => {
        const status = plugin?.status || {};
        return Number(status.missingFileCount || 0) > 0 || Number(status.partialFileCount || 0) > 0;
    };

    const isInstalled = (plugin) => {
        const status = plugin?.status || {};

        return Boolean(
            status.installed === true &&
            status.saved === true &&
            !pluginError(plugin) &&
            !hasMissingOrPartialFiles(plugin)
        );
    };

    const isPrepared = (plugin) => {
        const status = plugin?.status || {};
        return Boolean(status.skipped || plugin.install === false || status.phase === "skipped");
    };

    const filteredPlugins = computed(() => {
        const term = String(search.value || "").toLowerCase();

        return normalizedPlugins.value.filter((plugin) => {
            const haystack = [
                plugin.pluginId,
                plugin.name,
                plugin.type,
                plugin.source,
                plugin.root,
                plugin.status?.phase,
                plugin.status?.action,
                plugin.status?.message,
                plugin.status?.error,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch = !term || haystack.includes(term);

            const hasError = Boolean(pluginError(plugin)) || plugin.status?.phase === "error";
            const active = plugin.active !== false;

            let matchesFilter = true;

            if (filter.value === "installed") {
                matchesFilter = isInstalled(plugin);
            } else if (filter.value === "prepared") {
                matchesFilter = isPrepared(plugin);
            } else if (filter.value === "error") {
                matchesFilter = hasError;
            } else if (filter.value === "running") {
                matchesFilter = isRunning(plugin);
            } else if (filter.value === "paused") {
                matchesFilter = isPaused(plugin);
            } else if (filter.value === "skip") {
                matchesFilter = isPrepared(plugin);
            } else if (filter.value === "active") {
                matchesFilter = active;
            } else if (filter.value === "inactive") {
                matchesFilter = !active;
            }

            return matchesSearch && matchesFilter;
        });
    });

    const pluginStats = computed(() => {
        const plugins = normalizedPlugins.value;

        return {
            total: plugins.length,
            installed: plugins.filter((p) => isInstalled(p)).length,
            prepared: plugins.filter((p) => isPrepared(p)).length,
            running: plugins.filter((p) => isRunning(p)).length,
            paused: plugins.filter((p) => isPaused(p)).length,
            inactive: plugins.filter((p) => p.active === false).length,
            errors: plugins.filter((p) => Boolean(pluginError(p)) || p.status?.phase === "error").length,
        };
    });

    const metaText = computed(() => {
        const stats = pluginStats.value;

        if (stats.total === 0) {
            return "Noch keine Plugins im Manifest gefunden.";
        }

        return `${stats.total} Plugin(s) gefunden · ${stats.installed} installiert · ${stats.prepared} vorbereitet · ${stats.running} laufend · ${stats.paused} pausiert`;
    });

    const pluginName = (plugin) => {
        return plugin.name || plugin.data?.name || plugin.pluginId || "Unbekanntes Plugin";
    };

    const pluginPath = (plugin) => {
        return (
            plugin.status?.path ||
            plugin.paths?.data ||
            plugin.root ||
            plugin.data?.status?.path ||
            plugin.data?.paths?.root ||
            null
        );
    };

    const hasTracking = (plugin) => {
        const status = plugin?.status || {};

        return Boolean(
            status.xhr ||
            status.running ||
            status.paused ||
            status.pauseRequested ||
            status.phase === "prepare" ||
            status.phase === "copy" ||
            status.phase === "install" ||
            status.phase === "repair" ||
            status.phase === "paused" ||
            status.phase === "done" ||
            status.phase === "error" ||
            status.phase === "skipped" ||
            status.expectedBytes ||
            status.presentBytes
        );
    };

    const trackingProgress = (plugin) => {
        const status = plugin?.status || {};
        const explicit = Number(status.progress ?? 0);

        if (!Number.isNaN(explicit) && explicit > 0) {
            return Math.max(0, Math.min(100, Math.round(explicit)));
        }

        const expected = Number(status.expectedBytes || 0);
        const present = Number(status.presentBytes || 0);

        if (expected > 0 && present >= 0) {
            return Math.max(0, Math.min(100, Math.round((present / expected) * 100)));
        }

        return 0;
    };

    const trackingIndeterminate = (plugin) => {
        const progress = trackingProgress(plugin);
        const phase = plugin?.status?.phase;

        return Boolean(
            isRunning(plugin) &&
            progress <= 1 &&
            phase !== "error" &&
            phase !== "done" &&
            phase !== "skipped" &&
            phase !== "paused"
        );
    };

    const trackingColor = (plugin) => {
        const phase = plugin?.status?.phase;

        if (phase === "error") return "error";
        if (phase === "done") return "success";
        if (phase === "paused") return "warning";
        if (phase === "skipped") return "warning";
        if (phase === "repair") return "warning";
        if (phase === "copy") return "info";
        if (phase === "prepare") return "info";

        if (isPauseRequested(plugin)) return "warning";

        return "primary";
    };

    const trackingLabel = (plugin) => {
        const status = plugin?.status || {};
        const action = status.action || "Aktion";
        const phase = status.phase || "idle";

        if (phase === "prepare") return `${action}: Vorbereitung`;
        if (phase === "copy") return `${action}: Dateien vorbereiten`;
        if (phase === "install") return `${action}: Installation`;
        if (phase === "repair") return `${action}: Reparatur`;
        if (phase === "paused") return `${action}: pausiert`;
        if (phase === "done") return `${action}: abgeschlossen`;
        if (phase === "error") return `${action}: Fehler`;
        if (phase === "skipped") return `${action}: vorbereitet`;

        if (isPauseRequested(plugin)) return `${action}: Pause angefordert`;

        return `${action}: ${phase}`;
    };

    const statusText = (plugin) => {
        if (pluginError(plugin)) return "Fehler";
        if (isPaused(plugin)) return "Pausiert";
        if (isPauseRequested(plugin)) return "Pause...";
        if (isRunning(plugin)) {
            if (plugin.status?.action === "repair") return "Reparatur";
            if (plugin.status?.action === "install") return "Installation";
            return "Läuft";
        }
        if (plugin.active === false) return "Inaktiv";
        if (isInstalled(plugin)) return "Installiert";
        if (isPrepared(plugin)) return "Vorbereitet";
        if (plugin.status?.installed) return "Bereit";
        return "Nicht installiert";
    };

    const statusColor = (plugin) => {
        if (pluginError(plugin)) return "error";
        if (isPaused(plugin)) return "warning";
        if (isPauseRequested(plugin)) return "warning";
        if (isRunning(plugin)) return plugin.status?.action === "repair" ? "warning" : "primary";
        if (plugin.active === false) return "grey";
        if (isInstalled(plugin)) return "success";
        if (isPrepared(plugin)) return "warning";
        if (plugin.status?.installed) return "info";
        return "grey";
    };

    const installButtonText = (plugin) => {
        if (isPaused(plugin)) return "Fortsetzen";

        if (isRunning(plugin)) {
            if (plugin.status?.action === "repair") return "Repariert...";
            if (plugin.status?.action === "install") return "Installiert...";
            return "Läuft...";
        }

        if (isPauseRequested(plugin)) return "Pause...";
        if (pluginError(plugin)) return "Neu installieren";
        if (isInstalled(plugin)) return "Installiert";
        if (hasMissingOrPartialFiles(plugin)) return "Fortsetzen";

        return "Installieren";
    };

    const installButtonColor = (plugin) => {
        if (pluginError(plugin)) return "error";
        if (isPaused(plugin)) return "warning";
        if (hasMissingOrPartialFiles(plugin)) return "warning";
        if (isInstalled(plugin)) return "success";
        return "primary";
    };

    const iconFor = (plugin) => {
        const type = String(plugin.type || "").toLowerCase();
        const name = String(plugin.name || plugin.pluginId || "").toLowerCase();

        if (type.includes("diffusers")) return "mdi-image-sparkle";
        if (type.includes("model")) return "mdi-brain";
        if (name.includes("sd") || name.includes("stable")) return "mdi-image-sparkle";
        if (type.includes("font")) return "mdi-format-font";
        if (type.includes("brush")) return "mdi-brush";

        return "mdi-puzzle";
    };

    const formatBytes = (bytes) => {
        const value = Number(bytes || 0);
        if (!value) return "0 B";

        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = value;
        let index = 0;

        while (size >= 1000 && index < units.length - 1) {
            size /= 1000;
            index++;
        }

        return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
    };

    const formatSpeed = (bytesPerSecond) => {
        const value = Number(bytesPerSecond || 0);

        if (!value) return "";

        const units = ["B/s", "KB/s", "MB/s", "GB/s"];
        let size = value;
        let index = 0;

        while (size >= 1000 && index < units.length - 1) {
            size /= 1000;
            index++;
        }

        return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
    };

    const speedText = (plugin) => {
        const status = plugin?.status || {};
        const speed = Number(status.speedBytesPerSecond || 0);

        if (speed > 0) {
            return formatSpeed(speed);
        }

        return "";
    };

    const speedFallbackText = (plugin) => {
        if (!isRunning(plugin)) return "";

        const status = plugin?.status || {};
        const present = Number(status.presentBytes || 0);
        const previous = Number(status.speedSampleBytes || 0);

        // Wenn schon Daten vorhanden sind, aber keine Änderung messbar ist,
        // dann nicht "messe Geschwindigkeit..." endlos anzeigen.
        if (present > 0 && present === previous) {
            return "warte auf Dateifortschritt...";
        }

        return "messe Geschwindigkeit...";
    };

    const canContinue = (plugin) => {
        return Boolean(isPaused(plugin) || hasMissingOrPartialFiles(plugin) || pluginError(plugin));
    };

    const formatBitsSpeed = (bitsPerSecond) => {
        const value = Number(bitsPerSecond || 0);

        if (!value) return "";

        const units = ["Bit/s", "KBit/s", "MBit/s", "GBit/s"];
        let size = value;
        let index = 0;

        while (size >= 1000 && index < units.length - 1) {
            size /= 1000;
            index++;
        }

        return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
    };

    const networkReceiveText = (plugin) => {
        return formatBitsSpeed(plugin?.status?.networkReceiveBitsPerSecond);
    };

    const networkSendText = (plugin) => {
        return formatBitsSpeed(plugin?.status?.networkSendBitsPerSecond);
    };

    const networkText = (plugin) => {
        const recv = networkReceiveText(plugin);
        const sent = networkSendText(plugin);

        if (!recv && !sent) return "";

        if (recv && sent) {
            return `↓ ${recv} · ↑ ${sent}`;
        }

        if (recv) return `↓ ${recv}`;
        return `↑ ${sent}`;
    };

    const formatDuration = (seconds) => {
        const value = Number(seconds || 0);

        if (!value || value < 0) return "";

        const h = Math.floor(value / 3600);
        const m = Math.floor((value % 3600) / 60);
        const s = Math.floor(value % 60);

        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const etaText = (plugin) => {
        const text = formatDuration(plugin?.status?.etaSeconds);
        return text ? `ETA ${text}` : "";
    };

    const downloadText = (plugin) => {
        const status = plugin?.status || {};
        const expected = Number(status.expectedBytes || 0);
        const present = Number(status.presentBytes || 0);

        if (!expected && !present) return "";

        return `${formatBytes(present)} / ${formatBytes(expected)}`;
    };

    const downloadProblemText = (plugin) => {
        const status = plugin?.status || {};
        const missing = Number(status.missingFileCount || 0);
        const partial = Number(status.partialFileCount || 0);

        const parts = [];

        if (missing > 0) parts.push(`${missing} fehlen`);
        if (partial > 0) parts.push(`${partial} partiell`);

        return parts.join(" · ");
    };

    const formatTime = (value) => {
        if (!value) return "—";

        try {
            return new Date(Number(value)).toLocaleString();
        } catch (e) {
            return "—";
        }
    };

    const refresh = () => {
        forcePollingUntil.value = Date.now() + 5000;
        startPolling();
        emitEvent("plugin:scan");
    };

    const installAll = () => {
        forcePollingUntil.value = Date.now() + 15000;
        startPolling();
        emitEvent("plugin:install-all");
    };

    const install = (plugin) => {
        if (!plugin?.pluginId) return;

        // Pausierte Plugins dürfen fortgesetzt werden.
        if (isRunning(plugin) || isPauseRequested(plugin)) return;

        installingId.value = plugin.pluginId;
        forcePollingUntil.value = Date.now() + 15000;
        startPolling();

        emitEvent("plugin:install", {
            pluginId: plugin.pluginId,
        });

        window.setTimeout(() => {
            if (installingId.value === plugin.pluginId) {
                installingId.value = null;
            }
        }, 1500);
    };

    const pause = (plugin) => {
        if (!plugin?.pluginId || isPaused(plugin)) return;

        actionId.value = `${plugin.pluginId}:pause`;
        forcePollingUntil.value = Date.now() + 30000;
        startPolling();

        emitEvent("plugin:pause", {
            pluginId: plugin.pluginId,
        });

        window.setTimeout(() => {
            if (actionId.value === `${plugin.pluginId}:pause`) {
                actionId.value = null;
            }
        }, 1500);
    };

    const repair = (plugin) => {
        if (!plugin?.pluginId) return;

        // Pausiert darf repariert/fortgesetzt werden, nur laufend nicht.
        if (isRunning(plugin) || isPauseRequested(plugin)) return;

        actionId.value = `${plugin.pluginId}:repair`;
        forcePollingUntil.value = Date.now() + 15000;
        startPolling();

        emitEvent("plugin:repair", {
            pluginId: plugin.pluginId,
        });

        window.setTimeout(() => {
            if (actionId.value === `${plugin.pluginId}:repair`) {
                actionId.value = null;
            }
        }, 1500);
    };

    const uninstall = (plugin) => {
        if (!plugin?.pluginId || isRunning(plugin) || isPauseRequested(plugin)) return;

        actionId.value = `${plugin.pluginId}:uninstall`;

        emitEvent("plugin:uninstall", {
            pluginId: plugin.pluginId,
        });

        window.setTimeout(() => {
            if (actionId.value === `${plugin.pluginId}:uninstall`) {
                actionId.value = null;
            }
        }, 1500);
    };

    const toggle = (plugin) => {
        if (!plugin?.pluginId || isRunning(plugin) || isPauseRequested(plugin)) return;

        actionId.value = `${plugin.pluginId}:toggle`;

        emitEvent("plugin:toggle", {
            pluginId: plugin.pluginId,
        });

        window.setTimeout(() => {
            if (actionId.value === `${plugin.pluginId}:toggle`) {
                actionId.value = null;
            }
        }, 1500);
    };

    const selectPlugin = (plugin) => {
        if (!plugin?.pluginId) return;

        selectedId.value = selectedId.value === plugin.pluginId
            ? null
            : plugin.pluginId;
    };

    const startPolling = () => {
        if (pollTimer.value) return;

        pollTimer.value = window.setInterval(() => {
            const shouldContinue =
                pluginStats.value.running > 0 ||
                Date.now() < forcePollingUntil.value;

            if (shouldContinue) {
                emitEvent("plugin:fetch");
            } else {
                stopPolling();
            }
        }, 2000);
    };

    const stopPolling = () => {
        if (!pollTimer.value) return;

        window.clearInterval(pollTimer.value);
        pollTimer.value = null;
    };

    watch(
        () => pluginStats.value.running,
        (running) => {
            if (running > 0) {
                startPolling();
            } else if (Date.now() >= forcePollingUntil.value) {
                stopPolling();
            }
        },
        { immediate: true }
    );

    onBeforeUnmount(() => {
        stopPolling();
    });

    return {
        emitEvent,

        search,
        filter,
        filterOptions,

        selectedId,
        installingId,
        actionId,

        normalizedPlugins,
        filteredPlugins,
        pluginStats,
        metaText,

        speedFallbackText,
        canContinue,
        pluginName,
        pluginPath,
        pluginError,

        isInstalled,
        isRunning,
        isRepairing,
        isPaused,
        isPauseRequested,

        statusText,
        statusColor,
        iconFor,
        formatTime,

        hasTracking,
        trackingProgress,
        trackingIndeterminate,
        trackingColor,
        trackingLabel,

        formatBytes,
        formatSpeed,
        downloadText,
        downloadProblemText,
        speedText,
        etaText,
        formatBitsSpeed,
        networkReceiveText,
        networkSendText,
        networkText,

        installButtonText,
        installButtonColor,

        refresh,
        installAll,
        install,
        pause,
        repair,
        uninstall,
        toggle,
        selectPlugin,
    };
}