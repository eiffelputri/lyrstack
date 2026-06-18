// draws one cell

import { FONT_BODY, INK } from "../config/theme.js";

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// cell position and size
export function drawBlock(ctx, x, y, size, { color, char = "", alpha = 1, active = false, scale = 1 }) {
  const inset = Math.max(1, size * 0.06);
  const s = (size - inset * 2) * scale;
  const bx = x + size / 2 - s / 2;
  const by = y + size / 2 - s / 2;
  const radius = s * 0.22;
  const line = Math.max(1.5, size * 0.055);

  ctx.save();
  ctx.globalAlpha = alpha;

  // retro shadow
  ctx.fillStyle = INK;
  roundRect(ctx, bx + line * 0.9, by + line * 0.9, s, s, radius);
  ctx.fill();

  ctx.fillStyle = color;
  roundRect(ctx, bx, by, s, s, radius);
  ctx.fill();

  // shine
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  roundRect(ctx, bx + s * 0.14, by + s * 0.1, s * 0.46, s * 0.12, s * 0.06);
  ctx.fill();

  ctx.lineWidth = active ? line * 1.6 : line;
  ctx.strokeStyle = INK;
  roundRect(ctx, bx, by, s, s, radius);
  ctx.stroke();

  if (char) {
    const len = Array.from(char).length;
    const fontPx = (s * (len > 1 ? 0.5 / Math.min(len, 3) * 1.6 : 0.56)) | 0;
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.max(8, fontPx)}px ${FONT_BODY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, bx + s / 2, by + s / 2 + s * 0.04);
  }
  ctx.restore();
}

// landing ghost
// line is the outline colour
export function drawGhostCell(ctx, x, y, size, { color, char = "", line = INK }) {
  const inset = Math.max(1, size * 0.08);
  const s = size - inset * 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28;
  roundRect(ctx, x + inset, y + inset, s, s, s * 0.22);
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.setLineDash([size * 0.12, size * 0.1]);
  ctx.lineWidth = Math.max(1.2, size * 0.045);
  ctx.strokeStyle = line;
  ctx.stroke();
  if (char) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.max(8, (s * 0.5) | 0)}px ${FONT_BODY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, x + size / 2, y + size / 2 + s * 0.04);
  }
  ctx.restore();
}
