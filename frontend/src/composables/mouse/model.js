// @/composables/mouse/model.js
import { ref } from "vue";

export function useMouse({
        register,

        element = null,
        elementId = null,

        main = null,
        mainId = null,

        canvas = null,
        canvasId = null,

        width = 0,
        height = 0,

        mode = "world", // "world" | "local" | "client"

        preventDefault = true,
    } = {}) {
    const cursor = ref({ x: 0, y: 0 });
    const lastMouse = ref({ x: 0, y: 0 });
    const startMouse = ref({ x: 0, y: 0 });

    const isDown = ref(false);
    const button = ref(null);

    const elementEl = ref(null);
    const mainEl = ref(null);
    const canvasEl = ref(null);

    const resolveElement = (target, id = null) => {
        if (target?.value) return target.value;
        if (target?.ref) return target.ref;
        if (target instanceof HTMLElement) return target;
        if (typeof target === "string") return document.getElementById(target);
        if (id) return document.getElementById(id);

        return null;
    };

    const init = () => {
        elementEl.value = resolveElement(element, elementId);
        mainEl.value = resolveElement(main, mainId);
        canvasEl.value = resolveElement(canvas, canvasId);

        if (!elementEl.value && canvasEl.value) {
            elementEl.value = canvasEl.value;
        }

        return {
            element: elementEl.value,
            main: mainEl.value,
            canvas: canvasEl.value,
        };
    };

    const setElements = ({
                             element: nextElement = null,
                             main: nextMain = null,
                             canvas: nextCanvas = null,
                         } = {}) => {
        if (nextElement) {
            elementEl.value = resolveElement(nextElement);
        }

        if (nextMain) {
            mainEl.value = resolveElement(nextMain);
        }

        if (nextCanvas) {
            canvasEl.value = resolveElement(nextCanvas);
        }

        if (!elementEl.value && canvasEl.value) {
            elementEl.value = canvasEl.value;
        }
    };

    const setLast = (event) => {
        lastMouse.value.x = event.clientX;
        lastMouse.value.y = event.clientY;
    };

    const setStart = (event) => {
        startMouse.value.x = event.clientX;
        startMouse.value.y = event.clientY;
    };

    const getClientPoint = (event) => ({
        x: event.clientX,
        y: event.clientY,
    });

    const parseTransformOriginFromStyle = (value) => {
        const parts = value.split(" ");

        return {
            x: Number.parseFloat(parts[0]) || width / 2,
            y: Number.parseFloat(parts[1]) || height / 2,
        };
    };

    const parseTransformOrigin = (el) => {
        const style = window.getComputedStyle(el);
        const parts = style.transformOrigin.split(" ");

        return {
            x: Number.parseFloat(parts[0]) || 0,
            y: Number.parseFloat(parts[1]) || 0,
        };
    };

    const getElementTransformMatrix = (el) => {
        const style = window.getComputedStyle(el);

        if (!style.transform || style.transform === "none") {
            return new DOMMatrix();
        }

        return new DOMMatrix(style.transform);
    };

    const getNodeLocalMatrix = (node) => {
        const origin = parseTransformOrigin(node);
        const transform = getElementTransformMatrix(node);

        return new DOMMatrix()
            .translateSelf(node.offsetLeft || 0, node.offsetTop || 0)
            .translateSelf(origin.x, origin.y)
            .multiplySelf(transform)
            .translateSelf(-origin.x, -origin.y);
    };

    const getAncestorsToDocumentMatrix = (el = elementEl.value) => {
        let matrix = new DOMMatrix();

        if (!el) {
            return matrix;
        }

        /**
         * Wichtig:
         * Wir starten beim offsetParent, nicht bei el selbst.
         * Dadurch werden Parent-/Container-Transforms invertiert,
         * aber die eigene Layer-/Canvas-Transformation bleibt außen vor.
         */
        let node = el.offsetParent;

        while (node && node instanceof HTMLElement) {
            const localMatrix = getNodeLocalMatrix(node);
            matrix = localMatrix.multiply(matrix);
            node = node.offsetParent;
        }

        return matrix;
    };

    const clientToLocalPoint = (clientX, clientY, el = elementEl.value) => {
        if (!el) {
            return { x: 0, y: 0 };
        }

        const documentPoint = new DOMPoint(
            clientX + window.scrollX,
            clientY + window.scrollY
        );

        const ancestorsToDocument = getAncestorsToDocumentMatrix(el);
        const documentToAncestors = ancestorsToDocument.inverse();

        const parentPoint = documentPoint.matrixTransform(documentToAncestors);

        return {
            x: parentPoint.x - (el.offsetLeft || 0),
            y: parentPoint.y - (el.offsetTop || 0),
        };
    };

    const getElementOffsetTo = (source, target) => {
        let x = source.offsetLeft || 0;
        let y = source.offsetTop || 0;

        let parent = source.offsetParent;

        while (parent && parent !== target) {
            x += parent.offsetLeft || 0;
            y += parent.offsetTop || 0;
            parent = parent.offsetParent;
        }

        return { x, y };
    };

    const getCanvasLayoutData = () => {
        const canvasNode = canvasEl.value;
        const mainNode = mainEl.value;

        if (!canvasNode || !mainNode) {
            return null;
        }

        const style = window.getComputedStyle(canvasNode);
        const origin = parseTransformOriginFromStyle(style.transformOrigin);
        const offset = getElementOffsetTo(canvasNode, mainNode);

        return {
            canvas: canvasNode,
            main: mainNode,
            style,
            origin,
            offset,
        };
    };

    const getCanvasToMainMatrix = () => {
        const data = getCanvasLayoutData();

        if (!data) {
            return new DOMMatrix();
        }

        const cssMatrix =
            data.style.transform && data.style.transform !== "none"
                ? new DOMMatrix(data.style.transform)
                : new DOMMatrix();

        return new DOMMatrix()
            .translate(data.offset.x + data.origin.x, data.offset.y + data.origin.y)
            .multiply(cssMatrix)
            .translate(-data.origin.x, -data.origin.y);
    };

    const mainPointToCanvas = (x, y) => {
        const inverse = getCanvasToMainMatrix().inverse();
        const point = new DOMPoint(x, y).matrixTransform(inverse);

        return {
            x: point.x,
            y: point.y,
        };
    };

    const clientPointToMain = (clientX, clientY) => {
        const mainNode = mainEl.value;

        if (!mainNode) {
            return { x: 0, y: 0 };
        }

        const rect = mainNode.getBoundingClientRect();

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const screenToWorld = (clientX, clientY) => {
        const mainPoint = clientPointToMain(clientX, clientY);
        return mainPointToCanvas(mainPoint.x, mainPoint.y);
    };

    const resolvePoint = (event) => {
        if (mode === "local") {
            return clientToLocalPoint(event.clientX, event.clientY);
        }

        if (mode === "client") {
            return getClientPoint(event);
        }

        return screenToWorld(event.clientX, event.clientY);
    };

    const createSyntheticEvent = (clientX, clientY) => ({
        clientX,
        clientY,
        button: button.value ?? 0,
        preventDefault: () => {},
        stopPropagation: () => {},
    });

    const createEventFromLast = () => {
        return createSyntheticEvent(lastMouse.value.x, lastMouse.value.y);
    };

    const createContext = (event) => {
        const current = resolvePoint(event);

        const previous = resolvePoint(
            createSyntheticEvent(lastMouse.value.x, lastMouse.value.y)
        );

        const start = resolvePoint(
            createSyntheticEvent(startMouse.value.x, startMouse.value.y)
        );

        const dx = current.x - previous.x;
        const dy = current.y - previous.y;

        const dxStart = current.x - start.x;
        const dyStart = current.y - start.y;

        cursor.value.x = Math.round(current.x);
        cursor.value.y = Math.round(current.y);

        return {
            event,

            cursor,
            current,
            previous,
            start,

            dx,
            dy,
            dxStart,
            dyStart,

            client: getClientPoint(event),
            lastClient: { ...lastMouse.value },
            startClient: { ...startMouse.value },

            isDown: isDown.value,
            button: button.value,

            element: elementEl.value,
            main: mainEl.value,
            canvas: canvasEl.value,

            setLast,
            setStart,

            clientToLocalPoint,
            screenToWorld,
            clientPointToMain,
            mainPointToCanvas,
            getCanvasToMainMatrix,
            getCanvasLayoutData,
            getAncestorsToDocumentMatrix,
        };
    };

    const down = async (event, fn) => {
        if (preventDefault) event.preventDefault();

        isDown.value = true;
        button.value = event.button;

        setStart(event);
        setLast(event);

        if (typeof fn === "function") {
            await fn(createContext(event));
        }
    };

    const move = async (event, fn) => {
        const ctx = createContext(event);

        if (typeof fn === "function") {
            await fn(ctx);
        }

        setLast(event);
    };

    const up = async (event, fn) => {
        const ctx = createContext(event);

        isDown.value = false;
        button.value = null;

        if (typeof fn === "function") {
            await fn(ctx);
        }
    };

    const point = (event) => {
        return resolvePoint(event);
    };

    const bind = (target, type, handler, options) => {
        register("add", target, type, handler, options);
    };

    const unbind = (target, type, handler) => {
        register("remove", target, type, handler);
    };

    return {
        cursor,
        lastMouse,
        startMouse,
        isDown,
        button,

        elementEl,
        mainEl,
        canvasEl,

        init,
        setElements,

        down,
        move,
        up,
        point,

        setLast,
        setStart,
        createEventFromLast,

        bind,
        unbind,

        clientToLocalPoint,

        screenToWorld,
        clientPointToMain,
        mainPointToCanvas,
        getCanvasToMainMatrix,
        getCanvasLayoutData,
        getAncestorsToDocumentMatrix,
    };
}