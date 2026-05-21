import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { eventRegister } from "@/dataLayer/event";

export function guideModel(props, emit) {
    const guide = ref(null);

    /**
     * Vue trackt window.getComputedStyle(canvas).transform nicht reaktiv.
     * Deshalb erzwingen wir über guideSyncTick ein Re-Render,
     * sobald sich die weitergereichte Container-Matrix ändert.
     */
    const guideSyncTick = ref(0);
    let guideSyncFrame = null;

    const emitEvent = (event, payload) => {
        emit("update:guides-event", event, payload);
    };

    const { register } = eventRegister("listener:guide-panel", emitEvent);

    const clamp = (value, min, max) => {
        return Math.max(min, Math.min(max, value));
    };

    const getUnitSuffix = () => {
        const unit = props.settings.unit || "px";

        if (unit === "px") return "";

        return unit;
    };

    const getUnitFactor = () => {
        const unit = props.settings.unit || "px";
        const dpi = props.settings.dpi || 96;

        switch (unit) {
            case "in":
                return dpi;
            case "mm":
                return dpi / 25.4;
            case "cm":
                return dpi / 2.54;
            case "px":
            default:
                return 1;
        }
    };

    const formatRulerLabel = (valuePx) => {
        const unit = props.settings.unit || "px";
        const factor = getUnitFactor();
        const value = valuePx / factor;

        if (unit === "px") {
            return `${Math.round(value)}`;
        }

        if (Math.abs(value) >= 10) {
            return `${Number(value.toFixed(1))}${getUnitSuffix()}`;
        }

        return `${Number(value.toFixed(2))}${getUnitSuffix()}`;
    };

    /**
     * Gibt schöne Werte zurück:
     * 1, 2, 5, 10, 20, 50, 100, 200, 500 ...
     */
    const getNiceStep = (rawStep) => {
        if (!Number.isFinite(rawStep) || rawStep <= 0) {
            return 50;
        }

        const exponent = Math.floor(Math.log10(rawStep));
        const base = Math.pow(10, exponent);
        const fraction = rawStep / base;

        let niceFraction;

        if (fraction <= 1) {
            niceFraction = 1;
        } else if (fraction <= 2) {
            niceFraction = 2;
        } else if (fraction <= 5) {
            niceFraction = 5;
        } else {
            niceFraction = 10;
        }

        return niceFraction * base;
    };

    const getRulerStep = (scale) => {
        const safeScale = Math.max(0.0001, scale || 1);

        /**
         * Mindestabstand zwischen beschrifteten Labels in Screen-Pixeln.
         * Größer = weniger Labels.
         * Kleiner = mehr Labels.
         */
        const minLabelDistancePx = 72;

        const rawMajorStepPx = minLabelDistancePx / safeScale;
        const majorStepPx = getNiceStep(rawMajorStepPx);

        /**
         * Kleine Zwischenstriche zwischen den großen Label-Marks.
         */
        const minorStepPx = majorStepPx / 5;

        return {
            major: majorStepPx,
            minor: minorStepPx
        };
    };

    const createRulerMarks = (size, scale) => {
        const marks = [];
        const { major, minor } = getRulerStep(scale);

        for (let value = 0; value <= size + minor / 2; value += minor) {
            const roundedValue = Math.round(value * 10000) / 10000;

            const majorIndex = Math.round(roundedValue / major);
            const majorValue = majorIndex * major;

            const isMajor = Math.abs(roundedValue - majorValue) < minor * 0.001;

            marks.push({
                value: roundedValue,
                major: isMajor,
                label: isMajor ? formatRulerLabel(roundedValue) : ""
            });
        }

        return marks;
    };

    const syncGuidesToContainer = async () => {
        await nextTick();

        if (guideSyncFrame) {
            cancelAnimationFrame(guideSyncFrame);
        }

        guideSyncFrame = requestAnimationFrame(() => {
            guideSyncTick.value++;
            guideSyncFrame = null;
        });
    };

    const onGuideViewportResize = () => {
        syncGuidesToContainer();
    };

    const getCanvasEl = () => {
        return document.getElementById(props.canvasId);
    };

    const getMainEl = () => {
        return document.getElementById(props.mainId);
    };

    const parseTransformOrigin = (value) => {
        const parts = value.split(" ");

        return {
            x: parseFloat(parts[0]) || 0,
            y: parseFloat(parts[1]) || 0
        };
    };

    const getElementOffsetTo = (element, target) => {
        let x = element.offsetLeft || 0;
        let y = element.offsetTop || 0;

        let parent = element.offsetParent;

        while (parent && parent !== target) {
            x += parent.offsetLeft || 0;
            y += parent.offsetTop || 0;
            parent = parent.offsetParent;
        }

        return { x, y };
    };

    const getCanvasToMainMatrix = () => {
        const canvas = getCanvasEl();
        const main = getMainEl();

        if (!canvas || !main) {
            return new DOMMatrix();
        }

        const style = window.getComputedStyle(canvas);

        const origin = parseTransformOrigin(style.transformOrigin);

        const cssMatrix =
            style.transform && style.transform !== "none"
                ? new DOMMatrix(style.transform)
                : new DOMMatrix();

        const offset = getElementOffsetTo(canvas, main);

        return new DOMMatrix()
            .translate(offset.x + origin.x, offset.y + origin.y)
            .multiply(cssMatrix)
            .translate(-origin.x, -origin.y);
    };

    const canvasPointToMain = (x, y) => {
        const point = new DOMPoint(x, y).matrixTransform(getCanvasToMainMatrix());

        return {
            x: point.x,
            y: point.y
        };
    };

    const mainPointToCanvas = (x, y) => {
        const inverse = getCanvasToMainMatrix().inverse();

        const point = new DOMPoint(x, y).matrixTransform(inverse);

        return {
            x: point.x,
            y: point.y
        };
    };

    const getLocalPoint = (event) => {
        const main = getMainEl();

        if (!main) {
            return { x: 0, y: 0 };
        }

        const mainRect = main.getBoundingClientRect();

        const mainX = event.clientX - mainRect.left;
        const mainY = event.clientY - mainRect.top;

        return mainPointToCanvas(mainX, mainY);
    };

    const columnPositions = computed(() => {
        guideSyncTick.value;

        return createRulerMarks(
            props.settings.width,
            props.container.a || 1
        );
    });

    const rowPositions = computed(() => {
        guideSyncTick.value;

        return createRulerMarks(
            props.settings.height,
            props.container.d || 1
        );
    });

    const startDraggingGuide = async (helper, event) => {
        await nextTick();
        event.preventDefault();
        event.stopPropagation();

        guide.value = helper;

        register("add", document, "pointermove", dragGuide);
        register("add", document, "pointerup", stopDraggingGuide);
    };

    const startGuide = async (type, event) => {
        await nextTick();
        event.preventDefault();
        event.stopPropagation();

        const point = getLocalPoint(event);

        let position = type === "horizontal" ? point.y : point.x;

        if (type === "horizontal") {
            position = clamp(position, 0, props.settings.height);
        } else {
            position = clamp(position, 0, props.settings.width);
        }

        const tolerance = 5 / (props.container.a || 1);

        const index = props.guides.findIndex(
            g => g.type === type && Math.abs(g.position - position) < tolerance
        );

        if (index !== -1) {
            props.guides.splice(index, 1);
        } else {
            const newGuide = {
                id: Date.now(),
                type,
                position
            };

            props.guides.push(newGuide);

            await startDraggingGuide(newGuide, event);
        }

        emitEvent("app:update-guide", props.guides);
        syncGuidesToContainer();
    };

    const dragGuide = (event) => {
        event.preventDefault();

        if (!guide.value) return;

        const point = getLocalPoint(event);

        let newPosition =
            guide.value.type === "horizontal"
                ? point.y
                : point.x;

        if (guide.value.type === "horizontal") {
            newPosition = clamp(newPosition, 0, props.settings.height);
        } else {
            newPosition = clamp(newPosition, 0, props.settings.width);
        }

        if (guide.value.position !== newPosition) {
            guide.value.position = newPosition;
            syncGuidesToContainer();
        }
    };

    const stopDraggingGuide = () => {
        if (!guide.value) return;

        const removeThreshold = 20 / (props.container.a || 1);

        const isOnXAxis =
            guide.value.type === "horizontal" &&
            guide.value.position <= removeThreshold;

        const isOnYAxis =
            guide.value.type === "vertical" &&
            guide.value.position <= removeThreshold;

        if (isOnXAxis || isOnYAxis) {
            const guidesRef = props.guides.filter(g => g.id !== guide.value.id);
            emitEvent("app:update-guide", guidesRef);
        } else {
            emitEvent("app:update-guide", props.guides);
        }

        guide.value = null;

        register("remove", document, "pointermove", dragGuide);
        register("remove", document, "pointerup", stopDraggingGuide);

        syncGuidesToContainer();
    };

    const getGuideStyle = (g) => {
        guideSyncTick.value;

        const main = getMainEl();

        if (!main) {
            return {};
        }

        const mainWidth = main.clientWidth;
        const mainHeight = main.clientHeight;

        let p1;
        let p2;

        if (g.type === "horizontal") {
            p1 = canvasPointToMain(0, g.position);
            p2 = canvasPointToMain(props.settings.width, g.position);
        } else {
            p1 = canvasPointToMain(g.position, 0);
            p2 = canvasPointToMain(g.position, props.settings.height);
        }

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        const length = Math.sqrt(dx * dx + dy * dy);

        if (!length) {
            return {};
        }

        const ux = dx / length;
        const uy = dy / length;

        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        const mainDiagonal = Math.sqrt(
            mainWidth * mainWidth +
            mainHeight * mainHeight
        );

        const canvasVisualWidth = props.settings.width * (props.container.a || 1);
        const canvasVisualHeight = props.settings.height * (props.container.d || 1);

        const canvasDiagonal = Math.sqrt(
            canvasVisualWidth * canvasVisualWidth +
            canvasVisualHeight * canvasVisualHeight
        );

        const offsetDistance = Math.sqrt(
            (props.container.x || 0) * (props.container.x || 0) +
            (props.container.y || 0) * (props.container.y || 0)
        );

        /**
         * Sehr lang, damit die Guide auch bei A4, Zoom, Rotation
         * und verschobenem Canvas optisch nicht abgeschnitten wird.
         */
        const visualLength = (Math.max(mainDiagonal, canvasDiagonal) + offsetDistance) * 4;

        const startX = p1.x - ux * visualLength / 2;
        const startY = p1.y - uy * visualLength / 2;

        return {
            position: "absolute",
            left: `${startX}px`,
            top: `${startY}px`,
            width: `${visualLength}px`,
            height: "1px",
            background: "blue",
            transform: `rotate(${angle}deg)`,
            transformOrigin: "0 0",
            cursor: g.type === "horizontal" ? "row-resize" : "col-resize",
            pointerEvents: "auto"
        };
    };

    watch(
        () => [
            props.container.x,
            props.container.y,
            props.container.a,
            props.container.b,
            props.container.c,
            props.container.d,
            props.container.rotate,
            props.settings.width,
            props.settings.height,
            props.settings.unit,
            props.settings.dpi
        ],
        () => {
            syncGuidesToContainer();
        },
        {
            immediate: true
        }
    );

    onMounted(() => {
        window.addEventListener("resize", onGuideViewportResize);
        syncGuidesToContainer();
    });

    onBeforeUnmount(() => {
        if (guideSyncFrame) {
            cancelAnimationFrame(guideSyncFrame);
            guideSyncFrame = null;
        }

        window.removeEventListener("resize", onGuideViewportResize);

        register("removeAll");
    });

    return {
        rowPositions,
        columnPositions,
        startGuide,
        startDraggingGuide,
        getGuideStyle
    };
}

export const guideProps = {
    guides: {
        type: Array,
        required: true
    },
    settings: {
        type: Object,
        required: true
    },
    container: {
        type: Object,
        required: true
    },
    canvasId: {
        type: String,
        required: true
    },
    mainId: {
        type: String,
        required: true
    }
};