import { ref } from "vue";

export const aiProps = {};

export function aiModel(emit) {
    const prompt = ref("");
    const model = ref("dall-e-2");
    const loading = ref(false);

    const modelOptions = [
        { title: "GPT Image 1", value: "gpt-image-1" },
        { title: "DALL·E 2", value: "dall-e-2" },
        { title: "DALL·E 3", value: "dall-e-3" },

        { title: "Stable Diffusion 1.5 (lokal)", value: "sd15" },
        { title: "SDXL (lokal)", value: "sdxl" }
    ];

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
        return true;
    };

    const generate = async () => {
        if (!prompt.value) return;

        loading.value = true;

        try {
            await emitEvent("image:generate", {
                msg: prompt.value,
                model: model.value,
                size: "512x512",
                layer_type: 0
            });
        } finally {
            loading.value = false;
        }
    };

    const onFocus = () => {
        emitEvent("rule:allow-form", true);
    };

    const onBlur = () => {
        emitEvent("rule:allow-form", false);
    };

    return {
        emitEvent,
        onFocus,
        onBlur,
        model,
        modelOptions,
        prompt,
        loading,
        suggestions,
        useSuggestion,
        generate,
    };
}