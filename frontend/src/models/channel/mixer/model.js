import {computed, nextTick, ref, watch} from "vue";
import {eventRegister} from "@/dataLayer/event";
import {uuid} from "@/utils/uuid";

export function channelMixerModel(props, emit) {
    const wrapper = ref(null);
    const wrapperId = ref(uuid());
    const canvas = ref(null);
    const canvasId = ref(uuid());
    const targetId = ref(uuid());
    const addBtn = ref(null);
    const addBtnId = ref(uuid());
    const saveBtn = ref(null);
    const saveBtnId = ref(uuid());
    const resetBtn = ref(null);
    const resetBtnId = ref(uuid());

    const ctx = ref(null);
    const images = new Map();

    const _state = {
        panning: false,
        mouse: {x: 0, y: 0},
        transform: [0,0],
        zoom: [1]
    }


    const emitEvent = (event, payload) => emit("component-event", event, payload);
    const { register } = eventRegister('listener:channel-canvas', emitEvent);

    const currentChannel = computed(() => props.channel.find(c => c.id === props.data?.target) || null);

    const config = computed(() => {
        const t = currentChannel.value?.time ? new Date(currentChannel.value.time).toLocaleString() : "—";
        const n = currentChannel.value?.name || "—";
        return {
            maxWidth: 960,
            title: "Kanalmixer",
            subtitle: `Synchronisiert: ${t}, Kanal: ${n}`,
            emit: "channel:mixer-state",
            textVariant: "id"
        };
    });

    function loadImage(url) {
        if (!url) return Promise.resolve(null);
        if (images.has(url)) return Promise.resolve(images.get(url));

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                images.set(url, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    function resize() {
        if (!canvas.value || !wrapper.value || !ctx.value) return;
        const rect = wrapper.value.getBoundingClientRect();

        canvas.value.width  = rect.width;
        canvas.value.height = rect.height;

        canvas.value.style.width  = `${rect.width}px`;
        canvas.value.style.height = `${rect.height}px`;

        ctx.value.setTransform(1, 0, 0, 1, 0, 0);
    }

    function background() {
        if (!ctx.value) return;

        const { background } = props.data;
        const { width, height } = canvas.value ?? props.viewport;

        ctx.value.clearRect(0, 0, width, height);

        if (background === "black") {
            ctx.value.fillStyle = "#000";
            ctx.value.fillRect(0, 0, width, height);
        }

        if (background === "white") {
            ctx.value.fillStyle = "#fff";
            ctx.value.fillRect(0, 0, width, height);
        }

        if (background === "grid") {
            const size = 16;
            for (let y = 0; y < height; y += size) {
                for (let x = 0; x < width; x += size) {
                    ctx.value.fillStyle =
                        (x / size + y / size) % 2 ? "#ccc" : "#eee";
                    ctx.value.fillRect(x, y, size, size);
                }
            }
        }
    }

    function getContainRect(img, canvasW, canvasH) {
        const imgRatio = img.width / img.height;
        const canvasRatio = canvasW / canvasH;

        let w, h;

        if (imgRatio > canvasRatio) {
            w = canvasW;
            h = canvasW / imgRatio;
        } else {
            h = canvasH;
            w = canvasH * imgRatio;
        }

        return {
            x: (canvasW - w) / 2,
            y: (canvasH - h) / 2,
            w,
            h
        };
    }

    async function render() {
        if (!ctx.value) return;

        resize();
        background();

        const cw = canvas.value.width  / (window.devicePixelRatio || 1);
        const ch = canvas.value.height / (window.devicePixelRatio || 1);

        ctx.value.save();

        ctx.value.translate(
            _state.transform[0] + cw / 2,
            _state.transform[1] + ch / 2
        );
        ctx.value.scale(_state.zoom[0], _state.zoom[0]);
        ctx.value.translate(-cw / 2, -ch / 2);

        /* -------- BASE CHANNEL -------- */
        if (currentChannel.value?.url) {
            const baseImg = await loadImage(currentChannel.value.url);
            if (baseImg) {
                const r = getContainRect(baseImg, cw, ch);

                ctx.value.globalAlpha = 1;
                ctx.value.globalCompositeOperation = "source-over";
                ctx.value.drawImage(baseImg, r.x, r.y, r.w, r.h);
            }
        }

        /* -------- LAYERS -------- */
        for (const layer of props.data.layers) {
            if (!layer.url || layer.hidden) continue;

            const img = await loadImage(layer.url);
            if (!img) continue;

            const r = getContainRect(img, cw, ch);

            ctx.value.globalAlpha = layer.opacity ?? 1;
            ctx.value.globalCompositeOperation = layer.blend_mode || "normal";
            ctx.value.drawImage(img, r.x, r.y, r.w, r.h);
        }

        ctx.value.restore();

        ctx.value.globalAlpha = 1;
        ctx.value.globalCompositeOperation = "source-over";
    }

    function down(e) {
        _state.panning = true;
        _state.mouse.x = e.clientX;
        _state.mouse.y = e.clientY;
        register('add', window, 'pointermove', move)
        register('add', window, 'pointerup', up)
    }

    function move(e) {
        if (!_state.panning) return;

        const dx = e.clientX - _state.mouse.x;
        const dy = e.clientY - _state.mouse.y;

        _state.transform[0] += dx;
        _state.transform[1] += dy;

        _state.mouse.x = e.clientX;
        _state.mouse.y = e.clientY;

        render();
    }

    function up() {
        _state.panning = false;
        register('remove', window, 'pointermove', move)
        register('remove', window, 'pointerup', up)
    }

    function setZoom(value) {
        _state.zoom[0] = Math.min(4, Math.max(0.25, value));
    }

    function wheel(e) {
        e.preventDefault();

        const zoomSpeed = 0.0015;
        const delta = -e.deltaY * zoomSpeed;

        const oldZoom = _state.zoom[0];
        const newZoom = oldZoom + delta;

        if (newZoom === oldZoom) return;

        setZoom(newZoom);
        render();
    }



    // channel select options
    const refOptions = computed(() =>
        props.channel.map((c) => ({
            id: c.id,
            width: c.width,
            height: c.height,
            order: 0,
            url: c.url,
            value: c.id,
            label: c.name || `Channel ${c.id}`
        }))
    );

    const update = (mode, layerId, ref = null) => {
        if (mode === 'base') {
            const item = refOptions.value.find(x => x.id === layerId);
            if (item) {
                emitEvent('channel:mixer-base', {...item});
            }
        } else if (mode === 'overlay') {
            const layer = props.data.layers.find(l => l.id === layerId);
            if (!layer) return;

            layer.ref = ref;
            layer._update = true;

            const ch = refOptions.value.find(c => c.id === ref);
            if (!ch) {
                layer.url = null;
                layer.width = 0;
                layer.height = 0;
                layer.hidden = 1;
                layer.texture_mode = 'transparent';
                return;
            }

            layer.url = ch.url;
            layer.width = ch.width;
            layer.hidden = 0;
            layer.height = ch.height;
        } else {
            console.log('Ungültiger updte modus')
        }
    }

    const add = () => {
        if (props.data.layers.length >= props.data.slots) return;

        const newLayer = {
            id: uuid(),
            ref: null,
            blend_mode: 'multiply',
            opacity: 0.5,
            url: null,
            width: props.viewport.width,
            height: props.viewport.height
        };

        emitEvent("channel:mixer-add", newLayer);
    };

    const save = () => {
        if (!canvas.value) return;
        emitEvent("channel:mixer-save", { id: canvasId.value });
    }

    const reset = () => {
        setZoom(1);
        _state.transform[0] = 0;
        _state.transform[1] = 0;
    }

    async function _prepare () {
        add();
        render()
    }

    async function _init() {
        try {
            wrapper.value = document.getElementById(wrapperId.value);
            canvas.value = document.getElementById(canvasId.value);
            addBtn.value = document.getElementById(addBtnId.value);
            saveBtn.value = document.getElementById(saveBtnId.value);
            resetBtn.value = document.getElementById(resetBtnId.value);
            await nextTick();
            if (!canvas.value || !wrapper.value) return;

            ctx.value = canvas.value.getContext("2d");
            resize();
            await render();

            if (addBtn.value) {
                register('add', addBtn.value, 'pointerdown', add);
            }
            if (saveBtn.value) {
                register('add', saveBtn.value, 'pointerdown', save)
            }
            if (resetBtn.value) {
                register('add', resetBtn.value, 'pointerdown', reset)
            }

            if (canvas.value) {
                register('add', canvas.value, 'pointerdown', down)
                register('add', canvas.value, 'wheel', wheel, { passive: false })
            }

            await nextTick();
            await _prepare();
            return console.log('Mixer-Component successfully initialized');
        } catch (error) {
            console.error('[init] Initialization failed:', error);
            throw new Error('Mixer-Component initialization failed');
        }
    }

    watch(() => props.state, async (v) => {
        await nextTick();
        if (v) {
            await _init();
        } else {
            emitEvent('channel:mixer-state', false);
            reset();
            register('removeAll');
            console.log('Cleaned Channel-Canvas')
        }
    });

    watch(
        () => [
            props.data.target,
            props.data.layers,
            props.data.background,
        ],
        async () => {
            await nextTick();
            render();
        },
        { deep: true }
    );


    return {
        config,
        _state,

        wrapper,
        wrapperId,
        canvas,
        canvasId,
        targetId,
        addBtn,
        addBtnId,
        saveBtn,
        saveBtnId,
        resetBtn,
        resetBtnId,

        refOptions,
        currentChannel,
        update,
        emitEvent
    };
}

export const channelMixerProps = {
    viewport: {
        type: Object,
        required: true,
    },
    data: {
        type: Object,
        required: true,
    },
    shader: {
        type: Array,
        required: true,
        default: () => []
    },
    channel: {
        type: Array,
        required: true,
        default: () => []
    },
    blendMode: {
        type: Array,
        required: true,
        default: () => []
    },
    state: {
        type: Boolean,
        required: true
    },
    loading: {
        type: Boolean,
        required: true
    },
    theme: {
        type: String,
        required: true
    }
};
