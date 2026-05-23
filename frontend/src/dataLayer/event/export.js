import {nextTick} from "vue";
import {screenshot} from "@/utils/screenshot";
import {Accumulator} from "@/view/models/page/material/core/Accumulator/Accumulator";
import {isFiniteNumber, number} from "@/utils/math";

const optionValue = value => value && typeof value === "object" && "value" in value ? value.value : value;
const TIMELINE_UNITS_PER_SECOND = 60;

const dataUrlToBlob = async dataUrl => {
    const response = await fetch(dataUrl);
    return await response.blob();
};

const hasLayer3D = route => (route.localData?.layers?.value || []).some(layer => layer?.type === 5);

const updateExportPreview = (route, src, id, title = "Export Preview") => {
    route.previewData.value.mode = 0;
    route.previewData.value.title = title;
    route.previewData.value.id = id;
    route.previewData.value.src = src;
};

const startExportQueueStatus = async (
    route,
    title = "Export",
    subTitle = "Backend verarbeitet /export"
) => {

    await route.emit("app:update-queue", {
        title,
        subTitle,
        percent: 0,
        indeterminate: true,
        complete: false,
        method: "POST",
        path: "/export",
        wait: true,
    });
};

const toNumberSafe = (value, fallback = 0) => {
    const n = number(value);
    return isFiniteNumber(n) ? n : fallback;
};

const buildTimelineExportPlan = ({ start, end, fps, durationSeconds: requestedDurationSeconds = 0 }) => {
    const safeFps = Math.max(1, Math.min(number(fps) || 30, 240));
    const timelineStart = toNumberSafe(start, 0);
    const timelineEnd = toNumberSafe(end, timelineStart);
    const direction = timelineEnd >= timelineStart ? 1 : -1;
    const durationUnits = Math.abs(timelineEnd - timelineStart);
    const fallbackDurationSeconds = durationUnits / TIMELINE_UNITS_PER_SECOND;
    const configuredDurationSeconds = toNumberSafe(requestedDurationSeconds, 0);
    const durationSeconds = Math.max(
        1 / safeFps,
        configuredDurationSeconds > 0 ? configuredDurationSeconds : fallbackDurationSeconds
    );
    const frameCount = Math.max(1, Math.round(durationSeconds * safeFps));
    const clock = new Accumulator(0, 1);

    const frames = Array.from({ length: frameCount }, (_, index) => {
        const mediaTimeSeconds = Math.min(clock.time, durationSeconds);
        const progress = durationSeconds > 0 ? Math.min(mediaTimeSeconds / durationSeconds, 1) : 0;
        const frame = {
            index,
            progress,
            mediaTimeSeconds,
            timelineTime: timelineStart + direction * durationUnits * progress,
        };

        clock.update(1 / safeFps);

        return frame;
    });

    return {
        frames,
        fps: safeFps,
        durationSeconds,
        encodedDurationSeconds: frameCount / safeFps,
        timelineStart,
        timelineEnd,
        timelineUnitsPerSecond: TIMELINE_UNITS_PER_SECOND,
    };
};

const captureCanvasFrame = async (route, resolution) => {
    const container = document.getElementById(route.tempData.canvasId.value);
    const element = container?.querySelector(".canvas-content") || container;

    if (!element) {
        throw new Error("Canvas fuer MP4-Export nicht gefunden.");
    }

    const targetWidth = Math.max(64, number(resolution) || element.clientWidth || 1024);
    const scale = element.clientWidth > 0 ? targetWidth / element.clientWidth : 1;

    return await screenshot(element, {
        backgroundColor: null,
        scale,
        useCORS: true,
    });
};

const setExportProgress = async (route, percent, title = "MP4 Export", subTitle = "Frames werden gerendert") => {
    await route.emit("app:update-queue", {
        title,
        subTitle,
        percent,
        indeterminate: false,
        complete: percent >= 100,
        method: percent >= 100 ? "FINISH" : "PENDING",
        path: "/export",
        wait: percent <= 98,
    });
};

const exportMp4WithTimelineCapture = async (route, data) => {
    const timeline = route.timelineData?.value || {};
    const useTimeline = optionValue(data.useTimeline) === true;
    const start = useTimeline ? (timeline.startTime ?? -100) : data.exportStart;
    const end = useTimeline ? (timeline.endTime ?? 100) : data.exportEnd;
    const exportPlan = buildTimelineExportPlan({
        start,
        end,
        fps: data.timelineFps,
        durationSeconds: data.videoDurationSeconds,
    });
    const frames = exportPlan.frames;
    const oldTime = timeline.time;
    const oldExportTimeSeconds = timeline.exportTimeSeconds;
    const oldExportFrameIndex = timeline.exportFrameIndex;
    const oldExportFrameCount = timeline.exportFrameCount;
    const oldExportFrameProgress = timeline.exportFrameProgress;
    const oldExportDurationSeconds = timeline.exportDurationSeconds;
    const oldExportTimelineUnitsPerSecond = timeline.exportTimelineUnitsPerSecond;
    const oldSelection = [...(route.localData.selectedLayer.value || [])];

    route.localData.selectedLayer.value = [];
    route.timelineData.value.exportFrameCount = frames.length;
    route.timelineData.value.exportDurationSeconds = exportPlan.durationSeconds;
    route.timelineData.value.exportTimelineUnitsPerSecond = exportPlan.timelineUnitsPerSecond;
    await setExportProgress(route, 0, "MP4 Export", `${frames.length} Frames vorbereiten`);

    const session = await route.api.startMp4Export({
        ...data,
        frameCount: frames.length,
        durationSeconds: exportPlan.durationSeconds,
        encodedDurationSeconds: exportPlan.encodedDurationSeconds,
        timelineStart: exportPlan.timelineStart,
        timelineEnd: exportPlan.timelineEnd,
        timelineUnitsPerSecond: exportPlan.timelineUnitsPerSecond,
    });

    try {
        for (const frameInfo of frames) {
            const index = frameInfo.index;

            route.timelineData.value.time = frameInfo.timelineTime;
            route.timelineData.value.exportTimeSeconds = frameInfo.mediaTimeSeconds;
            route.timelineData.value.exportFrameIndex = index;
            route.timelineData.value.exportFrameProgress = frameInfo.progress;

            await nextTick();

            const frameDataUrl = await captureCanvasFrame(route, data.videoResolution);
            updateExportPreview(
                route,
                frameDataUrl,
                `mp4-frame-${index}-${Date.now()}`,
                `Frame ${index + 1}/${frames.length}`
            );

            const frame = await dataUrlToBlob(frameDataUrl);

            await route.api.appendMp4Frame({
                sessionId: session.sessionId,
                frameIndex: index,
                frameTime: frameInfo.timelineTime,
                mediaTimeSeconds: frameInfo.mediaTimeSeconds,
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
        const finishPromise = route.api.finishMp4Export({ sessionId: session.sessionId });
        await startExportQueueStatus(route, "MP4 Export", "Backend kodiert /export");
        const res = await finishPromise;
        await setExportProgress(route, 100, "MP4 Export", "Video fertig");

        return res;
    } finally {
        if (oldTime !== undefined) {
            route.timelineData.value.time = oldTime;
        }
        route.timelineData.value.exportTimeSeconds = oldExportTimeSeconds ?? 0;
        route.timelineData.value.exportFrameIndex = oldExportFrameIndex ?? 0;
        route.timelineData.value.exportFrameCount = oldExportFrameCount ?? 0;
        route.timelineData.value.exportFrameProgress = oldExportFrameProgress ?? 0;
        route.timelineData.value.exportDurationSeconds = oldExportDurationSeconds ?? 0;
        route.timelineData.value.exportTimelineUnitsPerSecond = oldExportTimelineUnitsPerSecond ?? TIMELINE_UNITS_PER_SECOND;
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
    "export:video-duration": async (payload) => {
        route.exportData.value.videoDurationSeconds = payload;
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
        route.previewData.value.file = "";
        await setExportProgress(route, 1, "Export", "Export wird vorbereitet");
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
            videoDurationSeconds: payload.videoDurationSeconds,
            videoResolution: payload.videoResolution,
            videoProfile: optionValue(payload.videoProfile),
            videoPreset: optionValue(payload.videoPreset),
            videoEncoding: optionValue(payload.videoEncoding),
            videoBitrate: payload.videoBitrate,
            videoCrf: payload.videoCrf,
            useFileSystem: payload.useFileSystem,
        };

        if (type !== "MP4" && hasLayer3D(route)) {
            await setExportProgress(route, 8, "Export", "3D Snapshot wird gerendert");
            await nextTick();

            const snapshotResolution = route.localData?.viewport?.value?.width || payload.videoResolution;
            const snapshotDataUrl = await captureCanvasFrame(route, snapshotResolution);
            updateExportPreview(route, snapshotDataUrl, `snapshot-${Date.now()}`, payload.title || "Export Preview");
            data.snapshot = await dataUrlToBlob(snapshotDataUrl);
            await setExportProgress(route, 15, "Export", "3D Snapshot bereit");
        }

        const res = type === "MP4"
            ? await exportMp4WithTimelineCapture(route, data)
            : await (async () => {
                const exportPromise = route.api.updateExport(data);
                await startExportQueueStatus(route, "Export", "Backend verarbeitet /export");
                return await exportPromise;
            })();

        if (res) {
            route.previewData.value.mode = 0
            route.previewData.value.title = res.title
            route.previewData.value.id = res.id
            route.previewData.value.src =  res.src
            route.previewData.value.file =  res.file
            await setExportProgress(route, 100, "Export", "Export fertig");
        }
    }
})
