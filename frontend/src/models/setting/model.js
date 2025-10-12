import {computed, ref} from "vue";

export function settingModel(props, emit) {
    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };
    const config = ref({
        maxWidth: 960,
        title: "Systemeinstellungen",
        emit: "setting-state",
    });

    const search = ref("");
    const sidebarCollapsed = ref(false);
    const selectedCategory = ref(null);
    const selectedSubCategory = ref(null);

    const categoryIcons = {
        system: "mdi-desktop-classic",
        gpu: "mdi-card-outline",
        cpu: "mdi-cpu-64-bit",
        performance: "mdi-speedometer",
        meta: "mdi-information",
    };

    // Kategorien & Subcategories erzeugen
    const categories = computed(() =>
        Object.keys(props.settings).map((catKey) => {
            const catData = props.settings[catKey];
            const subCats = Object.keys(catData).map((subKey) => ({
                id: subKey,
                name: subKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            }));

            return {
                id: catKey,
                name: catKey.charAt(0).toUpperCase() + catKey.slice(1),
                icon: categoryIcons[catKey] || "mdi-settings",
                subCategories: subCats,
            };
        })
    );

    const filteredCategories = computed(() =>
        categories.value.filter((cat) =>
            cat.name.toLowerCase().includes(search.value.toLowerCase())
        )
    );

    const formatLabel = (key) => {
        if (typeof key !== "string") return "";
        return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const selectCategory = (cat) => {
        selectedCategory.value = cat;
        selectedSubCategory.value = null;
    };

    const selectSubCategory = (catId, subId) => {
        selectedCategory.value = categories.value.find((c) => c.id === catId);
        selectedSubCategory.value = subId;

        // Scrollen zum Feld
        setTimeout(() => {
            const el = document.getElementById(`${catId}-${subId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });

                // Kurzes visuelles Highlight
                el.classList.add("highlight");
                setTimeout(() => el.classList.remove("highlight"), 1000);
            }
        }, 100);
    };

    const isSelected = (cat) => selectedCategory.value?.id === cat.id;

    return {
        emitEvent,
        search,
        config,
        sidebarCollapsed,
        categories,
        filteredCategories,
        selectedCategory,
        selectedSubCategory,
        selectCategory,
        selectSubCategory,
        isSelected,
        formatLabel,
    };
}

export const settingProps = {
    state: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: true
    },
    settings: {
        type: Object,
        required: true
    },
    theme: {
        type: String,
        required: true
    },
};