<template>
  <v-card class="pa-4">
    <v-select
        width="100%"
        class="mb-3"
        v-model="model"
        :items="['gpt-image-1', 'dall-e-2', 'dall-e-3']"
        label="Modell wählen"
        dense
        outlined
        hide-details
    />

    <v-textarea
        width="100%"
        v-model="prompt"
        label="Prompt eingeben"
        placeholder="z.B. Eine Katze im Anzug auf dem Mars"
        clearable
        rows="4"
        auto-grow
        style="resize: vertical;"
        @focus="onFocus"
        @blur="onBlur"
    />

    <v-chip-group
        class="my-3"
        column
    >
      <v-chip
          v-for="suggestion in suggestions"
          :key="suggestion"
          @click="useSuggestion(suggestion)"
          class="ma-1"
          color="primary"
          variant="outlined"
      >
        {{ suggestion }}
      </v-chip>
    </v-chip-group>

    <v-btn
        color="deep-purple-accent-4"
        variant="elevated"
        block
        :loading="loading"
        @click="generate"
    >
      Bild generieren
    </v-btn>
  </v-card>
</template>

<script>
import { defineComponent } from "vue";
import {aiModel, aiProps} from "@/models/ai/model";

export default defineComponent({
  name: "AiComponent",
  props: aiProps,
  setup(props, { emit }) {
    const { emitEvent, prompt, onFocus, onBlur, model, loading, suggestions, useSuggestion, generate   } = aiModel(emit);
    return {
      emitEvent,
      prompt,
      loading,
      onFocus,
      onBlur,
      suggestions,
      useSuggestion,
      generate,
      model
    };
  },
});
</script>

