import {pathLayer} from "@/models/pen/config/model";
import {computed, reactive} from "vue";

export function pathModel(emit) {

    const config = reactive({
        method: 16,
        name: pathLayer.value.name,
        stroke: pathLayer.value.stroke,
        strokeWidth: pathLayer.value.strokeWidth,
        strokeDashType: pathLayer.value.strokeDashType,
        strokeDash: pathLayer.value.strokeDash,
        strokeDashArray:  pathLayer.value.strokeDashArray,
        fill: pathLayer.value.fill,
        gradient: pathLayer.value.gradient,
        fillOpacity: pathLayer.value.fillOpacity,
        closed: pathLayer.value.closed
    })

    const operation = computed(() =>({
        16: {
            name: {
                type: 'text',
                label: 'Name',
                event: 'apply-path-name',
                active: true
            },
            stroke: {
                type: 'color-palette',
                label: 'Pfadfarbe',
                event: 'apply-path-stroke',
                active: true
            },
            fill: {
                type: 'color-palette',
                label: 'Füllfarbe',
                event: 'apply-path-fill',
                active: true
            },
            gradient: {
                type: 'gradient-editor',
                label: 'Farbverlauf',
                event: 'apply-path-gradient',
                active: true
            },
            strokeWidth: {
                type: 'slider',
                label: 'Strichstärke',
                min: 0.5,
                max: 20,
                step: 0.5,
                event: 'apply-path-stroke-width',
                active: true
            },
            strokeDashType: {
                type: 'select',
                label: 'Strichmuster',
                options: [
                    { title: 'Durchgezogen', value: 'solid' },
                    { title: 'Gestrichelt', value: 'dashed' },
                    { title: 'Gepunktet', value: 'dotted' }
                ],
                event: 'apply-path-border-type',
                active: true
            },
            strokeDash: {
                type: 'slider',
                label: 'Strichabstand',
                min: 0,
                max: 30,
                step: 1,
                event: 'apply-path-dash',
                active: true
            },
            strokeDashArray: {
                type: 'text-array-number',
                label: 'Strichabstände (z.B. 5, 5)',
                event: 'apply-path-dash-array',
                active: true
            },
            fillOpacity: {
                type: 'slider',
                label: 'Deckkraft',
                min: 0,
                max: 1,
                step: 0.05,
                event: 'apply-path-opacity',
                active: true
            },
            closed: {
                type: 'switch',
                label: config.closed ? 'Pfad entsperren' : 'Pfad sperren',
                event: 'apply-path-closed',
                active: true
            }
        }
    }))


    const emitEvent = (event, payload) => {
        emit("component-event", event, payload);
    };

    const save = () => {
        const data =  pathLayer.value;
        emitEvent('add-path-layer', data)
        emitEvent('pen:path-state', false)
        cancel()
    };

    const cancel = () => {
        emitEvent('path:reset', false)
    };

    return {
        save,
        cancel,
        config,
        operation,
        emitEvent,
    };
}

export const pathProps = {
};