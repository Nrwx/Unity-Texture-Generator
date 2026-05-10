import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";

export const settingMeta = ref({
    data_version: 1,
    last_update_unix_ms: 1760303109286
});

export const settingCategory = ref([
    {
        level: 1,
        id: uuidv4(),
        key: 'system_config',
        icon: 'mdi-desktop-tower-monitor', // 🖥 Hauptkategorie-Icon
        title: 'System Kategorien',
        description: 'Technische Informationen zu Hardware und Leistung.',
        categories: [
            {
                level: 2,
                id: uuidv4(),
                key: 'cpu',
                icon: 'mdi-cpu-64-bit', // 🧠 Prozessor
                title: 'Prozessor',
                description: 'Informationen über den installierten Prozessor.',
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'cpu_name',
                        type: 'input',
                        icon: 'mdi-chip', // 💾 Symbol für CPU-Chip
                        title: 'CPU Name',
                        description: 'Bezeichnung und Modell des Prozessors.',
                        value: 'Intel64 Family 6 Model 122 Stepping 1, GenuineIntel'
                    },
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'cpu_threads',
                        type: 'input',
                        icon: 'mdi-cogs', // ⚙️ Threads/Prozesse
                        title: 'CPU Threads',
                        description: 'Anzahl der logischen Threads des Prozessors.',
                        value: 2
                    }
                ]
            },
            {
                level: 2,
                id: uuidv4(),
                key: 'gpu',
                icon: 'mdi-gpu', // 🎮 GPU
                title: 'Grafikeinheit',
                description: 'Details zur verwendeten Grafikhardware.',
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'gpu_name',
                        type: 'input',
                        icon: 'mdi-monitor', // 🖥 GPU-Anzeige
                        title: 'GPU Name',
                        description: 'Bezeichnung der verwendeten GPU.',
                        value: 'Intel(R) UHD Graphics 600'
                    },
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'gpu_memory_mb',
                        type: 'input',
                        icon: 'mdi-memory', // 💾 Speicher
                        title: 'GPU Speicher (MB)',
                        description: 'Gesamter verfügbarer Videospeicher in Megabyte.',
                        value: 2013
                    },
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'preferred_unit',
                        type: 'select',
                        icon: 'mdi-swap-horizontal', // 🔁 Auswahl
                        title: 'Bevorzugte Einheit',
                        description: 'Ausgewählte Haupteinheit für Berechnungen.',
                        options: ['CPU', 'GPU'],
                        value: 'GPU'
                    },
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'use_gpu',
                        type: 'toggle',
                        icon: 'mdi-toggle-switch-outline', // 🔘 Umschalter
                        title: 'GPU verwenden',
                        description: 'Legt fest, ob GPU-Beschleunigung aktiviert ist.',
                        value: true
                    }
                ]
            },
            {
                level: 2,
                id: uuidv4(),
                key: 'system',
                icon: 'mdi-cog-outline', // ⚙️ System
                title: 'Betriebssystem',
                description: 'Allgemeine Systeminformationen und Hardware-Spezifikationen.',
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'os_type',
                        type: 'input',
                        icon: 'mdi-laptop', // 💻 Betriebssystem
                        title: 'Betriebssystem',
                        description: 'Der Name bzw. Typ des Betriebssystems.',
                        value: 'windows'
                    },
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'os_arch',
                        type: 'input',
                        icon: 'mdi-cpu-32-bit', // 🧩 Architektur
                        title: 'Systemarchitektur',
                        description: 'Die Architektur des Systems, z. B. amd64 oder arm64.',
                        value: 'amd64'
                    },
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'os_memory_gb',
                        type: 'input',
                        icon: 'mdi-memory', // 🧠 RAM
                        title: 'Arbeitsspeicher (GB)',
                        description: 'Gesamter verfügbarer RAM in Gigabyte.',
                        value: 3.68
                    }
                ]
            },
            {
                level: 2,
                id: uuidv4(),
                key: 'performance',
                icon: 'mdi-speedometer', // 🏎 Leistung
                title: 'Leistungsbewertung',
                description: 'Empfohlene Systemparameter und aktuelle Leistungswerte.',
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'system_rating',
                        type: 'star-rating',
                        icon: 'mdi-star-outline', // ⭐ Bewertung
                        title: 'Systembewertung',
                        description: 'Allgemeine Bewertung der Systemleistung.',
                    }
                ]
            },
            {
                level: 2,
                id: uuidv4(),
                key: 'storage',
                icon: 'mdi-database',
                title: 'Speicher',
                description: 'Visualisierung & Verwaltung von Speicher (System / Session / Cache).',
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'cache_component',
                        type: 'cache-module',
                        icon: 'mdi-harddisk',
                        title: 'Cache & Storage',
                        description: 'Verteilung & Verwaltung von Storage-Quellen',
                    }
                ]
            }
        ]
    },
    {
        level: 1,
        id: uuidv4(),
        key: "task",
        icon: "mdi-laptop",
        title: "Task Manager",
        description: "Verwaltung von automatisierten Tasks, Chains und Zeitplänen.",
        categories: [
            {
                level: 2,
                id: uuidv4(),
                key: "task_overview",
                icon: "mdi-format-list-checkbox",
                title: "Übersicht",
                description: "Schnellübersicht & Live-Metriken.",
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'task_overview_entry',
                        type: 'task-overview-module',
                    }
                ]
            },

            {
                level: 2,
                id: uuidv4(),
                key: "task_manager",
                icon: "mdi-map",
                title: "Aufgaben",
                description: "Konfiguieren Sie personalisierte, automatisierte Tasks.",
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'task_entry',
                        type: 'task-module'
                    }
                ]
            },

            {
                level: 2,
                id: uuidv4(),
                key: "task_control",
                icon: "mdi-cog-sync-outline",
                title: "Steuerung",
                description: "Verwalte, starte oder stoppe Tasks direkt aus der Oberfläche.",
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'task_control_entry',
                        type: 'task-control-module',
                    }
                ]
            },

            {
                level: 2,
                id: uuidv4(),
                key: "task_logging",
                icon: "mdi-book-open-outline",
                title: "Verlauf",
                description: "Protokolliere ausgeführte Tasks, Fehler und Statusänderungen.",
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'task_log_entry',
                        type: 'task-log-module',
                    }
                ]
            },

            {
                level: 2,
                id: uuidv4(),
                key: "task_summary",
                icon: "mdi-view-dashboard",
                title: "Bericht",
                description: "Berichterfassung der ausgeführten Tasks.",
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: 'task_summary_entry',
                        type: 'task-summary-module',
                    }
                ]
            }
        ]
    },
    {
        level: 1,
        id: uuidv4(),
        key: "plugins",
        icon: "mdi-puzzle",
        title: "Plugins",
        description: "Verwaltung von lokalen Erweiterungen, KI-Modellen und Plugin-Installationen.",
        categories: [
            {
                level: 2,
                id: uuidv4(),
                key: "plugin_manager",
                icon: "mdi-puzzle-outline",
                title: "Manager",
                description: "Installiere, scanne und verwalte lokale Plugins.",
                fields: [
                    {
                        level: 3,
                        id: uuidv4(),
                        key: "plugin_manager_entry",
                        type: "plugin-manager",
                        icon: "mdi-puzzle",
                        title: "Plugin Übersicht",
                        description: "Lokale Plugins und KI-Modelle verwalten."
                    }
                ]
            }
        ]
    }
]);
