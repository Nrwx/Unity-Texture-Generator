import {nextTick, ref, watch} from "vue";
import {canvasRegister, eventRegister} from "@/dataLayer/event";
import {matrixDefault} from "@/utils/matrix";

export function canvasModel(props, emit) {
    const wrapper = ref(null);
    const canvas = ref(null);
    const canvasId = ref(null);
    const flags = ref({
        pointerDown: false,
        keyDown: false,
        observer: false,
        matrix: matrixDefault()
    })

    const emitEvent = (event, payload) => {
        emit("update:component-event", event, payload);
    };

    const { register } = eventRegister(`listener:canvas-${props.id}`, emitEvent);
    const { environment } = canvasRegister(`canvas:environment-${props.id}`, emitEvent);

    const onPointerDown = async (e) => {
        if (!canvas.value) return;

        flags.value.pointerDown = true;

        flags.value.matrix.x = e.clientX - props.config.matrix.x;
        flags.value.matrix.y = e.clientY - props.config.matrix.y;

        environment('select', {}, { x: e.clientX, y: e.clientY });

        if (props.config?.event?.pointerDown?.handler) {
            if (typeof props.config.event.pointerDown.handler === "function") {
                await nextTick();
                await props.config.event.pointerDown.handler(e);
            }
        }

        register('add', window, 'pointermove', onPointerMove);
        register('add', window, 'pointerup', onPointerUp);

        if (props.config?.event?.pointerDown?.emit) props.config.update = true;
    };



    const onPointerMove = async (e) => {
        if (!flags.value.pointerDown ) return;
        props.config.matrix.x = e.clientX - flags.value?.matrix?.x;
        props.config.matrix.y = e.clientY - flags.value?.matrix?.y;
        if (props.config?.event?.pointerMove?.handler) {
            if (typeof props.config?.event?.pointerMove?.handler !== "function") return;
            await nextTick();
            await props.config.event.pointerMove.handler(e);
        }
        if (props.config?.event?.pointerMove?.emit) props.config.update = true;
    };

    const onPointerUp = async (e) => {
        flags.value.pointerDown = false;
        if (props.config?.event?.pointerUp?.handler) {
            if (typeof props.config?.event?.pointerUp?.handler !== "function") return;
            await nextTick();
            await props.config.event.pointerUp.handler(e);
        }
        register('remove', window, 'pointermove', onPointerMove);
        register('remove', window, 'pointerup', onPointerUp);
        if (props.config?.event?.pointerUp?.emit) props.config.update = true;
    };

    const onKeyDown = async (e) => {
        if (!canvas.value) return;
        flags.value.keyDown = true;
        if (e.key === "Escape") environment("fullscreen", {}, {fullscreen: null});
        if (props.config?.event?.keyDown?.handler) {
            if (typeof props.config?.event?.keyDown?.handler !== "function") return;
            await nextTick();
            await props.config.event.keyDown.handler(e);
        }
        register('add', window, 'keyup', onKeyUp);
        if (props.config?.event?.keyDown?.emit) props.config.update = true;
    };

    const onKeyUp = async (e) => {
        flags.value.keyDown = false;
        if (props.config?.event?.keyUp?.handler) {
            if (typeof props.config?.event?.keyUp?.handler !== "function") return;
            await nextTick();
            await props.config.event.keyUp.handler(e);
        }
        register('remove', window, 'keyup', onKeyUp);
        if (props.config?.event?.keyUp?.emit) props.config.update = true;
    };

    const onResize = async () => {
        if (!canvas.value) return;
        if(props.config?.event?.resize?.observer === true) {
            const resizeObserver = new ResizeObserver(() => _update(props.config));
            if(props.config?.event?.resize?.observer && props.config?.event?.resize?.target) {
                if (typeof props.config?.event?.resize?.target === "string") {
                    const target = document.getElementById(props.config?.event?.resize?.target);
                    resizeObserver.observe(target);
                } else resizeObserver.observe(props.config.event.resize.target);
            } else {
                if (wrapper.value) resizeObserver.observe(wrapper.value);
                else resizeObserver.observe(canvas.value);
            }
        }
        if (props.config?.event?.resize?.handler) {
            if (typeof props.config?.event?.resize?.handler !== "function") return;
            await nextTick();
            await props.config.event.resize.handler();
        }
        if (props.config?.event?.resize?.emit) props.config.update = true;
    };

    const onWheel = async (e) => {
        if (!canvas.value) return;
        e.preventDefault();

        const delta = -e.deltaY / 500;
        const oldZoom = props.config.matrix.a;
        const newZoom = Math.min(4, Math.max(0.25, oldZoom + delta));

        flags.value.matrix.a = newZoom;
        flags.value.matrix.d = newZoom;
        props.config.matrix.a = newZoom;
        props.config.matrix.d = newZoom;

        if (props.config?.event?.wheel?.handler) {
            if (typeof props.config?.event?.wheel?.handler === "function") {
                await nextTick();
                await props.config.event.wheel.handler(e);
            }
        }

        if (props.config?.event?.wheel?.emit) props.config.update = true;
    };



    const _registerEvents = async () => {
        if (!canvas.value) return;
        const events = {
            pointerDown: onPointerDown,
            pointerUp: onPointerUp,
            pointerMove: onPointerMove,
            keyDown: onKeyDown,
            keyUp: onKeyUp,
            wheel: onWheel,
            resize: onResize
        }
        register('removeAll');
        if(props.config?.event) {
            for (const key in props.config?.event) {
                console.log(key)
                if (typeof props.config?.event[key] === 'object') {
                    let target = null;
                    const item = props.config?.event[key];
                    if (typeof item.target === 'string') target = document.getElementById(item.target);
                    else target = item.target;
                    if (item?.passive) continue;
                    if (item?.observer) {
                        flags.value.observer = true;
                        continue
                    }
                    await nextTick();
                    if (target && item?.handler && item?.overwrite && item?.options && item?.type) register('add', target, item.type, item.handler, item.options);
                    else if (item?.handler && item?.overwrite && item?.options && item?.type) register('add', canvas.value, item.type, item.handler, item.options);
                    else if (item?.handler && item?.overwrite && item?.type) register('add', canvas.value, item.type, item.handler);
                    else if (target && item?.type) register('add', target, item.type, events[key]);
                    else if (item?.type) register('add', canvas.value, item.type, events[key]);
                    else console.warn('Canvas event config fehlerhaft!')
                }
            }
        }
        if (flags.value.observer) {
            await onResize();
        }
    };

    watch(() => props.config, async (v) => {
        if (v && props.state) {
            if (!v.active) return;
            await _update(v)
        }
    }, { deep: true });

    watch(() => props.state, async (v) => {
        if (v) {
            await _init();
        } else {
            await _init(true);
        }
    });

    const _update = async (v) => {
        if(!props.state) return;
        await environment("update", v, {canvas: canvas.value, id: canvasId.value || props.id});
    }

    const _init = async (unregister=false) => {
        if (!props.id || !props.config?.canvas) return;
        if (canvasId.value && props.id !== canvasId.value) {
            try {
                await emitEvent('event:listener', {id: `listener:canvas-${canvasId.value}`, removeAll: true});
                await environment('remove');
            } catch (e) {
                console.log('Keine aktive canvas Instanz gefunden');
            }
        }
        if (unregister) {
            await register('removeAll');
            await nextTick();
            await environment("remove");
            return console.log('Cleaned Canvas')
        } else {
            if (typeof props.config.canvas === 'string') canvas.value = document.getElementById(props.id);
            else canvas.value = props.config.canvas;
            if(canvas.value) {
                canvasId.value = props.config?.id || props.id;
                if(props.config?.wrapper) {
                    if(typeof props.config.wrapper === 'string') wrapper.value = document.getElementById(props.config.wrapper);
                    else wrapper.value = props.config.wrapper;
                }
                if (props.config?.canvas === canvas.value) {
                    if (wrapper.value) {
                        await environment('register', {
                            ...props.config,
                            wrapper: wrapper.value
                        });
                    } else {
                        await environment('register', props.config);
                    }
                } else {
                    if (wrapper.value) {
                        await environment('register',{
                            ...props.config,
                            id: props.id,
                            canvas: canvas.value,
                            wrapper: wrapper.value
                        });
                    } else {
                        await environment('register',{
                            ...props.config,
                            id: props.id,
                            canvas: canvas.value
                        });
                    }
                }
                canvasId.value = props.id || props.config?.id;
                await _registerEvents();
            } else {
                console.log('Canvas nicht gefunden');
                canvas.value = null;
            }
        }
    }

    return {
        canvas,
        emitEvent
    };
}

export const canvasProps = {
    state: { type: Boolean, required: true },
    id: { type: String, required: true },
    config: { type: Object, required: true },
    viewport: { type: Object, required: true }
};
