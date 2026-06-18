// small canvases for NEXT and boxes

import { INK, PAPER } from "../config/theme.js";
import { drawBlock, roundRect } from "./blocks.js";

function prepare(canvas) {
  const ctx = canvas.getContext("2d");
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export function drawNextPiece(canvas, preview) {
  const { ctx, w, h } = prepare(canvas);
  if (!preview) return;
  const { shape } = preview;
  const cell = Math.floor(Math.min((w * 0.86) / Math.max(shape.w, 2), (h * 0.86) / Math.max(shape.h, 2)));
  const ox = (w - shape.w * cell) / 2;
  const oy = (h - shape.h * cell) / 2;
  shape.cells.forEach(([dx, dy], i) => {
    drawBlock(ctx, ox + dx * cell, oy + dy * cell, cell, {
      color: preview.color,
      char: preview.chars[i] ?? "",
    });
  });
}

// overflowed box
export function drawMiniBoard(canvas, board) {
  const { ctx, w, h } = prepare(canvas);
  const cell = Math.min(w / board.cols, h / board.rows);
  const ox = (w - board.cols * cell) / 2;
  const oy = (h - board.rows * cell) / 2;
  ctx.fillStyle = PAPER;
  roundRect(ctx, ox, oy, board.cols * cell, board.rows * cell, cell * 0.4);
  ctx.fill();
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const b = board.cells[y][x];
      if (!b) continue;
      ctx.fillStyle = b.color;
      roundRect(ctx, ox + x * cell + 0.5, oy + y * cell + 0.5, cell - 1, cell - 1, cell * 0.25);
      ctx.fill();
    }
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  roundRect(ctx, ox, oy, board.cols * cell, board.rows * cell, cell * 0.4);
  ctx.stroke();
}
