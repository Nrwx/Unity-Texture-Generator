<template>
  <transition-group name="slide" tag="div">
    <v-card
        v-for="(msg, index) in visibleMessages"
        :key="msg.id"
        v-show="msg.active && !msg.mute"
        class="d-flex flex-column mb-4"
        :style="positionStyle(index)"
        variant="flat"
        :color="msg.color || 'surface'"

        :theme="theme"
    >
      <Gradient :base-color="msg.color" :id="msg.id">
        <v-card-title class="text-h6 d-flex justify-space-between align-center">
          <div class="d-flex align-center">
            <v-icon v-if="msg.icon" class="mr-2">{{ msg.icon }}</v-icon>
            {{ msg.name }}
          </div>
          <v-btn icon size="small" :color="msg.color" @click="mute(msg)">
            <v-icon>mdi-bell-off-outline</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text class="text-body-2">{{ msg.message }}</v-card-text>

        <v-card-actions>
          <v-btn text size="small" @click="remove(msg.id)">Schließen</v-btn>
        </v-card-actions>
      </Gradient>
    </v-card>
  </transition-group>
</template>

<script>
import { defineComponent } from "vue";
import {notifyModel, notifyProps} from "@/models/notify/model";
import Gradient from "@/components/Background/Gradient";

export default defineComponent({
  name: "NotifyComponent",
  components: {Gradient},
  props: notifyProps,
  setup(props, { emit }) {
    const {positionStyle,  visibleMessages,  mute,  remove } = notifyModel(props, emit);
    return {
      positionStyle,
      visibleMessages,
      mute,
      remove,
    };
  },
});
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.4s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.v-card {
  will-change: transform, opacity;
}
</style>