export async function ctxCheck({t = 8000, images = true}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        console.warn('DOM content nicht gefunden!');
        return [];
    }

    const assets = new Set();

    document.querySelectorAll('link[rel=stylesheet]').forEach((link) => {
        if (link.href) assets.add({url: link.href, type: 'css'});
    });

    document.querySelectorAll('script[src]').forEach((script) => {
        if (script.src) assets.add({url: script.src, type: 'js'});
    });

    if (images){
        document.querySelectorAll('img[src]').forEach((img) => {
            if (img.src) assets.add({url: img.src, type: 'img'});
        });
    }

    const list = Array.from(assets);

    const check = async (asset) => {
        const start = performance.now();

        try {
            const controller = new AbortController();
            const interval = setTimeout(() => controller.abort(), t);

            const res = await fetch(asset.url, {
                method: 'HEAD',
                mode: 'cors',
                signal: controller.signal
            })

            clearTimeout(interval)

            const durration = Math.round(performance.now() - start);

            const size = res.headers.get('content-length');
            const type = res.headers.get('content-type');
            return {
                ...asset,
                status: res.status,
                ok: res.ok,
                contentType: type,
                size: size ? parseInt(size, 10) : null,
                time: durration
            };
        } catch (e) {
            return {
                ...asset,
                status: 'error',
                ok: false,
                contentType: null,
                size: null,
                time: Math.round(performance.now() - start),
                error: e.name || e.message
            };
        }
    };


    return await Promise.all(list.map(check))
}