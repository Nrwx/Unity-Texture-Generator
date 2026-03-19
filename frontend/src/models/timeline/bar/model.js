import {uuid} from "@/utils/uuid";
import {computed, ref} from "vue";

export function timelineBarModel(props, emit) {

    const groups = ref( [
        {
            class: "controls-group playback-controls",
            active: true,
            type: "button",
            id: uuid('timeline-bar-group'),
            children: [
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Skip to start",
                    icon: {
                        url: "mdi-skip-previous",
                        size: 18,
                    },
                    class: "control-btn",
                    callback: () => {
                        emitParent('update:timeline-bar-start')
                    }
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Previous frame",
                    icon: {
                        url: "mdi-chevron-left",
                        size: 18,
                    },
                    class: "control-btn",
                    callback: () => {
                        emitParent('update:timeline-bar-back')
                    }
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: computed(() => {
                        return props.play ? 'Pause' : 'Play';
                    }),
                    icon: {
                        url: computed(() => {
                            return props.play ? 'mdi-pause' : 'mdi-play';
                        }),
                        size: 20,
                    },
                    class: computed(() => {
                        return props.play ? 'control-btn play-btn playing' : 'control-btn play-btn';
                    }),
                    callback: () => {
                        emitParent('update:timeline-bar-toggle-play')
                    }
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Next frame",
                    icon: {
                        url: "mdi-chevron-right",
                        size: 18,
                    },
                    class: "control-btn",
                    callback: () => {
                        emitParent('update:timeline-bar-forward')
                    }
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Skip to end",
                    icon: {
                        url: "mdi-skip-next",
                        size: 18,
                    },
                    class: "control-btn",
                    callback: () => {
                        emitParent('update:timeline-bar-end')
                    }
                }
            ]
        },
        {
            class: "controls-group record-controls",
            active: true,
            type: "button",
            id: uuid('timeline-bar-group'),
            children: [
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Auto keyframe recording",
                    icon: {
                        url: "mdi-circle",
                        size: 16,
                    },
                    class: computed(() => { return props.record ? 'control-btn record-btn recording' : 'control-btn record-btn'; }),
                    callback: () => {
                        emitParent('update:timeline-bar-record')
                    },
                }
            ]
        },
        {
            class: "controls-group time-info",
            active: true,
            type: "input",
            id: uuid('timeline-bar-group'),
            children: [
                {
                    id: uuid('timeline-bar'),
                    title: 'Frame:',
                    type: 'number',
                    tooltip: "Current frame",
                    class: 'time-input',
                    min: 0,
                    value: computed(() => {
                        return Math.round(props?.time);
                    }),
                    callback: (val) => {
                        emitParent('update:timeline-bar-input', val)
                    },
                    max: props.endTime
                },
                {
                    id: uuid('timeline-bar'),
                    type: 'text',
                    input: false,
                    tooltip: "Current timeline zoom",
                    class: "zoom-level",
                    icon: {
                        url: 'mdi-magnify',
                        size: 14
                    },
                    value: computed(() => {
                        return Math.round((props?.zoom || 1) * 100);
                    })
                }
            ]
        },
        {
            class: "controls-group keyframe-controls",
            active: true,
            type: "button",
            id: uuid('timeline-bar-group'),
            children: [
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Toggle Layer Tracks",
                    icon: {
                        url: "mdi-format-list-bulleted",
                        size: 16,
                    },
                    callback: () => {
                        emitEvent('timeline:sidebar', !props.sidebar)
                    },
                    class: "control-btn",
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Add keyframe",
                    icon: {
                        url: "mdi-rhombus-outline",
                        size: 18,
                    },
                    class: "control-btn add-key",
                    callback: () => {
                        emitEvent('timeline:set-keyframe')
                    },
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: computed(() => {
                        return props.selectedKeys.length > 0 ? `Delete ${props.selectedKeys.length} keyframe(s)` : 'Delete keyframe';
                    }),
                    icon: {
                        url: "mdi-delete-outline",
                        size: 18,
                    },
                    class: "control-btn delete-key",
                    callback: async () => {
                        emitEvent('timeline:delete-keyframe', {
                            keyframeIds: props.selectedKeys, time: Math.round(props.time)
                        })
                        emitEvent('timeline:select-keyframes', [])
                    }
                },
            ]
        },
        {
            class: "controls-group ease-controls",
            active: computed(() => {
                return props.selectedKeys.length > 0;
            }),
            type: "button",
            id: uuid('timeline-bar-group'),
            children: [
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Interpolation ease",
                    type: "select",
                    icon: {
                        url: "mdi-chart-bell-curve",
                        size: 16,
                    },
                    class: "ease-select",
                    value: computed(() => {
                        if (props.selectedKeys.length === 0) return 'linear';
                        const firstSelected = props.keys.find(k => k.id === props.selectedKeys[0]);
                        return firstSelected?.ease || 'linear';
                    }),
                    items: props.easeModes,
                    event: 'timeline:update-keyframe-ease',
                    callback: async (ease) => {
                        emitEvent("timeline:update-keyframe-ease", {
                            keyframeIds: props.selectedKeys,
                            ease
                        });
                    }
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: 'Toggle bezier curve editor',
                    icon: {
                        url: "mdi-vector-bezier",
                        size: 16,
                    },
                    class:  computed(() => {return props.bezier ? `control-btn bezier-btn active` : 'control-btn bezier-btn'}),
                    disabled: computed(() => {
                        return props.selectedKeys.length < 2;
                    }),
                    callback: async () => {
                        emitEvent('timeline:bezier', !props.bezier)
                    }
                },
            ]
        },
        {
            class: "controls-group view-options",
            active: true,
            type: "button",
            id: uuid('timeline-bar-group'),
            children: [
                {
                    id: uuid('timeline-bar'),
                    tooltip: "Selection mode",
                    icon: {
                        url: "mdi-selection",
                        size: 16,
                    },
                    class: computed(() => {return props.select ? `control-btn select-btn active` : 'control-btn select-btn'}),
                    callback: async () => {
                        emitEvent('select-state', !props.select);
                        emitEvent('select-state:items', !props.select);
                        emitEvent('timeline:select-keyframes', []);
                    }
                },
                {
                    id: uuid('timeline-bar'),
                    tooltip: 'Settings',
                    icon: {
                        url: "mdi-cog-outline",
                        size: 16,
                    },
                    class: "control-btn",
                    callback: async () => {
                        emitEvent('timeline-bar:settings', !props.settings)
                    }
                },
            ]
        },
    ]);

    const emitParent = (event, payload) => {
        emit(event, payload);
    };

    const emitEvent = (event, payload = undefined) => {
        if (typeof payload === "undefined") {
            emit("update:component-event", event);
        } else {
            emit("update:component-event", event, payload);
        }
    };

    return {
        groups,
        emitParent,
        emitEvent
    };
}

export const timelineBarProps = {
    keys: {
        type: Array,
        required: true
    },
    selectedKeys: {
        type: Array,
        required: true
    },
    sidebar: {
        type: Boolean,
        required: true
    },
    record: {
        type: Boolean,
        required: true
    },
    play: {
        type: Boolean,
        required: true
    },
    time: {
        type: Number,
        required: true
    },
    endTime: {
        type: Number,
        required: true
    },
    zoom: {
        type: Number,
        required: true
    },
    easeModes: {
        type: Array,
        required: true
    },
    bezier: {
        type: Boolean,
        required: true
    },
    select: {
        type: Boolean,
        required: true
    },
};