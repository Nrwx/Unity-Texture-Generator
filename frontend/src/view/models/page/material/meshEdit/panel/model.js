import { computed } from "vue";

export const meshEditPanelProps = {
    config: {
        type: Object,
        required: true,
    },
};

export function meshEditPanelModel(props, emit) {
    const edit = computed(() => props.config || {});
    const emitEvent = (event, payload) => emit("update:component-event", event, payload);

    const setMode = mode => {
        props.config.enabled = true;
        props.config.mode = mode || "vertex";
        emitEvent("mesh-edit:mode", props.config.mode);
    };

    const setTool = tool => {
        props.config.tool = tool || "move";
        emitEvent("mesh-edit:tool", props.config.tool);
    };

    const setField = (field, value) => {
        props.config[field] = value;
        emitEvent("mesh-edit:field", { field, value });
    };

    const emitAction = action => {
        props.config.operation = action || "";
        props.config.operationTick = (props.config.operationTick || 0) + 1;
        emitEvent("mesh-edit:action", action);
    };

    return {
        edit,
        setMode,
        setTool,
        setField,
        emitAction,
    };
}
