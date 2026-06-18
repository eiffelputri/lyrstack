// draws the playfield

import {
  CLEAR_FLASH_MS,
  OVERFLOW_FLASH_MS,
  PIECE_FADE_IN_MS,
  POPUP_MS,
  ROW_SHIFT_MS,
  SPAWN_GUTTER_ROWS,
} from "../config/game.js";
import { ALERT, FONT_POP, INK, PAPER } from "../config/theme.js";
import { drawBlock, drawGhostCell, roundRect } from "./blocks.js";
import { drawEmote } from "./emote-icons.js";

const easeOut = (t) => 1 - (1 - t) * (1 - t);

export class FieldRenderer {
  constructor(canvas, { cols, rows }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cols = cols;
    this.rows = rows;
    this.flavor = { color: "#8FD3EE", deep: "#2F7FA8" };
    this.cell = 40;
    this.pad = 10;
  }

  setFlavor(flavor) {
    if (flavor) this.flavor = flavor;
  }

  // fit the board to the screen
  resize(maxW, maxH) {
    const unitsW = this.cols + 0.5;
    const unitsH = this.rows + SPAWN_GUTTER_ROWS + 0.5;
    const cell = Math.max(14, Math.floor(Math.min(maxW / unitsW, maxH / unitsH)));
    this.cell = cell;
    this.pad = cell * 0.25;
    const w = Math.round(cell * unitsW);
    const h = Math.round(cell * unitsH);
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  // board top-left corner
  get originX() {
    return this.pad;
  }
  get originY() {
    return this.pad + SPAWN_GUTTER_ROWS * this.cell;
  }

  // mouse position to column
  columnAt(x) {
    return Math.floor((x - this.originX) / this.cell);
  }

  cellX(col) {
    return this.originX + col * this.cell;
  }
  cellY(row) {
    return this.originY + row * this.cell;
  }

  draw({ game, preview, currentWord, emote, beat = 0, showCursor = true }) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    // beat flash
    const pulse = beat * beat;
    this._drawFrame(beat, pulse);
    if (showCursor && preview) this._drawCursor(preview);
    this._drawBoard(game, currentWord);
    this._drawFalling(game, currentWord);
    // arrow drawn last so nothing covers it
    if (showCursor && preview) this._drawArrow(preview, game, pulse);
    this._drawEffects(game);
    if (emote && preview) this._drawEmote(emote, preview);
  }

  _drawFrame(beat, pulse = 0) {
    const { ctx, cell, cols, rows } = this;
    const x = this.originX;
    const y = this.originY;
    const w = cols * cell;
    const h = rows * cell;

    // board paper
    ctx.fillStyle = PAPER;
    roundRect(ctx, x, y, w, h, cell * 0.2);
    ctx.fill();

    // polka dots in the flavour colour
    ctx.fillStyle = this.flavor.color;
    ctx.globalAlpha = 0.55 + beat * 0.35;
    const r = Math.max(1.2, cell * 0.05);
    for (let cy = 1; cy < rows; cy++) {
      for (let cx = 1; cx < cols; cx++) {
        ctx.beginPath();
        ctx.arc(x + cx * cell, y + cy * cell, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // dashed spawn line
    ctx.save();
    ctx.strokeStyle = this.flavor.deep;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.setLineDash([cell * 0.18, cell * 0.14]);
    ctx.beginPath();
    ctx.moveTo(x, y - 0.5);
    ctx.lineTo(x + w, y - 0.5);
    ctx.stroke();
    ctx.restore();

    // frame flash on each beat
    if (pulse > 0.02) {
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = this.flavor.deep;
      ctx.lineWidth = Math.max(2, cell * 0.08) + pulse * cell * 0.14;
      roundRect(ctx, x, y, w, h, cell * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.strokeStyle = INK;
    roundRect(ctx, x, y, w, h, cell * 0.2);
    ctx.stroke();
  }

  _drawCursor(preview) {
    const { ctx, cell } = this;
    const left = this.cellX(preview.left);
    const width = preview.shape.w * cell;

    // red when the next piece would overflow
    const overflows = preview.top < 0;

    // column band to the landing spot
    const landTop = this.cellY(Math.max(0, preview.top));
    ctx.fillStyle = overflows ? ALERT : this.flavor.color;
    ctx.globalAlpha = overflows ? 0.12 : 0.22;
    ctx.fillRect(left, this.originY, width, Math.max(0, landTop - this.originY));
    ctx.globalAlpha = 1;

    // landing ghost
    preview.shape.cells.forEach(([dx, dy], i) => {
      const row = preview.top + dy;
      if (row < 0) return;
      drawGhostCell(ctx, this.cellX(preview.left + dx), this.cellY(row), cell, {
        color: overflows ? ALERT : preview.color,
        char: preview.chars[i] ?? "",
        line: overflows ? ALERT : INK,
      });
    });
  }

  _drawArrow(preview, game, pulse = 0) {
    const { ctx, cell } = this;
    const overflows = preview.top < 0;
    const ax = this.cellX(preview.left) + (preview.shape.w * cell) / 2;
    // arrow hops on each beat
    const ay = this.originY - cell * 0.28 - pulse * cell * 0.12;
    const s = cell * 0.28 * (1 + pulse * 0.35);
    ctx.fillStyle = overflows ? ALERT : game.autoMode ? this.flavor.deep : INK;
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = Math.max(1.5, cell * 0.06);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ax - s, ay - s * 0.9);
    ctx.lineTo(ax + s, ay - s * 0.9);
    ctx.lineTo(ax, ay + s * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  _drawBoard(game, currentWord) {
    const { cell } = this;
    const { cells } = game.board;
    for (let y = 0; y < cells.length; y++) {
      for (let x = 0; x < cells[y].length; x++) {
        const b = cells[y][x];
        if (!b) continue;
        let offset = 0;
        if (b.fall) {
          const t = Math.min(1, (game.clock - b.fallAt) / ROW_SHIFT_MS);
          offset = -b.fall * (1 - easeOut(t));
        }
        const pop = Math.min(1, (game.clock - b.bornAt) / 140);
        drawBlock(this.ctx, this.cellX(x), this.cellY(y + offset), cell, {
          color: b.color,
          char: b.char,
          active: b.word && b.word === currentWord,
          scale: 0.9 + 0.1 * easeOut(pop),
        });
      }
    }
  }

  _drawFalling(game, currentWord) {
    const { ctx, cell } = this;
    // keep pieces inside the canvas
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();
    for (const p of game.pieces) {
      const alpha = Math.min(1, (game.clock - p.bornAt) / PIECE_FADE_IN_MS);
      p.shape.cells.forEach(([dx, dy], i) => {
        drawBlock(ctx, this.cellX(p.left + dx), this.cellY(p.y + dy), cell, {
          color: p.color,
          char: p.chars[i] ?? "",
          alpha,
          active: p.word === currentWord,
        });
      });
    }
    ctx.restore();
  }

  _drawEffects(game) {
    const { ctx, cell } = this;
    for (const e of game.effects) {
      const age = game.clock - e.at;

      if (e.type === "clear" && age < CLEAR_FLASH_MS) {
        const t = age / CLEAR_FLASH_MS;
        for (const { block, x, y } of e.removed) {
          if (!block) continue;
          drawBlock(ctx, this.cellX(x), this.cellY(y), cell, {
            color: "#FFFFFF",
            char: block.char,
            alpha: 1 - t,
            scale: 1 + 0.35 * t,
          });
        }
      }

      if (e.type === "overflow" && age < OVERFLOW_FLASH_MS) {
        const t = age / OVERFLOW_FLASH_MS;
        const x = this.originX;
        const y = this.originY;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.35;
        ctx.fillStyle = ALERT;
        roundRect(ctx, x, y, this.cols * cell, this.rows * cell, cell * 0.2);
        ctx.fill();
        ctx.globalAlpha = 1 - t;
        this._label("あふれた！", x + (this.cols * cell) / 2, y + this.rows * cell * 0.45, cell * 0.9, ALERT);
        this._label("OVERFLOW  −500", x + (this.cols * cell) / 2, y + this.rows * cell * 0.45 + cell, cell * 0.42, INK);
        ctx.restore();
      }

      if (e.type === "popup" && age < POPUP_MS) {
        const t = age / POPUP_MS;
        const px = this.originX + e.x * cell;
        const py = this.cellY(e.y) - easeOut(t) * cell * 0.9;
        const size = e.kind === "points" ? cell * 0.42 : cell * 0.55;
        const color = e.kind === "nice" ? ALERT : e.kind === "points" ? INK : this.flavor.deep;
        ctx.save();
        ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        this._label(e.text, px, py, size, color);
        ctx.restore();
      }
    }
  }

  // popup text with a cream outline
  _label(text, x, y, size, color) {
    const { ctx } = this;
    ctx.font = `${Math.round(size)}px ${FONT_POP}`;
    // keep popups inside the canvas
    const half = ctx.measureText(text).width / 2 + size * 0.2;
    x = Math.max(half, Math.min(this.width - half, x));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.28);
    ctx.strokeStyle = PAPER;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  _drawEmote(name, preview) {
    const { ctx, cell } = this;
    const x = this.cellX(preview.left + preview.shape.w) + cell * 0.35;
    const y = this.originY - cell * 0.6;
    if (x > this.width - cell * 0.3) return;
    ctx.save();
    ctx.translate(x, y);
    drawEmote(ctx, name, cell * 0.5, this.flavor.deep);
    ctx.restore();
  }
}
