import {computed, ref} from "vue";
import {localData} from "@/dataLayer/local";

export function frameModel(emit) {
    const currentFrameIndex = ref(0);
    const isPlaying = ref(false);
    const intervalId = ref(null);
    const startTime = ref(null);
    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };
    const currentFrame = computed(() => {
        // Aktuellen Frame basierend auf currentFrameIndex berechnen
        const aniStack = localData.animation.value[0]?.buildMaps || [];
        return aniStack[currentFrameIndex.value]?.src || null;
    });

    const toggleAnimation = () => {
        if (isPlaying.value) {
            pauseAnimation();
        } else {
            playAnimation();
        }
    }

    const playAnimation = () => {
        isPlaying.value = true;
        startTime.value = performance.now(); // Setzt den Startzeitpunkt
        animateFrame();
    }

    const animateFrame = () => {
        const buildMaps = localData.animation.value[0]?.buildMaps || [];
        if (!isPlaying.value || buildMaps.length === 0) return;

        // Berechne die Zeit, die seit dem Start vergangen ist
        const now = performance.now();
        const elapsed = now - startTime.value;

        // Bestimme den aktuellen Frame basierend auf der verstrichenen Zeit
        currentFrameIndex.value = Math.floor(elapsed / 200) % buildMaps.length;

        // Plane den nächsten Frame, ohne Verzögerungen
        const nextFrameTime = startTime.value + (currentFrameIndex.value + 1) * 200;
        const delay = Math.max(nextFrameTime - performance.now(), 0);

        intervalId.value = setTimeout(() => {
            animateFrame();
        }, delay);
    }

    const pauseAnimation = () => {
        isPlaying.value = false;
        if (intervalId.value) {
            clearInterval(intervalId.value);
            intervalId.value = null;
        }
    }

    const selectDiffuseMap = (mapUrl) => {
        localData.output.value = mapUrl
    };

    return {
        currentFrameIndex,
        isPlaying,
        intervalId,
        startTime,
        currentFrame,
        emitEvent,
        toggleAnimation,
        selectDiffuseMap
    };
}

export const frameProps = {
};