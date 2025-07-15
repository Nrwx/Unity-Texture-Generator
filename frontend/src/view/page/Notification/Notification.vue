<template>
  <v-card flat :theme="theme" class="d-flex flex-wrap">
    <div style="width: 100%;" >
      <v-tabs v-model="activeTab" grow>
        <v-tab value="reminder">🕑 Erinnerung</v-tab>
        <v-tab value="system">⚙ System</v-tab>
      </v-tabs>
    </div>

    <div style="width: 100%;">
      <v-window v-model="activeTab">
        <!-- Erinnerung Tab -->
        <v-window-item value="reminder">
          <v-card min-height="300">
            <template v-if="!menu">
              <v-list two-line>
                <v-list-item
                    v-for="(r) in messages"
                    :key="r.id"
                    class="mb-4 rounded-lg elevation-1 px-4 py-2"
                >
                  <v-row no-gutters align="center" justify="space-between" class="w-100">

                    <!-- Icon & Farbe -->
                    <v-col cols="auto">
                      <v-avatar size="48" tile>
                        <v-icon style="opacity: .5;" size="36" :color="r.color">{{ r.icon }}</v-icon>
                      </v-avatar>
                    </v-col>

                    <!-- Nachrichtentext -->
                    <v-col class="ml-6 d-block overflow-hidden">
                      <div class="text-subtitle-1 text-truncate" style="max-width: 50%; font-variant: all-petite-caps;" :style="`color: ${r.color};`">{{ r.name }}</div>
                      <div class="text-subtitle-2 text-sm text-truncate" style="max-width: 70%; opacity: .5">{{ r.message }}</div>

                      <div v-if="r.timeLeft" class="text-caption mt-1 text-grey-darken-1">
                        ⏳ Ausführen in: {{ formatDuration(r.timeLeft) }}
                      </div>
                      <div v-else-if="r.rTimeLeft" class="text-caption mt-1 text-grey-darken-1">
                        🔁 Erinnern in: {{ formatDuration(r.rTimeLeft) }}
                      </div>
                      <div v-else-if="r.mute" class="text-caption mt-1 text-grey-darken-1">
                        🔕 ist stumm...
                      </div>
                      <div v-else-if="!r.complete" class="text-caption mt-1 text-grey-darken-1">
                        ⏱ wird ausgeführt...
                      </div>
                      <div v-else class="text-caption mt-1 text-grey-darken-1">
                        ✅ ist abgeschlossen!
                      </div>
                    </v-col>

                    <!-- Aktionen: Mute & Löschen -->
                    <v-col cols="auto" class="d-flex align-center gap-2">
                      <!-- Mute -->
                      <div class="d-flex align-center align-center mr-2">
                        <v-switch
                            v-model="r.mute"
                            @change="toggleMute(r)"
                            hide-details
                            inset
                            class="mr-2"
                            color="primary"
                            density="compact"
                            :append-icon="r.mute ? 'mdi-bell-off' : 'mdi-bell' "
                        />
                      </div>

                      <!-- Löschen -->
                      <v-btn icon @click="deleteMsg(r)" color="red" variant="text">
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </v-col>

                  </v-row>
                </v-list-item>
              </v-list>
              <v-btn
                  class="fab-option"
                  color="#007BFF"
                  icon
                  fab
                  size="small"
                  @click="toggleMenu(menu)"
                  style="position: absolute;"
              >
                <v-icon>mdi-plus</v-icon>
              </v-btn>
            </template>
            <!-- Menu Overlay -->
            <template v-else>
              <v-card>
                <v-toolbar dense>
                  <v-btn icon @click="toggleMenu(menu)"><v-icon>mdi-close</v-icon></v-btn>
                  <v-toolbar-title>Erinnerung erstellen</v-toolbar-title>
                </v-toolbar>

                <v-container>
                  <Form @component-event="emitEvent" v-model:operation="operation" v-model:item="config" />

                  <v-btn flat class="mt-4" @click="saveAndClose">Speichern</v-btn>
                </v-container>
              </v-card>
            </template>
          </v-card>
        </v-window-item>

        <!-- System Tab -->
        <v-window-item value="system">
          <v-card>
            <v-list>
              <v-list-item v-for="(log, i) in systemLogs" :key="i">
                <v-list-item-title>{{ log.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ log.message }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </v-window-item>
      </v-window>
    </div>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import { notificationModel, notificationProps } from "@/view/models/page/notification/model";
import Form from "@/components/Form/Form";

export default defineComponent({
  name: "NotifyPanelPage",
  props: {
    notificationProps,
  },
  components: {
    Form
  },
  setup(props, { emit }) {
    const {
      theme,
      messages,
      menu,
      config,
      operation,
      emitEvent,
      systemLogs,
      activeTab,
      saveAndClose,
      toggleMute,
      toggleMenu,
      formatDuration,
      deleteMsg,
    } = notificationModel(props, emit);

    return {
      theme,
      messages,
      menu,
      activeTab,
      config,
      operation,
      systemLogs,
      saveAndClose,
      emitEvent,
      toggleMute,
      toggleMenu,
      formatDuration,
      deleteMsg,

    };
  },
});
</script>

<style scoped>
.fab-option {
  bottom: 10px;
  right: 10px;
  z-index: 1;
}
</style>
