
<template>
  <v-list density="comfortable" two-line class="layer-list channel-list overflow-hidden pa-2" bg-color="transparent">
    <v-list-item
        v-for="(channel) in data.filter(x => !x?.combined)"
        :key="channel.id"
        :data-id="channel.id"
        class="channel-item d-flex align-center ga-2 py-2"
    >
      <div class="channel-row w-100 d-flex center justify-space-between">
        <v-text-field
            v-model="channel.name"
            variant="outlined"
            min-width="160"
            :hide-details="true"
            @click.stop
            class="channel-field flex-1-1"
        >
          <template v-slot:prepend-inner>
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-avatar v-bind="props" rounded="0" variant="elevated" class="channel-avatar overflow-hidden mr-2">
                  <v-img :src="channel?.thumbnail || channel?.url" :alt="channel.name" />
                </v-avatar>
              </template>
              {{ channel.name }}
            </v-tooltip>
          </template>
        </v-text-field>

        <div class="channel-controls d-flex align-center ga-2 ml-2">
          <button type="button" class="btn" @click="handleChannel(channel.id)">Mix</button>
        </div>
      </div>
    </v-list-item>
  </v-list>
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