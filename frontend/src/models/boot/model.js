import {computed, nextTick, onMounted, onUnmounted, reactive, ref} from "vue";
import {ctxReady} from "@/utils/DOM/ctxReady";
import {ctxCheck} from "@/utils/DOM/ctxCheck";
import {ctxXhr} from "@/utils/DOM/ctxXhr";
import {uuid} from "@/utils/uuid";
import {clsManager} from "@/utils/DOM/clsManager";

export function bootModel(props, emit) {
    const emitEvent = (event, payload) => emit("component-event", event, payload);

    const terminalId = ref(uuid());
    const maxLines = 600;
    const expanded = ref(false);
    const spinningActive = ref(true);
    const cls = ref({
        "body": ["scrollbar-hidden"],
        "html": ["scrollbar-hidden"]
    });
    const progress = ref(0);
    const processedCount = ref(0);
    const totalCount = ref(0);
    const lines = ref([]);
    const timeline = reactive([
        {key: 'init', label: 'Boot init', status: 'pending', sub: ''},
        {key: 'dom', label: 'DOM & Styles', status: 'pending', sub: ''},
        {key: 'assets-scan', label: 'Scan assets', status: 'pending', sub: ''},
        {key: 'assets-check', label: 'Check resources', status: 'pending', sub: ''},
        {key: 'dom-cls', label: 'Prepare Config', status: 'pending', sub: ''},
        {key: 'final', label: 'Finalize', status: 'pending', sub: ''},
    ]);

    const pct = computed(() => Math.round(progress.value * 100));
    const topMessage = computed(() => {
        const active = timeline.find(t => t.status === 'pending') || timeline[timeline.length - 1];
        return `${active ? active.label : 'Ready'}`;
    });
    const timelinePreview = computed(() => timeline.slice(0, 3));
    const totalCountDisplay = computed(() => totalCount.value || '—');
    const terminalRef = ref(null);

    const _scrollBotton = async () => {
        await nextTick()
        const rect = terminalRef.value.getBoundingClientRect();
        const th = terminalRef.value.scrollHeight;
        const vh = rect.height;

        if (th > vh) {
            terminalRef.value.scrollTop = th - vh;
        }
    }
    async function pushLine(html, raw = '') {
        const ts = new Date();
        const time = ts.toLocaleTimeString();
        lines.value.push({time, html, raw});
        if (lines.value.length > maxLines) lines.value.splice(0, lines.value.length - maxLines);
        await nextTick(async () => {
            await _scrollBotton()
        });
    }

    function safeHtml(s) {
        if (!s) return '';
        const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return esc.replace(/(https?:\/\/\S+|\/\S+)/g, (m) => `<span class="hl">${m}</span>`);
    }

    function dotClass(status) {
        if (status === 'ok') return 'ok';
        if (status === 'fail') return 'fail';
        return 'wait';
    }

    function nodeClass(status) {
        return status === 'ok' ? 'ok' : status === 'fail' ? 'fail' : 'wait';
    }

    function setTimeline(key, status, sub) {
        const n = timeline.find(t => t.key === key);
        if (n) {
            n.status = status;
            n.sub = sub || n.sub;
        }
    }

    let unsubXHR = null;

    function subscribeXHR() {
        unsubXHR = ctxXhr(async (ev, payload) => {
            if (ev === 'xhr-progress:start') {
                spinningActive.value = true;
                await pushLine(`<span class="ps-mut">[XHR]</span> start: ${safeHtml(payload.url)}`);
                progress.value = Math.min(progress.value + 0.02, 0.95);
            } else if (ev === 'xhr-progress:update') {
                if (payload.progress) {
                    const base = 0.25, span = 0.55;
                    const mapped = base + Math.min(1, payload.progress) * span;
                    progress.value = Math.max(progress.value, mapped);
                }
                await pushLine(`<span class="ps-mut">[XHR]</span> update: ${safeHtml(payload.url)} ${payload.progress ? Math.round(payload.progress * 100) + '%' : ''}`);
            } else if (ev === 'xhr-progress:done') {
                await pushLine(`<span class="ps-mut">[XHR]</span> done: ${safeHtml(payload.url)} ${payload.duration ? '(' + payload.duration + 'ms)' : ''}`);
                progress.value = Math.min(1, progress.value + 0.04);
            }
        });
    }

    async function runBoot() {
        try {
            setTimeline('init', 'ok', 'starting');
            await pushLine(`<span class="ps-mut">[BOOT]</span> Boot sequence started`);
            progress.value = 0.03;
            subscribeXHR();
            await delay(220);
            setTimeline('dom', 'pending', 'checking DOM & styles');
            await pushLine(`<span class="ps-mut">[CHECK]</span> Waiting for DOM & styles to settle...`);
            const domOk = await ctxReady();
            setTimeline('dom', domOk ? 'ok' : 'fail', domOk ? 'ok' : 'not-ready');
            await pushLine(`<span class="ps-mut">[CHECK]</span> DOM & styles: ${domOk ? '<span class="ps-ok">OK</span>' : '<span class="ps-err">FAIL</span>'}`);
            progress.value = domOk ? 0.25 : 0.15;
            await delay(160);
            setTimeline('assets-scan', 'pending', 'scanning DOM for assets');
            await pushLine(`<span class="ps-mut">[SCAN]</span> Scanning for CSS/JS/Images...`);
            const assets = await ctxCheck({timeout: 8000, images: true});
            totalCount.value = assets.length;
            await pushLine(`<span class="ps-mut">[SCAN]</span> Found ${assets.length} assets`);
            setTimeline('assets-scan', assets.length ? 'ok' : 'fail', `${assets.length} items`);
            progress.value = 0.35;
            setTimeline('assets-check', 'pending', 'checking resources');
            let done = 0;
            for (const a of assets) {
                done++;
                processedCount.value = done;
                const statusLabel = a.ok ? '<span class="ps-ok">OK</span>' : '<span class="ps-err">ERR</span>';
                await pushLine(`<span class="ps-mut">[ASSET]</span> ${safeHtml(a.url)} → ${statusLabel} ${a.size ? '(' + formatBytes(a.size) + ')' : ''}`);
                const base = 0.35, span = 0.55;
                progress.value = Math.min(0.9, base + (done / assets.length) * span);
                await delay(35);
            }
            const anyFail = assets.some(x => !x.ok);
            setTimeline('assets-check', anyFail ? 'fail' : 'ok', anyFail ? 'some failed' : 'all ok');
            setTimeline('final', 'pending', 'wrapping up');
            await pushLine(`<span class="ps-mut">[BOOT]</span> Finalizing...`);
            progress.value = 0.94;
            await delay(380);

            const cfgCount = Object.keys(cls.value).length;
            await pushLine(`<span class="ps-mut">[CONFIG]</span> Initialize ${cfgCount} Config elements: ${domOk ? '<span class="ps-ok">OK</span>' : '<span class="ps-err">FAIL</span>'}`);
            await setupDOM(cls.value);
            await pushLine(`<span class="ps-mut">[CONFIG]</span> Check Config elements: ${domOk ? '<span class="ps-ok">OK</span>' : '<span class="ps-err">FAIL</span>'}`);
            await nextTick();
            setTimeline('dom-cls', domOk ? 'ok' : 'fail', domOk ? 'complete' : 'not-ready');
            await pushLine(`<span class="ps-mut">[CONFIG]</span> Prepare Config: ${domOk ? '<span class="ps-ok">OK</span>' : '<span class="ps-err">FAIL</span>'}`);

            await delay(380);
            progress.value = domOk ? 0.25 : 0.15;
            progress.value = 1;
            setTimeline('final', 'ok', 'complete');
            await pushLine(`<span class="ps-mut">[BOOT]</span> Boot complete`);
            await delay(2000);
            await emitComplete();
            await delay(400);
            spinningActive.value = false;
        } catch (err) {
            console.error('Boot error', err);
            setTimeline('final', 'fail', 'error');
            await pushLine(`<span class="ps-err">[ERR]</span> ${safeHtml(err.message || String(err))}`);
            spinningActive.value = false;
        } finally {
            if (typeof unsubXHR === 'function') unsubXHR();
        }
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0, v = bytes;
        while (v >= 1024 && i < units.length - 1) {
            v /= 1024;
            i++;
        }
        return `${Math.round(v * 10) / 10}${units[i]}`;
    }

    const displayedLines = computed(() => lines.value.slice(-Math.max(100, Math.min(maxLines, 300))));

    function toggleExpanded() {
        expanded.value = !expanded.value;
    }

    async function emitComplete() {
        emitEvent('viewport-state', true);
        await nextTick();
        emitEvent('app:boot-state', false);
    }

    async function setupDOM(cls) {
        return await clsManager(cls);
    }

    onMounted(async () => {
        terminalRef.value = document.getElementById(terminalId.value)
        if (props.autoStart && terminalRef.value) await runBoot();
    });
    onUnmounted(() => {
        if (typeof unsubXHR === 'function') unsubXHR();
    });

    return {
        terminalId,
        processedCount,
        spinningActive,
        expanded,
        timeline,
        pct,
        topMessage,
        totalCountDisplay,
        timelinePreview,
        dotClass,
        nodeClass,
        displayedLines,
        open,
        close,
        toggleExpanded,
        emitEvent
    };
}

export const bootProps = {
    state: { type: Boolean, required: true, default: false },
    autoStart: { type: Boolean, required: false, default: true }
};