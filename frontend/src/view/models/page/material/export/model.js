import { computed } from "vue";
import {clone} from "@/utils/tools";

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

export function exportModel(props, emit) {
    const exportPayload = computed(() => {
        return clone(props.previewLayer || {}, 'json');
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
