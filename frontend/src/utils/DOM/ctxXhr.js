const listeners = new Set();
export function ctxXhr(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}
function emit(event, payload) { listeners.forEach(cb => { try{ cb(event, payload); }catch(e){console.error(e)} }); }
(function patchXHR() {
    if (typeof XMLHttpRequest === 'undefined') return;
    const OriginalOpen = XMLHttpRequest.prototype.open;
    const OriginalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(...args){ this._url = args[1]; return OriginalOpen.apply(this, args); };
    XMLHttpRequest.prototype.send = function(...args){
        const start = performance.now();
        emit('xhr-progress:start', { url: this._url });
        this.addEventListener('progress', (e) => {
            emit('xhr-progress:update', { url: this._url, loaded: e.loaded, total: e.total, progress: e.lengthComputable ? e.loaded / e.total : null });
        });
        this.addEventListener('loadend', () => {
            emit('xhr-progress:done', { url: this._url, duration: Math.round(performance.now()-start) });
        });
        return OriginalSend.apply(this, args);
    };
})();
(function patchFetch() {
    if (typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch;
    window.fetch = async function(...args){
        const url = args[0];
        const start = performance.now();
        emit('xhr-progress:start', { url });
        try {
            const response = await originalFetch(...args);
            const cloned = response.clone();
            const contentLength = cloned.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength,10) : null;
            if (!cloned.body || !total) {
                emit('xhr-progress:done', { url, duration: Math.round(performance.now()-start) });
                return response;
            }
            const reader = cloned.body.getReader();
            let loaded = 0;
            // eslint-disable-next-line no-constant-condition
            while(true){
                const { done, value } = await reader.read();
                if (done) break;
                loaded += value.length;
                emit('xhr-progress:update', { url, loaded, total, progress: total ? loaded/total : null });
            }
            emit('xhr-progress:done', { url, duration: Math.round(performance.now()-start) });
            return response;
        } catch(err){
            emit('xhr-progress:done', { url, error: err.message });
            throw err;
        }
    };
})();
