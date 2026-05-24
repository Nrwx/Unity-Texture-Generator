const DEFAULT_HEADER_STATUS_CHIP_CONFIG = {
    icon: "mdi-information-outline",
    title: "",
    subtitle: "",
    chip: null,
};

export function headerStatusChipModel() {
    return {};
}

export const headerStatusChipProps = {
    config: {
        type: Object,
        default: () => ({
            ...DEFAULT_HEADER_STATUS_CHIP_CONFIG,
        }),
    }
};