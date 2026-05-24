import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const DEFAULT_DURATION = 7;

const normalizeMetric = metric => ({
    title: "",
    subtitle: "",
    eyebrow: "",
    type: "text",
    label: "",
    value: 0,
    max: null,
    active: false,
    disabled: false,

    // Auto rotation
    diashow: false,
    duration: DEFAULT_DURATION,

    // Manual slider controls
    slider: false,

    ...(metric || {}),
});

export function headerMetricModel(props) {
    const metricIndex = ref(0);
    let timer = null;

    const metrics = computed(() => {
        const config = props.config;

        return (Array.isArray(config) ? config : [config])
            .filter(Boolean)
            .map(normalizeMetric);
    });

    const metricCount = computed(() => metrics.value.length);

    const safeMetricIndex = computed(() => {
        const count = metricCount.value;

        if (!count) {
            return 0;
        }

        return metricIndex.value % count;
    });

    const activeMetric = computed(() => {
        return metrics.value[safeMetricIndex.value] || normalizeMetric();
    });

    const hasMultipleMetrics = computed(() => {
        return metricCount.value > 1;
    });

    const showMetricSlider = computed(() => {
        return Boolean(
            hasMultipleMetrics.value &&
            activeMetric.value.slider === true
        );
    });

    const progressPercent = computed(() => {
        const value = Number(activeMetric.value.value);
        const max = Number(activeMetric.value.max);

        if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
            return 0;
        }

        return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
    });

    const hasMax = computed(() => {
        const max = activeMetric.value.max;

        return max !== undefined && max !== null && max !== "";
    });

    const metricValueLabel = computed(() => {
        const value = activeMetric.value.value ?? 0;

        if (hasMax.value) {
            return `${value} / ${activeMetric.value.max}`;
        }

        return `${value}`;
    });

    const metricKey = computed(() => {
        const metric = activeMetric.value;

        return [
            safeMetricIndex.value,
            metric.type,
            metric.label,
            metric.value,
            metric.max,
        ].join("-");
    });

    const copyKey = computed(() => {
        const metric = activeMetric.value;

        return [
            safeMetricIndex.value,
            metric.eyebrow,
            metric.subtitle,
        ].join("-");
    });

    const nextMetric = () => {
        if (metricCount.value <= 1) {
            return;
        }

        metricIndex.value = (safeMetricIndex.value + 1) % metricCount.value;
    };

    const previousMetric = () => {
        if (metricCount.value <= 1) {
            return;
        }

        metricIndex.value =
            (safeMetricIndex.value - 1 + metricCount.value) % metricCount.value;
    };

    const getDuration = () => {
        const duration = Number(activeMetric.value.duration || DEFAULT_DURATION);

        return Number.isFinite(duration) && duration > 0
            ? duration
            : DEFAULT_DURATION;
    };

    const stopTimer = () => {
        if (!timer) {
            return;
        }

        window.clearInterval(timer);
        timer = null;
    };

    const startTimer = () => {
        stopTimer();

        if (!hasMultipleMetrics.value || activeMetric.value.diashow === false) {
            return;
        }

        timer = window.setInterval(nextMetric, getDuration() * 1000);
    };

    const handleNextMetric = () => {
        nextMetric();
    };

    const handlePreviousMetric = () => {
        previousMetric();
    };

    onMounted(startTimer);
    onBeforeUnmount(stopTimer);

    return {
        metrics,
        metricIndex: safeMetricIndex,
        activeMetric,
        hasMultipleMetrics,
        showMetricSlider,
        progressPercent,
        metricValueLabel,
        metricKey,
        copyKey,
        handleNextMetric,
        handlePreviousMetric,
    };
}

export const headerMetricProps = {
    config: {
        type: [Object, Array],
        required: true,
    },
};

export const headerMetricEmits = [
    "click",
];