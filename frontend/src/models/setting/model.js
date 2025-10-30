import {computed, nextTick, ref} from "vue";
import {uuid} from "@/utils/uuid";

/**
 * settingModel: verarbeitet props.setting (flat), props.category (array schema) und props.meta
 * - Keine watches: Mapping erfolgt ausschließlich via computed
 * - Erwartet: props.setting enthält flat key:value (z. B. cpu_name: "..."), props.category das Array-Template
 */
export function settingModel(props, emit) {
    const scrollbars = ref([uuid(), uuid(), uuid()]);
    const emitEvent = (event, payload) => emit("component-event", event, payload);

    const config = ref({
        maxWidth: 960,
        title: "Systemeinstellungen",
        subtitle: "Synchronisiert: " + computed(() => {return new Date(props.meta.last_update_unix_ms).toLocaleString() || '—'}).value + ', ' + "Version: " + computed(() => {return props.meta.data_version || '—'}).value,
        emit: "setting-state",
        textVariant: 'id'
    });

    const search = ref("");
    const sidebarCollapsed = ref(false);
    const selectedCategory = ref(null);
    const selectedSubCategory = ref(null);
    const expandedCategories = ref({});

    const toggleCategory = async (cat) => {
        expandedCategories.value[cat.id] = !expandedCategories.value[cat.id];
        await selectCategory(cat);
    };

    const categories = computed(() => {
        if (!Array.isArray(props.category)) return [];

        return props.category.map((top) => {
            const topId = top.key ?? top.id ?? `cat-${Math.random().toString(36).slice(2, 8)}`;
            const name = top.title ?? top.key ?? topId;

            const subCategories = Array.isArray(top.categories)
                ? top.categories.map((sub) => ({
                    id: sub.key ?? sub.id,
                    name: sub.title ?? sub.key ?? (sub.key || "").toString(),
                    raw: sub,
                }))
                : [];

            return {
                id: topId,
                name,
                icon: top.icon,
                subCategories,
                raw: top,
            };
        });
    });

    const settings = computed(() => {
        const out = {};
        const flat = props.setting ?? {};

        if (!Array.isArray(props.category)) return out;

        for (const top of props.category) {
            const topKey = top.key ?? top.id ?? "unknown";
            out[topKey] = out[topKey] ?? {};

            const subs = Array.isArray(top.categories) ? top.categories : [];
            for (const sub of subs) {
                const fields = Array.isArray(sub.fields) ? sub.fields : [];
                for (const f of fields) {
                    const key = f.key;
                    out[topKey][key] = Object.prototype.hasOwnProperty.call(flat, key)
                        ? flat[key]
                        : f.value;
                }
            }
        }

        return out;
    });

    const filteredCategories = computed(() =>
        categories.value.filter((cat) =>
            cat.name.toLowerCase().includes(search.value.toLowerCase())
        )
    );

    const formatLabel = (key) => {
        if (typeof key !== "string") return "";
        return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const selectCategory = async (cat) => {
        selectedCategory.value = cat;
        selectedSubCategory.value = null;
    };

    const selectSubCategory = async (catId, subId) => {
        selectedCategory.value = categories.value.find((c) => c.id === catId);
        selectedSubCategory.value = subId;

        await nextTick(() => {
            const el = document.getElementById(`${catId}-${subId}`);
            if (el) {
                el.scrollIntoView({behavior: "smooth", block: "center"});
                el.classList.add("highlight");
                setTimeout(() => el.classList.remove("highlight"), 1000);
            }
        });
    };

    const isSelected = (cat) => selectedCategory.value?.id === cat.id;


    return {
        emitEvent,
        scrollbars,
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
        settings,
        toggleCategory,
        expandedCategories,
    };
}

export const settingProps = {
    projectId: {
        type: String,
        required: true,
    },
    state: {
        type: Boolean,
        default: false,
    },
    loading: {
        type: Boolean,
        default: true,
    },
    setting: {
        type: Object,
        required: true,
    },
    category: {
        type: Array,
        required: true,
    },
    tasks: {
        type: Array,
        required: true,
    },
    tasksMeta: {
        type: Object,
        required: true,
    },
    taskEdit: {
        type: Boolean,
        default: false,
    },
    taskEditLoading: {
        type: Boolean,
        default: false,
    },
    meta: {
        type: Object,
        required: true,
    },
    theme: {
        type: String,
        required: true,
    }
};
