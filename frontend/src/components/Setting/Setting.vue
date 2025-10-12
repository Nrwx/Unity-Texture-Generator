<template>
  <Dialog
      @update:component-event="emitEvent"
      :state="state"
      :data="config"
      :loading="loading"
      :theme="theme"
  >
    <template #content>
      <v-container fluid class="pa-0 setting-container">
        <v-row no-gutters class="h-100">

          <!-- ===== LEFT SIDEBAR ===== -->
          <v-col
              :cols="sidebarCollapsed ? 1 : 3"
              class="sidebar elevation-2 d-flex flex-column"
          >
            <div class="sidebar-header d-flex align-center justify-space-between px-2 py-2">
              <span v-if="!sidebarCollapsed" class="text-grey-lighten-1 font-weight-medium">Settings</span>
              <v-btn
                  icon
                  size="small"
                  variant="text"
                  @click="sidebarCollapsed = !sidebarCollapsed"
              >
                <v-icon>{{ sidebarCollapsed ? 'mdi-chevron-right' : 'mdi-chevron-left' }}</v-icon>
              </v-btn>
            </div>

            <v-expand-transition>
              <div v-show="!sidebarCollapsed" class="sidebar-content flex-grow-1 overflow-y-auto">
                <!-- Search -->
                <v-text-field
                    v-model="search"
                    density="compact"
                    placeholder="Search..."
                    prepend-inner-icon="mdi-magnify"
                    hide-details
                    class="ma-2"
                    variant="outlined"
                ></v-text-field>

                <!-- Category List -->
                <v-list density="compact" nav>
                  <v-list-subheader>Categories</v-list-subheader>
                  <v-list-group
                      v-for="cat in filteredCategories"
                      :key="cat.id"
                      :value="isSelected(cat)"
                      no-action
                  >
                    <template #activator>
                      <v-list-item @click="selectCategory(cat)">
                        <v-list-item-title>{{ cat.name }}</v-list-item-title>
                      </v-list-item>
                    </template>

                    <v-list-item
                        v-for="sub in cat.subCategories"
                        :key="sub.id"
                        @click="selectSubCategory(cat.id, sub.id)"
                        :active="selectedCategory?.id === cat.id && selectedSubCategory === sub.id"
                        class="pl-6"
                    >
                      <v-list-item-title>{{ sub.name }}</v-list-item-title>
                    </v-list-item>
                  </v-list-group>
                </v-list>
              </div>
            </v-expand-transition>

            <!-- Icon-only view when collapsed -->
            <div v-if="sidebarCollapsed" class="sidebar-icons-only flex-grow-1 overflow-y-auto py-2">
              <v-list density="compact" nav>
                <v-list-item
                    v-for="cat in filteredCategories"
                    :key="cat.id"
                    @click="selectCategory(cat)"
                    :active="selectedCategory?.id === cat.id"
                    class="d-flex justify-center"
                >
                  <v-icon size="20">{{ cat.icon }}</v-icon>
                </v-list-item>
              </v-list>
            </div>
          </v-col>

          <!-- ===== RIGHT CONTENT ===== -->
          <v-col :cols="sidebarCollapsed ? 11 : 9" class="content pa-4">
            <v-card class="pa-4" variant="outlined">
              <v-card-title>{{ selectedCategory?.name || 'Settings Overview' }}</v-card-title>
              <v-divider class="my-3"></v-divider>

              <!-- Formular -->
              <v-form v-if="selectedCategory">
                <v-text-field
                    v-for="(value, key) in settings[selectedCategory.id]"
                    :key="key"
                    :id="`${selectedCategory.id}-${key}`"
                    v-model="settings[selectedCategory.id][key]"
                    :label="formatLabel(key)"
                    :type="typeof value === 'number' ? 'number' : 'text'"
                    class="mb-2"
                ></v-text-field>
              </v-form>

              <v-form v-else>
                <p class="text-grey">Select a category to view or modify settings.</p>
              </v-form>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </template>

    <template #action>
      <v-btn color="primary" @click="emitEvent('save-setting', settings)">Save</v-btn>
    </template>
  </Dialog>
</template>

<script>
import { defineComponent } from "vue";
import {settingModel, settingProps} from "@/models/setting/model";
import Dialog from "@/components/Dialog/Dialog.vue";

export default defineComponent({
  name: "SettingComponent",
  components: {Dialog},
  props: settingProps,
  setup(props, { emit }) {
    const {
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
    } = settingModel(props, emit);
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
  },
});
</script>

<style scoped lang="scss">
@import "./_Setting";
</style>