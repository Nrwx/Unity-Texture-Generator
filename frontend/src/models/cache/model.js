import {ref, computed, onMounted, watch} from "vue";
import {number} from "@/utils/math";

/**
 * Props shape:
 * props.data = {
 *   asset_files: { files, percent, size_bytes, size_mb },
 *   cache_files: { ... },
 *   session_files: { ... },
 *   total_files: { ... }
 * }
 *
 * Emits:
 * - component-event: 'clear-cache'  payload { projectId? }
 * - component-event: 'terminate-session' payload {}
 * - component-event: 'refresh' payload {}
 */

export const cacheProps = {
    data: { type: Object, required: true },
    theme: { type: String, required: false, default: '' },
    projectId: { type: String, required: false }
};

export function cacheModel(props, emit) {
    // --- normalize input: accept either `assets` or `asset_files` naming
    function normalizeSection(obj, keys) {
        for (const k of keys) {
            if (obj && obj[k] !== undefined) return obj[k];
        }
        return { files: 0, percent: 0, size_bytes: 0, size_mb: 0 };
    }

    const cacheLoading = ref(false)
    const asset = computed(() => normalizeSection(props.data, ['assets', 'asset_files']));
    const session = computed(() => normalizeSection(props.data, ['session', 'session_files']));
    const cache = computed(() => normalizeSection(props.data, ['cache', 'cache_files']));
    const total = computed(() => normalizeSection(props.data, ['total', 'total_files']));
    // widths for segments (size-based), start at 0 for animation
    const segWidths = ref({ asset: 0, session: 0, cache: 0 });
    const fillWidths = ref({ asset: 0, session: 0, cache: 0 });

    // file-percents (files / total.files *100)
    const filePercents = computed(() => {
        const t = Math.max(1, number(total.value.files || 0));
        const af = Math.round((number(asset.value.files || 0) / t) * 100);
        const sf = Math.round((number(session.value.files || 0) / t) * 100);
        const cf = Math.round((number(cache.value.files || 0) / t) * 100);
        const sum = af + sf + cf;
        if (sum === 100) return { asset: af, session: sf, cache: cf };
        const factor = 100 / Math.max(0.0001, sum);
        return {
            asset: Math.round(af * factor),
            session: Math.round(sf * factor),
            cache: Math.round(cf * factor),
        };
    });

    // arc stroke arrays / offsets using circumference technique
    const R = 88;
    const circumference = 2 * Math.PI * R;
    const arcDash = ref({ asset: `0 ${circumference.toFixed(2)}`, session: `0 ${circumference.toFixed(2)}`, cache: `0 ${circumference.toFixed(2)}` });
    const arcOffset = ref({ asset: `${circumference.toFixed(2)}`, session: `${circumference.toFixed(2)}`, cache: `${circumference.toFixed(2)}` });


// small helpers
    const fmtMb = (v) => (v == null ? '0.00' : number(v).toFixed(2));


    const canClearCache = computed(() => number(cache.value.files || 0) > 0);
    const canClearCacheGlobally = computed(() => canClearCache.value);

    // emit wrapper
    function emitEvent(name, payload = {}) {
        emit("component-event", name, payload);
    }
    function onRefresh() {
        emitEvent("app:refresh-cache", props.projectId);
    }
    function onClearCache() {
        cacheLoading.value = true;
        emitEvent("app:clear-cache", props.projectId);
        cacheLoading.value = false;
    }

    // normalize percents for size-based visualization
    function normalizePercents(a, s, c) {
        const A = Math.max(0, number(a || 0));
        const S = Math.max(0, number(s || 0));
        const C = Math.max(0, number(c || 0));
        const sum = Math.max(0.0001, A + S + C);
        const fac = 100 / sum;
        const aset = Math.round(A * fac * 100) / 100;
        const sset = Math.round(S * fac * 100) / 100;
        const cset = Math.round(C * fac * 100) / 100;
        return { aset, sset, cset };
    }

    // compute visuals
    function updateVisuals(animated = true) {
        const a = Math.max(0, number(asset.value.percent || 0));
        const s = Math.max(0, number(session.value.percent || 0));
        const c = Math.max(0, number(cache.value.percent || 0));
        const { aset, sset, cset } = normalizePercents(a, s, c);

        if (animated) {
            setTimeout(() => {
                segWidths.value = { asset: aset, session: sset, cache: cset };
                fillWidths.value = { asset: aset, session: sset, cache: cset };
            }, 60);
        } else {
            segWidths.value = { asset: aset, session: sset, cache: cset };
            fillWidths.value = { asset: aset, session: sset, cache: cset };
        }

        let aLen = (aset / 100) * circumference;
        let sLen = (sset / 100) * circumference;

        let cLen = Math.max(0, circumference - aLen - sLen);

        aLen = Math.max(0, Math.min(aLen, circumference));
        sLen = Math.max(0, Math.min(sLen, circumference));
        cLen = Math.max(0, Math.min(cLen, circumference));

        arcDash.value.asset = `${aLen.toFixed(2)} ${Math.max(0, circumference - aLen).toFixed(2)}`;
        arcDash.value.session = `${sLen.toFixed(2)} ${Math.max(0, circumference - sLen).toFixed(2)}`;
        arcDash.value.cache = `${cLen.toFixed(2)} ${Math.max(0, circumference - cLen).toFixed(2)}`;

        const startAsset = 0;
        const startSession = aLen;
        const startCache = aLen + sLen;

        arcOffset.value.asset = `${Math.max(0, (circumference - startAsset)).toFixed(2)}`;
        arcOffset.value.session = `${Math.max(0, (circumference - startSession)).toFixed(2)}`;
        arcOffset.value.cache = `${Math.max(0, (circumference - startCache)).toFixed(2)}`;
    }

    // pill items reactive
    const pillItems = computed(() => [
        { key: 'asset', title: 'System', value: asset.value, class: 'asset-gradient', color: 'asset-background' },
        { key: 'session', title: 'Session', value: session.value, class: 'session-gradient', color: 'session-background' },
        { key: 'cache', title: 'Cache', value: cache.value, class: 'cache-gradient', color: 'cache-background' },
    ]);

    // watch input data changes
    watch(() => props.data, () => {
        updateVisuals(true);
    }, { deep: true });

    onMounted(() => {
        updateVisuals(true);
    });

    // expose
    return {
        asset,
        session,
        cache,
        total,
        segWidths,
        fillWidths,
        pillItems,
        filePercents,
        arcDash,
        arcOffset,
        fmtMb,
        canClearCache,
        canClearCacheGlobally,
        radialAria: computed(() => `Files split: ${filePercents.value.asset}% system, ${filePercents.value.session}% session, ${filePercents.value.cache}% cache`),
        onRefresh,
        onClearCache
    };
}
