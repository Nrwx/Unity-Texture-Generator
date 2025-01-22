import {computed, ref} from "vue";
import {localData} from "@/dataLayer/local";

export function operationModel(emit) {
    const currentFile = ref("");
    const fullscreen = ref(false);
    const fullscreenTitle = ref("");
    const fullscreenImage = ref("");
    const fullscreenId = ref("");

    const emitEvent = (id) => {
        emit("apply-operation", id);
    };
    const tabs = [
        { name: 'Tab 1', icon: 'mdi-water-opacity', content: 'Content for Tab 5' },
        { name: 'Tab 2', icon: 'mdi-theme-light-dark', content: 'Content for Tab 1' },
        { name: 'Tab 3', icon: 'mdi-panorama-variant-outline', content: 'Content for Tab 2' },
        { name: 'Tab 4', icon: 'mdi-shimmer', content: 'Content for Tab 3' },
        { name: 'Tab 5', icon: 'mdi-resize', content: 'Content for Tab 4' },
        { name: 'Tab 6', icon: 'mdi-cube-outline', content: 'Content for Tab 6' },
        { name: 'Tab 6', icon: 'mdi-transition', content: 'Content for Tab 6' },
        { name: 'Tab 6', icon: 'mdi-tools', content: 'Content for Tab 6' },
        { name: 'Tab 6', icon: 'mdi-folder-download-outline', content: 'Content for Tab 6' },
    ];

    const itemMethods = [
        { title: "Keine", value: 0 },
        { title: "Geglättete Collage", value: 1 },
        { title: "Verstreute Ränder", value: 2 },
        { title: "Geglättete Kopien", value: 3 },
        { title: "Rahmen wiederherstellen", value: 4 },
        { title: "Kleine Steine", value: 5 },
        { title: "Gras", value: 6 },
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

    const deleteBuild = (id) => {
        localData.builds.value = localData.builds.value.filter((b) => b.id !== id);
    };

    const toggleCollapse = (index) => {
        sortedBuilds.value[index].collapsed = !sortedBuilds.value[index].collapsed;
    };

    const openFullscreen = (src, id, title) => {
        fullscreenTitle.value = title
        fullscreenId.value = id
        fullscreenImage.value = src;
        fullscreen.value = true;
    };

    const downloadImage = (src) => {
        const link = document.createElement("a");
        link.href = src;
        link.download = src.split("/").pop();
        link.click();
    };

    const selectDiffuseMap = (mapUrl) => {
        localData.output.value = mapUrl;
        currentFile.value = mapUrl
    };

    return {
        tabs,
        itemMethods,
        sortOptions,
        sortedBuilds,
        selectDiffuseMap,
        downloadImage,
        openFullscreen,
        deleteBuild,
        toggleCollapse,
        emitEvent
    };
}

export const operationProps = {
    items: {
        type: Array,
        required: true,
        default: () => [],
    },
};