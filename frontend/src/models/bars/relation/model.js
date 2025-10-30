import {computed} from "vue";

export function relationModel(props, emit) {
    const emitEvent = (event, payload) => emit("component-event", event, payload);
    // Compose nodes from meta
    const nodes = computed(() => {
        const m = props.meta || {};
        const total = m.total_tasks || 0;
        const running = m.running_tasks_count || 0;
        const pending = m.pending_tasks || 0;
        const completed = m.completed_tasks || 0;
        const failed = m.failed_tasks || 0;
        const custom = m.custom_tasks || 0;
        return [
            { id: 'total', title: 'Total', value: total, x: 120, y: 140, r: 34, type: 'total' },
            { id: 'running', title: 'Running', value: running, x: 320, y: 60, r: Math.max(18, 10 + running*1.5), type: 'running' },
            { id: 'pending', title: 'Pending', value: pending, x: 320, y: 220, r: Math.max(18, 10 + pending*1.5), type: 'pending' },
            { id: 'completed', title: 'Completed', value: completed, x: 560, y: 80, r: Math.max(18, 10 + completed*1.2), type: 'complete' },
            { id: 'failed', title: 'Failed', value: failed, x: 560, y: 220, r: Math.max(18, 10 + failed*1.2), type: 'failed' },
            { id: 'custom', title: 'Custom', value: custom, x: 720, y: 140, r: Math.max(16, 8 + custom*1.2), type: 'custom' }
        ];
    });

// Links: draw quadratic curves between nodes
    const links = computed(() => {
        const map = {};
        nodes.value.forEach(n => map[n.id] = n);
        const pairs = [
            ['total','running'],
            ['total','pending'],
            ['running','completed'],
            ['pending','failed'],
            ['completed','custom'],
            ['failed','custom']
        ];
        return pairs.map(([a,b]) => {
            const A = map[a], B = map[b];
            if(!A || !B) return { path: '' };
            const cx = (A.x + B.x)/2;
            const cy = A.y < B.y ? A.y - 40 : A.y + 40;
            const path = `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`;
            return { path, source: a, target: b };
        });
    });
    return {
        nodes,
        links,
        emitEvent
    };
}

export const relationProps = {
    theme: {
        type: String,
        required: true,
    },
    meta: {
        type: Object,
        required: true
    },
    width: {
        type:[Number,String],
        default: 800
    },
    height: {
        type: [Number,String],
        default: 280
    }
};