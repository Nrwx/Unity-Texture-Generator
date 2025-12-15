import {computed, nextTick, ref, watch} from "vue";
import {eventRegister} from "@/dataLayer/event";
import {uuid} from "@/utils/uuid";
import {matrixDefault} from "@/utils/matrix";

export function channelMixerModel(props, emit) {
    const wrapper = ref(null);
    const wrapperId = ref(uuid());
    const canvas = ref(null);
    const canvasId = ref(uuid());
    const addBtn = ref(null);
    const addBtnId = ref(uuid());
    const saveBtn = ref(null);
    const saveBtnId = ref(uuid());
    const resetBtn = ref(null);
    const resetBtnId = ref(uuid());
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

    // channel select options
    const refOptions = computed(() =>
        props.channel.map((c) => ({
            id: c.id,
            width: c.width,
            height: c.height,
            order: 0,
            url: c.url,
            value: c.id,
            label: c.name || `Channel ${c.id}`,
            texture_mode: 'diffuse',
            matrix: matrixDefault(props.data.webgl)
        }))
    );

    const update = (mode, layerId, ref = null) => {
        if (mode === 'base') {
            const item = refOptions.value.find(x => x.id === layerId);
            if (item) {
               emitEvent('channel:mixer-base', {...item, _update: true});
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
            layer.texture_mode = 'diffuse'
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
            matrix: matrixDefault(props.data.webgl),
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

    const reset = async (payload = false) => {
        emitEvent('channel:mixer-reset', payload);
    }

    async function _prepare () {
        add();
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

            if (addBtn.value) {
                register('add', addBtn.value, 'pointerdown', add);
            }
            if (saveBtn.value) {
                register('add', saveBtn.value, 'pointerdown', save)
            }
            if (resetBtn.value) {
                register('add', resetBtn.value, 'pointerdown', reset)
            }
            emitEvent("channel:mixer-update",{
                wrapper: wrapperId.value || wrapper.value,
                id: canvasId.value,
                canvas: canvas.value,
                webgl: true,
                viewport: {
                    width: props.viewport.width,
                    height: props.viewport.height,
                    rows: 1,
                    columns: 1
                },
                event: {
                    pointerDown : {
                        target: wrapperId.value || wrapper.value,
                        type: 'pointerdown'
                    },
                    pointerMove : {
                        target: window,
                        type: 'pointermove',
                        passive: true
                    },
                    pointerUp : {
                        target: window,
                        type: 'pointerup',
                        passive: true
                    },
                    wheel: {
                        target: wrapperId.value || wrapper.value,
                        type: 'wheel',
                        options: {passive: false}
                    }
                },
                emit: {
                    event: 'channel:mixer-update',
                    handler: emitEvent
                }
            })
            await nextTick();
            await _prepare();
            await nextTick();
            emitEvent('channel:mixer-active', true);
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
            emitEvent('channel:mixer-active', false);
            await reset(true);
            register('removeAll');
            console.log('Cleaned Channel-Canvas')
        }
    });


    return {
        config,

        wrapper,
        wrapperId,
        canvasId,
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
