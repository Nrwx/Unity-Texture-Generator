export const pluginEvent = (route) => {
    const setPluginsFromResponse = async (data) => {
        if (Array.isArray(data)) {
            route.localData.plugins.value = data;
            return true;
        }

        if (Array.isArray(data?.plugins)) {
            route.localData.plugins.value = data.plugins;
            return true;
        }

        if (Array.isArray(data?.scan?.plugins)) {
            route.localData.plugins.value = data.scan.plugins;
            return true;
        }

        return false;
    };

    const refreshFallback = async (data) => {
        const updated = await setPluginsFromResponse(data);

        if (!updated) {
            await route.emit("plugin:fetch");
        }

        return data;
    };

    const requirePluginId = (pluginId, actionName) => {
        if (!pluginId) {
            console.warn(`Plugin-Aktion '${actionName}' abgebrochen: pluginId fehlt.`);
            return false;
        }

        return true;
    };

    return {
        "plugin:scan": async () => {
            try {
                const data = await route.api.scanPlugin();
                await refreshFallback(data);
            } catch (error) {
                console.error("Fehler beim Scannen der Plugins:", error);
            }
        },

        "plugin:install-all": async () => {
            try {
                const data = await route.api.installAllPlugin();
                await refreshFallback(data);
            } catch (error) {
                console.error("Fehler beim Installieren/Vorbereiten der Plugins:", error);
            }
        },

        "plugin:install": async ({ pluginId } = {}) => {
            if (!requirePluginId(pluginId, "install")) return;

            try {
                const data = await route.api.installPlugin(pluginId);
                await refreshFallback(data);
            } catch (error) {
                console.error(`Fehler beim Installieren des Plugins '${pluginId}':`, error);
            }
        },

        "plugin:upload": async ({ file } = {}) => {
            if (!file) {
                console.warn("Plugin-Upload abgebrochen: file fehlt.");
                return;
            }

            try {
                const data = await route.api.uploadPlugin(file);
                await refreshFallback(data);
            } catch (error) {
                console.error("Fehler beim Hochladen des Plugins:", error);
            }
        },

        "plugin:repair": async ({ pluginId } = {}) => {
            if (!requirePluginId(pluginId, "repair")) return;

            try {
                const data = await route.api.repairPlugin(pluginId);
                await refreshFallback(data);
            } catch (error) {
                console.error(`Fehler beim Reparieren des Plugins '${pluginId}':`, error);
            }
        },

        "plugin:pause": async ({ pluginId } = {}) => {
            if (!requirePluginId(pluginId, "pause")) return;

            try {
                const data = await route.api.pausePlugin(pluginId);
                await refreshFallback(data);
            } catch (error) {
                console.error(`Fehler beim Pausieren des Plugins '${pluginId}':`, error);
            }
        },

        "plugin:uninstall": async ({ pluginId } = {}) => {
            if (!requirePluginId(pluginId, "uninstall")) return;

            try {
                const data = await route.api.uninstallPlugin(pluginId);
                await refreshFallback(data);
            } catch (error) {
                console.error(`Fehler beim Deinstallieren des Plugins '${pluginId}':`, error);
            }
        },

        "plugin:toggle": async ({ pluginId } = {}) => {
            if (!requirePluginId(pluginId, "toggle")) return;

            try {
                const data = await route.api.togglePlugin(pluginId);
                await refreshFallback(data);
            } catch (error) {
                console.error(`Fehler beim Umschalten des Plugins '${pluginId}':`, error);
            }
        },

        "plugin:fetch": async () => {
            try {
                const data = await route.api.fetchPlugin();
                await setPluginsFromResponse(data);
            } catch (error) {
                console.error("Fehler beim Abrufen der Plugins:", error);
            }
        },
    };
};