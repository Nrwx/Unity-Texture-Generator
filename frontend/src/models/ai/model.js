import { ref } from "vue";
import {windowStates} from "@/dataLayer/state";

export const aiProps = {};

export function aiModel(emit) {
    const prompt = ref("");
    const model = ref("dall-e-2");
    const loading = ref(false);

    const suggestions = [
        "Ein Astronaut auf einem Einhorn",
        "Cyberpunk-Stadt bei Nacht",
        "Ein Fuchs im Anzug im Regenwald",
        "Steampunk-Roboter mit Katze",
        "Ein futuristisches Auto auf dem Mars",
    ];

    const useSuggestion = (text) => {
        prompt.value = text;
    };

    const emitEvent = (event, payload) => {
        emit("ai-event", event, payload);
        return true
    };

    const generate = async () => {
        if (!prompt.value) return;
        loading.value = true;
        const event = emitEvent("image:generate", {msg: prompt.value, model: model.value});
        if(event) {
            loading.value = false;
        }
    };

    const onFocus = () => {
        windowStates.typing.value = true;
    };

    const onBlur = () => {
        windowStates.typing.value = false;
    };

    return {
        emitEvent,
        onFocus,
        onBlur,
        model,
        prompt,
        loading,
        suggestions,
        useSuggestion,
        generate,
    };
}
