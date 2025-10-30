// -----------------------------------------------------------
// BACKGROUND RENDER
// -----------------------------------------------------------

export const drawBackground = async (ctx, canvas, background = 'checker', transform = null) => {
    try {
        const bgColor = background ?? "transparent";
        let size = 10;
        let w = transform?.w ?? canvas.width | 0;
        let h = transform?.h ?? canvas.height | 0;
        let x = transform?.x ?? 0;
        let y = transform?.y ?? 0;

        if (bgColor !== "transparent" && bgColor !== "checker" && bgColor !== "grid") {
            ctx.save();
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, y, w, h);
            ctx.restore();
        }

        else if (bgColor === "checker") {
            ctx.save();
            for (y = 0; y < h; y += size) {
                for (let x = 0; x < w; x += size) {
                    ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? "#eee" : "#ccc";
                    ctx.fillRect(x, y, size, size);
                }
            }
            ctx.restore();
        }

        else if (bgColor === "grid") {
            ctx.save();
            ctx.fillStyle = "rgba(200,200,200,0.2)";
            for (y = 0; y < h; y += size) {
                for (x = 0; x < w; x += size) {
                    if ((x / size + y / size) % 2 === 0) ctx.fillRect(x, y, size, size);
                }
            }
            ctx.restore();
        }
    } catch (e) {
        console.warn('Fehler beim setzen des Hintergrunds;', e)
    }
};