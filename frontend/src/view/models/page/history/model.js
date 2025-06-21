import {localData} from "@/dataLayer/local";
import {computed, ref} from "vue";

export function historyModel(props, emit) {

    const tabIndex = ref(0)

    const tabs = [
        { name: 'Protokoll', icon: 'mdi-file-document-outline', content: 'Content for Protokoll' },
        { name: 'Builds',    icon: 'mdi-cube-outline',          content: 'Content for Builds' },
    ];

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
        handleTabEmit
    };
}

export const historyProps = {
};