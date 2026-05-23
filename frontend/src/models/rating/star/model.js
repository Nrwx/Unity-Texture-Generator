import {uuid} from "@/utils/uuid";
import {computed, ref, watch} from "vue";
import {number} from "@/utils/math";

export function starRatingModel(props, emit) {
    const uid = uuid('sr');
    const detailsRef = ref(null);
    const ratingDisplay = computed(() => (props.rating ? String(props.rating).toUpperCase() : ''));
    const ratingClass = computed(() => {
        const r = (props.rating || '').toString().toUpperCase();
        if (r === 'HIGH') return 'rating-high';
        if (r === 'MEDIUM') return 'rating-medium';
        return 'rating-low';
    });
    const emitEvent = (event, payload) => emit("component-event", event, payload);

    // Normalisiere score -> percent (0..100)
    const percent = computed(() => {
        let s = number(props.score) || 0;
        // Heuristik: wenn Backend 0..1 liefert, skaliere nach 0..100
        if (s <= 1 && s > 0) s = s * 100;
        s = Math.max(0, Math.min(100, s));
        // auf 2 Dez. runden
        return Math.round(s * 100) / 100;
    });

    const panelOpen = ref(percent.value < 50);

    // Fraction für einen Stern-Index (0..4) zurückgeben (0..1)
    const starFraction = (pct, index) => {
        const low = index * 20;
        const high = (index + 1) * 20;
        if (pct >= high) return 1;
        if (pct <= low) return 0;
        return (pct - low) / 20;
    }

    // wenn user toggled, sync panelOpen
    const onToggle = (e) =>{
        panelOpen.value = e.target.open;
    }

    watch(percent, (p) => {
        if (p < 50) panelOpen.value = true;
        // setze DOM open falls ref existiert
        if (detailsRef.value) detailsRef.value.open = panelOpen.value;
    });


    return {
        emitEvent,
        percent,
        ratingDisplay,
        ratingClass,
        uid,
        panelOpen,
        detailsRef,
        starFraction,
        onToggle
    };
}

export const starRatingProps = {
    score: {
        type: Number,
        default: false,
    },
    rating: {
        type: String,
        default: '',
    },
    recommended: {
        type: Object,
        required: true,
    },
    size: {
        type: [Number, String],
        default: 28,
    },
    theme: {
        type: String,
        required: true,
    }
};