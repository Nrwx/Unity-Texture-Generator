import {localData} from "@/dataLayer/local";
import {computed} from "vue";

export function     historyModel(emit) {

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

    const toggleCollapse = (index) => {
        sortedBuilds.value[index].collapsed = !sortedBuilds.value[index].collapsed;
    };

    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    return {
        sortedBuilds,
        sortOptions,
        emitEvent,
        toggleCollapse,
    };
}

export const historyProps = {
};