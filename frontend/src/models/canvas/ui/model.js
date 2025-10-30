// draw small handles for transform (scale/rotate) at corners
export const drawCornerHandles = (ctx, corners, handleSize = 8) => {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(30,144,255,0.95)";
    ctx.lineWidth = 1;
    for (const c of corners) {
        ctx.beginPath();
        ctx.rect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
};