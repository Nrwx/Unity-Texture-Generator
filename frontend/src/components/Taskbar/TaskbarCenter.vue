<template>
  <v-container fluid class="d-flex justify-center align-center fixed-bottom">
    <v-card class="taskbar" flat>
      <v-row no-gutters class="justify-center align-center">
        <v-col v-for="(item, i) in items" :key="item.id" class="text-center">
          <v-btn
              class="taskbar-icon"
              :class="{ 'active': activeItem === item.id }"
              @click="toggleItem(item.id)"
          >
            <span>{{ item.shortcut }}</span>
          </v-btn>
          <v-menu v-if="item.subKeys && activeItem === item.id" v-model="subMenuOpen" activator="parent" offset-y>
            <v-list>
              <v-list-item v-for="subKey in item.subKeys" :key="subKey.id" @click="emitEvent(subKey.id)">
                <v-list-item-title>{{ subKey.shortcut }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<script>
import { defineComponent, ref } from "vue";
import { taskbarModel, taskbarProps } from "@/models/taskbar/model";
import TaskbarItem from "@/components/Taskbar/TaskbarItem";

export default defineComponent({
  name: "HorizontalTaskbar",
  props: taskbarProps,
  components: {
    TaskbarItem,
  },
  setup(props, { emit }) {
    const { taskbar, emitEvent } = taskbarModel(emit);
    const activeItem = ref(null);
    const subMenuOpen = ref(false);

    const toggleItem = (id) => {
      if (activeItem.value === id) {
        activeItem.value = null;
        subMenuOpen.value = false;
      } else {
        activeItem.value = id;
        subMenuOpen.value = true;
      }
    };

    return {
      taskbar,
      emitEvent,
      activeItem,
      subMenuOpen,
      toggleItem,
    };
  },
});
</script>

<style scoped>
.taskbar {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  padding: 5px;
  box-shadow: 0px -2px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  gap: 5px;
}
.taskbar-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: rgba(200, 200, 200, 0.2);
  border-radius: 12px;
  transition: background 0.3s;
  position: relative;
}
.taskbar-icon.active {
  border: 2px dashed red;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.taskbar-icon:hover {
  background: rgba(200, 200, 200, 0.5);
}
</style>
