<template>
  <!-- Layer-Liste -->
  <v-list density="comfortable" two-line class="layer-list overflow-hidden" bg-color="transparent">
    <v-list-item
        v-for="(channel) in data"
        :key="channel.id"
        :data-id="channel.id"
        class="layer-item"
    >
      <div class="d-flex align-baseline">
        <v-text-field
            v-model="channel.name"
            variant="outlined"
            min-width="100"
            max-width="150"
            :hide-details="true"
            @click.stop
        >
          <template v-slot:prepend-inner>
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-avatar v-bind="props" rounded="0" variant="elevated">
                  <v-img :src="channel?.thumbnail || channel?.url" :alt="channel.name" />
                </v-avatar>
              </template>
              {{ channel.name }}
            </v-tooltip>
          </template>
        </v-text-field>
      </div>
    </v-list-item>
  </v-list>
</template>

<script>
import {defineComponent} from "vue";
import {channelModel, channelProps} from "@/models/channel/model";

export default defineComponent({
  name: "ChannelComponent",
  props: channelProps,
  setup(props, { emit }) {
    const { emitEvent } = channelModel(props, emit);
    return {
      emitEvent
    };
  },
});
</script>

<style scoped lang="scss">
@import "./_Channel.scss";
</style>