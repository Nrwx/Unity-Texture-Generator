import { computed } from "vue";

const cloneData = value => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

export const exportProps = {
    previewLayer: {
        type: Object,
        default: () => ({}),
    },

    isEditingMaterialLayer: {
        type: Boolean,
        default: false,
    },
};

export const exportEmits = [
    "request-export",
];

export function exportModel(props, emit) {
    const exportPayload = computed(() => {
        return cloneData(props.previewLayer || {});
    });

    const exportJson = computed(() => {
        try {
            return JSON.stringify(exportPayload.value, null, 2);
        } catch (_error) {
            return "{}";
        }
    });

    const canRequestExport = computed(() => {
        return props.isEditingMaterialLayer === true;
    });

    const requestExport = () => {
        if (!canRequestExport.value) {
            return;
        }

        emit("request-export", exportPayload.value);
    };

    return {
        exportPayload,
        exportJson,
        canRequestExport,
        requestExport,
    };
}
