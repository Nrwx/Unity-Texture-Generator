<template>
  <section class="channel-list">
    <article
        v-for="channel in data.filter(x => !x?.combined)"
        :key="channel.id"
        :data-id="channel.id"
        class="channel-item"
        :class="{ selected: selectedChannel.find(x => x.id === channel.id) }"
        @click="toggleChannelSelection(channel)"
    >
      <button
          type="button"
          class="channel-toggle"
          :class="{ active: settings[channel.key] }"
          @click.stop="toggleChannel(channel)"
      >
        <v-icon size="15">
          {{ settings[channel.key] ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}
        </v-icon>
      </button>

      <div class="channel-avatar">
        <img
            v-if="channel?.thumbnail || channel?.url"
            :src="channel?.thumbnail || channel?.url"
            :alt="channel.name"
        />
        <v-icon v-else size="18">mdi-image-outline</v-icon>
      </div>

      <input
          class="channel-name"
          v-model="channel.name"
          @click.stop
      />

      <button
          type="button"
          class="channel-action"
          @click.stop="handleChannel(channel.id)"
      >
        <v-icon size="16">mdi-tune-vertical</v-icon>
      </button>
    </article>
  </section>
</template>

<script>
import { defineComponent } from "vue";
import { channelModel, channelProps } from "@/models/channel/model";

export default defineComponent({
  name: "ChannelComponent",
  props: channelProps,
  setup(props, { emit }) {
    const model = channelModel(props, emit);
    return { ...model };
  },
});
</script>

<style scoped lang="scss">
@use "./_Channel";
</style>