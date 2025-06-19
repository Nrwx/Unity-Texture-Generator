import {localData} from "@/dataLayer/local";
import {backupStates} from "@/dataLayer/state";
import {computed, ref} from "vue";

export function historyModel(props, emit) {

    const tabIndex = ref(0)

    const tabs = [
        { name: 'Protokoll', icon: 'mdi-file-document-outline', content: 'Content for Protokoll' },
        { name: 'Verlauf',   icon: 'mdi-history',               content: 'Content for Verlauf' },
        { name: 'Builds',    icon: 'mdi-cube-outline',          content: 'Content for Builds' },
    ];


    // globale Undo/Redo Verfügbarkeit
    const canUndoGlobal = computed(() => {
        const idx = backupStates.global.value.findIndex((b) => b.active);
        return idx > 0;
    });
    const canRedoGlobal = computed(() => {
        const idx = backupStates.global.value.findIndex((b) => b.active);
        return idx >= 0 && idx < backupStates.global.value.length - 1;
    });

    // layer-spezifisch: wir können undo/redo ausführen, indem wir prüfen,
    // ob es für mindestens einen ausgewählten Layer >1 Backup gibt
    const canUndoLayer = computed(() =>
        localData.layers.value.some(
            (l) => (backupStates.layer[l.id]?.length || 0) > 1
        )
    );
    const canRedoLayer = canUndoLayer;

    // Batch Undo/Redo für alle selektierten Layer
    const bulkLayerUndo = () => {
        localData.layers.value.forEach((l) =>
            emitEvent("backup:previous-layer", l.id)
        );
    };
    const bulkLayerRedo = () => {
        localData.layers.value.forEach((l) =>
            emitEvent("backup:forward-layer", l.id)
        );
    };

    const sortOptions = [
        { title: "Neueste", value: "newest" },
        { title: "Älteste", value: "oldest" },
    ];

    const sortedBuilds = computed(() => {
        return [...localData.builds.value].sort((a, b) => {
            return localData.sort.value === "newest"
                ? new Date(b.timestamp) - new Date(a.timestamp)
                : new Date(a.timestamp) - new Date(b.timestamp);
        });
    });

    const handleTabEmit =  (index) => {
        tabIndex.value = index
        if(index === 0) {
            emitEvent('backup:fetch-list')
        }
        if(index === 1) {
            if (localData.layers.value.length){
                localData.layers.value.forEach((l) =>
                    emitEvent('backup:fetch-layer-list', l.id)
                );
            } else {
                emitEvent('backup:fetch-layer-list')
            }
        }
    };

    const toggleCollapse = (index) => {
        sortedBuilds.value[index].collapsed = !sortedBuilds.value[index].collapsed;
    };

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        tabs,
        tabIndex,
        sortedBuilds,
        sortOptions,
        emitEvent,
        toggleCollapse,
        handleTabEmit,
        canUndoGlobal,
        canRedoGlobal,
        canUndoLayer,
        canRedoLayer,
        bulkLayerUndo,
        bulkLayerRedo,
    };
}

export const historyProps = {
};