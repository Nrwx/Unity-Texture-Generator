import {nextTick} from "vue";
import {screenshot} from "@/utils/screenshot";

const optionValue = value => value && typeof value === "object" && "value" in value ? value.value : value;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFrames = async (count = 2) => {
    for (let i = 0; i < count; i += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
};

const dataUrlToBlob = async dataUrl => {
    const response = await fetch(dataUrl);
    return await response.blob();
};

const toNumberSafe = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const parseDurationSeconds = value => {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    const raw = String(value).trim();

    // 04:13.26 -> echte Sekunden für MP4-Dauer
    if (raw.includes(":")) {
        const parts = raw.split(":").map(part => part.trim());
        const seconds = Number(parts.pop()) || 0;
        const minutes = Number(parts.pop()) || 0;
        const hours = Number(parts.pop()) || 0;

        return hours * 3600 + minutes * 60 + seconds;
    }

    const number = Number(raw);

    if (!Number.isFinite(number)) {
        return 0;
    }

    // 413 oder 413.26 wird für Dauer als 4:13.26 interpretiert
    if (number >= 100) {
        const [integerPart, decimalPart = ""] = raw.split(".");
        const padded = integerPart.padStart(3, "0");
        const secondsPart = Number(padded.slice(-2));
        const minutesPart = Number(padded.slice(0, -2)) || 0;
        const fractional = decimalPart ? Number(`0.${decimalPart}`) : 0;

        return minutesPart * 60 + secondsPart + fractional;
    }

    return number;
};

const buildExportFrames = ({ start, end, fps }) => {
    const safeFps = Math.max(1, Math.min(Number(fps) || 30, 240));

    // Das ist die Timeline-/Keyframe-Domäne:
    // 0 -> 413 bleibt 0 -> 413.
    const timelineStart = toNumberSafe(start, 0);
    const timelineEnd = toNumberSafe(end, timelineStart);

    // Das ist die echte Videodauer:
    // 413 wird als 4:13 gelesen.
    const durationStart = parseDurationSeconds(start);
    const durationEnd = parseDurationSeconds(end);
    const durationSeconds = Math.max(0, Math.abs(durationEnd - durationStart));

    const frameCount = Math.max(1, Math.round(durationSeconds * safeFps) + 1);

    return Array.from({ length: frameCount }, (_, index) => {
        const progress = frameCount <= 1 ? 0 : index / (frameCount - 1);

        return {
            index,
            progress,
            mediaTimeSeconds: durationStart + progress * (durationEnd - durationStart),
            timelineTime: timelineStart + progress * (timelineEnd - timelineStart),
        };
    });
};

const captureCanvasFrame = async (route, resolution) => {
    const container = document.getElementById(route.tempData.canvasId.value);
    const element = container?.querySelector(".canvas-content") || container;

    if (!element) {
        throw new Error("Canvas fuer MP4-Export nicht gefunden.");
    }

    const targetWidth = Math.max(64, Number(resolution) || element.clientWidth || 1024);
    const scale = element.clientWidth > 0 ? targetWidth / element.clientWidth : 1;

    return await screenshot(element, {
        backgroundColor: null,
        scale,
        useCORS: true,
    });
};

const setExportProgress = async (route, percent, title = "MP4 Export", subTitle = "Frames werden gerendert") => {
    route.windowStates.queue.value = true;
    await route.emit("app:update-queue", {
        title,
        subTitle,
        percent,
        indeterminate: false,
        complete: percent >= 100,
        method: percent >= 100 ? "FINISH" : "POST",
        path: "/export/mp4",
    });
};

const exportMp4WithTimelineCapture = async (route, data) => {
    const timeline = route.timelineData?.value || {};
    const useTimeline = optionValue(data.useTimeline) === true;
    const start = useTimeline ? (timeline.startTime ?? -100) : data.exportStart;
    const end = useTimeline ? (timeline.endTime ?? 100) : data.exportEnd;
    const frames = buildExportFrames({
        start,
        end,
        fps: data.timelineFps,
    });
    const oldTime = timeline.time;
    const oldTimelineState = route.windowStates.timeline.value;
    const oldSelection = [...(route.localData.selectedLayer.value || [])];

    route.windowStates.timeline.value = true;
    route.localData.selectedLayer.value = [];
    await setExportProgress(route, 0, "MP4 Export", `${frames.length} Frames vorbereiten`);

    const session = await route.api.startMp4Export({
        ...data,
        frameCount: frames.length,
    });

    try {
        for (const frameInfo of frames) {
            const index = frameInfo.index;

            route.timelineData.value.time = frameInfo.timelineTime;

            await nextTick();
            await waitFrames(3);
            await wait(8);

            const frameDataUrl = await captureCanvasFrame(route, data.videoResolution);

            const frame = await dataUrlToBlob(frameDataUrl);

            await route.api.appendMp4Frame({
                sessionId: session.sessionId,
                frameIndex: index,
                frameTime: frameInfo.timelineTime,
                frame,
            });

            await setExportProgress(
                route,
                Math.round(((index + 1) / frames.length) * 95),
                "MP4 Export",
                `Frame ${index + 1}/${frames.length}`
            );
        }

        await setExportProgress(route, 98, "MP4 Export", "Video wird kodiert");
        const res = await route.api.finishMp4Export({ sessionId: session.sessionId });
        await setExportProgress(route, 100, "MP4 Export", "Video fertig");

        return res;
    } finally {
        if (oldTime !== undefined) {
            route.timelineData.value.time = oldTime;
        }
        route.windowStates.timeline.value = oldTimelineState;
        route.localData.selectedLayer.value = oldSelection;
    }
};

export const exportEvent = (route) => ({
    "export:mode": async (payload) => {
        const mode = optionValue(payload);
        route.exportData.value.mode = mode;
        if (mode === 1) {
            route.emit('export:type', 'SVG')
        } else if (mode === 2) {
            route.emit('export:type', 'PDF')
        } else if (mode === 3) {
            route.emit('export:type', 'MP4')
        } else {
            route.emit('export:type', 'PNG')
        }
    },
    "export:quality": async (payload) => {
        route.exportData.value.quality = payload;
    },
    "export:type": async (payload) => {
        route.exportData.value.type = optionValue(payload);
    },
    "export:dds-compress": async (payload) => {
        route.exportData.value.ddsCompress = optionValue(payload);
    },
    "export:dpi": async (payload) => {
        route.exportData.value.dpi = payload;
    },
    "export:title": async (payload) => {
        route.exportData.value.title = payload;
    },
    "export:compress": async (payload) => {
        route.exportData.value.compress = payload;
    },
    "export:mipmap": async (payload) => {
        route.exportData.value.mipmap = payload;
    },
    "export:inlineCss": async (payload) => {
        route.exportData.value.inlineCss= payload;
    },
    "export:paperSize": async (payload) => {
        route.exportData.value.paperSize = payload;
    },
    "export:landscape": async (payload) => {
        route.exportData.value.landscape = payload;
    },
    "export:margin": async (payload) => {
        route.exportData.value.margin = payload;
    },
    "export:raster": async (payload) => {
        route.exportData.value.raster = payload;
    },
    "export:pdfFitMode": async (payload) => {
        route.exportData.value.pdfFitMode = optionValue(payload);
    },
    "export:useTimeline": async (payload) => {
        route.exportData.value.useTimeline = optionValue(payload);
    },
    "export:start": async (payload) => {
        route.exportData.value.exportStart = payload;
    },
    "export:end": async (payload) => {
        route.exportData.value.exportEnd = payload;
    },
    "export:fps": async (payload) => {
        route.exportData.value.timelineFps = payload;
    },
    "export:video-resolution": async (payload) => {
        route.exportData.value.videoResolution = payload;
    },
    "export:video-profile": async (payload) => {
        route.exportData.value.videoProfile = optionValue(payload);
    },
    "export:video-preset": async (payload) => {
        route.exportData.value.videoPreset = optionValue(payload);
    },
    "export:video-encoding": async (payload) => {
        route.exportData.value.videoEncoding = optionValue(payload);
    },
    "export:video-bitrate": async (payload) => {
        route.exportData.value.videoBitrate = payload;
    },
    "export:video-crf": async (payload) => {
        route.exportData.value.videoCrf = payload;
    },
    "export:use-filesystem": async (payload) => {
        route.exportData.value.useFileSystem = payload;
    },
    "export:update": async (payload) => {
        const type = optionValue(payload.type);
        const timeline = route.timelineData?.value || {};
        const data = {
            mode: optionValue(payload.mode),
            quality: payload.quality,
            type,
            dpi: payload.dpi,
            title: payload.title,
            compress: payload.compress,
            inlineCss: payload.inlineCss,
            paperSize: payload.paperSize,
            raster: optionValue(payload.raster),
            pdfFitMode: optionValue(payload.pdfFitMode),
            landscape: optionValue(payload.landscape),
            margin: payload.margin,
            mipmap: payload.mipmap,
            ddsCompress: optionValue(payload.ddsCompress),
            useTimeline: optionValue(payload.useTimeline),
            timelineStart: timeline.startTime ?? -100,
            timelineEnd: timeline.endTime ?? 100,
            timelineTime: timeline.time ?? 0,
            exportStart: payload.exportStart,
            exportEnd: payload.exportEnd,
            timelineFps: payload.timelineFps,
            videoResolution: payload.videoResolution,
            videoProfile: optionValue(payload.videoProfile),
            videoPreset: optionValue(payload.videoPreset),
            videoEncoding: optionValue(payload.videoEncoding),
            videoBitrate: payload.videoBitrate,
            videoCrf: payload.videoCrf,
            useFileSystem: payload.useFileSystem,
        };

        const res = type === "MP4"
            ? await exportMp4WithTimelineCapture(route, data)
            : await route.api.updateExport(data);

        if (res) {
            route.previewData.value.mode = 0
            route.previewData.value.title = res.title
            route.previewData.value.id = res.id
            route.previewData.value.src =  res.src
            route.previewData.value.file =  res.file
        }
    }
})
