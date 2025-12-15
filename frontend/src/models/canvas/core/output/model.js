export class Output {
    constructor(renderEngine, progressCallback = null) {
        this.renderEngine = renderEngine;
        this.scene = renderEngine.scene;
        this.config = renderEngine.config;
        this.state = 'idle';       // idle | running | paused | completed | cancelled | error
        this.frames = [];
        this.outputPath = this.config.outputPath || "./output";
        this.progressCallback = progressCallback;

        // Preview Canvas (Miniatur für Live Tracking)
        this.previewCanvas = null;
        this.previewCtx = null;

        this._pauseResolve = null;
        this._cancelRequested = false;
    }

    // ============================================================
    // Export starten
    // ============================================================
    async start(preview = true) {
        if (this.state === 'running') return;
        this.state = 'running';
        this._cancelRequested = false;

        if (preview) {
            this.previewCanvas = document.createElement("canvas");
            this.previewCanvas.width = Math.floor(this.renderEngine.canvas.width / 4);
            this.previewCanvas.height = Math.floor(this.renderEngine.canvas.height / 4);
            this.previewCtx = this.previewCanvas.getContext("2d");
        }

        try {
            if (this.config.mode === 'bild') {
                await this._renderFrames(preview);
            } else if (this.config.mode === 'video') {
                await this._renderVideo(preview);
            }
            if (!this._cancelRequested) this.state = 'completed';
            await this._reportProgress(100);
        } catch (err) {
            console.error(err);
            this.state = 'error';
        }
    }

    // ============================================================
    // Pause / Resume / Cancel
    // ============================================================
    pause() {
        if (this.state !== 'running') return;
        this.state = 'paused';
        return new Promise(resolve => this._pauseResolve = resolve);
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'running';
        if (this._pauseResolve) {
            this._pauseResolve();
            this._pauseResolve = null;
        }
    }

    cancel() {
        if (!['running','paused'].includes(this.state)) return;
        this._cancelRequested = true;
        if (this.state === 'paused') this.resume();
        this.state = 'cancelled';
    }

    // ============================================================
    // Bildmodus rendern
    // ============================================================
    async _renderFrames(preview) {
        const startFrame = this.config.startFrame ?? 0;
        const endFrame = this.config.endFrame ?? (this.config.frames ?? 1);
        const totalFrames = endFrame - startFrame;

        for (let i = startFrame; i < endFrame; i++) {
            if (this._cancelRequested) break;
            await this._checkPause();

            const offCanvas = new OffscreenCanvas(
                this.renderEngine.canvas.width,
                this.renderEngine.canvas.height
            );
            this.renderEngine.render(false, offCanvas); // Vollwertiges Export-Render
            this.frames.push(offCanvas);

            if (preview) this._renderPreview(offCanvas);

            await this._reportProgress(((i - startFrame + 1) / totalFrames) * 100);

            await new Promise(r => setTimeout(r, 0));
        }
    }

    // ============================================================
    // Video Modus rendern
    // ============================================================
    async _renderVideo(preview) {
        const startTime = this.config.startTime ?? 0;
        const endTime = this.config.endTime ?? 100;
        const fps = this.config.frames ?? 30;
        const frameCount = Math.floor((endTime - startTime) * fps);

        for (let i = 0; i < frameCount; i++) {
            if (this._cancelRequested) break;
            await this._checkPause();

            const t = startTime + i / fps;
            if (this.scene.setTime) this.scene.setTime(t); // Zeitschiebung für Animation

            const offCanvas = new OffscreenCanvas(
                this.renderEngine.canvas.width,
                this.renderEngine.canvas.height
            );
            this.renderEngine.render(false, offCanvas);
            this.frames.push(offCanvas);

            if (preview) this._renderPreview(offCanvas);

            await this._reportProgress(((i + 1) / frameCount) * 100);
            await new Promise(r => setTimeout(r, 0));
        }

        if (!this._cancelRequested) await this._exportVideo();
    }

    // ============================================================
    // Prüfen, ob pausiert wurde
    // ============================================================
    async _checkPause() {
        while (this.state === 'paused') {
            await new Promise(resolve => this._pauseResolve = resolve);
            this._pauseResolve = null;
        }
    }

    // ============================================================
    // Vorschau Rendern
    // ============================================================
    _renderPreview(offCanvas) {
        if (!this.previewCtx) return;

        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(
            offCanvas,
            0, 0, this.previewCanvas.width, this.previewCanvas.height
        );
    }

    // ============================================================
    // Fortschritt melden
    // ============================================================
    async _reportProgress(percent) {
        if (typeof this.progressCallback === "function") {
            await this.progressCallback(Math.min(Math.max(percent, 0), 100));
        }
    }

    // ============================================================
    // Video Export (WebM)
    // ============================================================
    async _exportVideo() {
        if (!this.frames.length || !this.outputPath) return;

        const stream = this.frames[0].captureStream(this.config.frames ?? 30);
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);

        recorder.start();
        setTimeout(() => recorder.stop(), (1000 * this.frames.length) / (this.config.frames ?? 30));

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/webm" });
            const fileName = `${this.outputPath}/output_video.webm`;

            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
        };
    }
}
