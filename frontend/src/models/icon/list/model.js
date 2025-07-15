import {computed, ref} from "vue";

export function iconListModel(props, emit) {
    const menu = ref(false);
    const search = ref("");

    // Beispiel-Subset von MDI-Icons (du kannst mehr oder dynamisch laden)
    const icons = [
        // Navigation & App
        "mdi-home",
        "mdi-menu",
        "mdi-apps",
        "mdi-view-dashboard",
        "mdi-compass",
        "mdi-map",
        "mdi-map-marker",
        "mdi-earth",

        // Benutzer & Profil
        "mdi-account",
        "mdi-account-circle",
        "mdi-account-group",
        "mdi-account-plus",
        "mdi-account-edit",
        "mdi-login",
        "mdi-logout",

        // Einstellungen & Aktionen
        "mdi-cog",
        "mdi-cogs",
        "mdi-wrench",
        "mdi-tune",
        "mdi-settings-helper",
        "mdi-reload",
        "mdi-sync",

        // Kommunikation
        "mdi-email",
        "mdi-email-outline",
        "mdi-message",
        "mdi-chat",
        "mdi-phone",
        "mdi-phone-in-talk",
        "mdi-comment",

        // Medien & Inhalte
        "mdi-camera",
        "mdi-image",
        "mdi-play",
        "mdi-pause",
        "mdi-stop",
        "mdi-music",
        "mdi-video",
        "mdi-volume-high",
        "mdi-volume-off",

        // Favoriten & Bewertung
        "mdi-heart",
        "mdi-heart-outline",
        "mdi-star",
        "mdi-star-outline",
        "mdi-thumb-up",
        "mdi-thumb-down",

        // Status & Aktionen
        "mdi-alert",
        "mdi-check",
        "mdi-close",
        "mdi-information",
        "mdi-help-circle",
        "mdi-loading",
        "mdi-lock",
        "mdi-lock-open",

        // Suchen & Filter
        "mdi-magnify",
        "mdi-filter-variant",
        "mdi-eye",
        "mdi-eye-off",

        // Dateien & Inhalte
        "mdi-file",
        "mdi-file-document",
        "mdi-file-plus",
        "mdi-folder",
        "mdi-upload",
        "mdi-download",
        "mdi-cloud-upload",
        "mdi-cloud-download",

        // Interface
        "mdi-plus",
        "mdi-minus",
        "mdi-arrow-left",
        "mdi-arrow-right",
        "mdi-arrow-up",
        "mdi-arrow-down",
        "mdi-chevron-left",
        "mdi-chevron-right",

        // Sonstiges
        "mdi-calendar",
        "mdi-clock",
        "mdi-bell",
        "mdi-bell-off",
        "mdi-trash-can",
        "mdi-pencil",
        "mdi-pencil-box",
        "mdi-dots-horizontal",
        "mdi-dots-vertical",
    ];

    const filteredIcons = computed(() =>
        icons.filter((i) => i.includes(search.value.toLowerCase()))
    );

    const selectIcon = (icon) => {
        emit("update:modelValue", icon);
        emit("close")
        menu.value = false;
    };

    const handleMenuToggle = (val) => {
        emit(val ? "open" : "close");
    };

    return {
        menu,
        search,
        handleMenuToggle,
        filteredIcons,
        selectIcon,
    };
}

export const iconListProps = {
    modelValue: String,
    label: String,
    prependIcon: String,
};