// game state and rules
// every sung word becomes a falling piece

import {
  BEAT_MAX_FALL_SPEED,
  BOARD_COLS,
  BOARD_ROWS,
  CLEAR_FLASH_MS,
  DEFAULT_FALL_SPEED,
  MAX_ARCHIVES,
  MAX_FALL_SPEED,
  MAX_FALL_TIME_MS,
  MAX_FALLING_PIECES,
  MIN_FALL_SPEED,
  MIN_FALL_TIME_MS,
  NICE_WINDOW_MS,
  OVERFLOW_FLASH_MS,
  POPUP_MS,
  SOFT_LANDING_ROWS,
} from "../config/game.js";
import { BLOCK_COLORS } from "../config/songs.js";
import { detHash01 } from "../utils/hash.js";
import { pickAutoColumn } from "./auto-solver.js";
import { Board } from "./board.js";
import { cleanLyric } from "./lyric-sync.js";
import { ScoreKeeper, referenceScore } from "./scoring.js";
import { bottomProfile, shapeForWord, topProfile } from "./shapes.js";

const EFFECT_TTL = Math.max(CLEAR_FLASH_MS, POPUP_MS, OVERFLOW_FLASH_MS);

// soft landing that stays on time
const SOFT_LANDING_MS = 160;

// fall distance left
function fallLeft(ms) {
  if (ms <= 0) return 0;
  const t = SOFT_LANDING_MS;
  if (ms >= t) return 0.65 * t + (ms - t);
  return 0.3 * ms + (0.35 * ms * ms) / t;
}

function wordSeed(word) {
  return ((word?.startTime ?? 0) | 0) * 1031 + ((word?.endTime ?? 0) | 0);
}

// how far p can fall before it hits q below
function followLimit(p, q) {
  let limit = Infinity;
  const from = Math.max(p.left, q.left);
  const to = Math.min(p.left + p.shape.w, q.left + q.shape.w);
  for (let c = from; c < to; c++) {
    const pb = p.bottom[c - p.left];
    const qt = q.top[c - q.left];
    if (pb < 0 || qt === Infinity) continue;
    limit = Math.min(limit, q.y + qt - pb - 1);
  }
  return limit;
}

export class Game {
  constructor({ cols = BOARD_COLS, rows = BOARD_ROWS } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.board = new Board(cols, rows);
    this.score = new ScoreKeeper();
    this.cursorCol = Math.floor(cols / 2);
    this.autoMode = false;
    this.reset();
  }

  reset() {
    this.board.clear();
    this.score.reset();
    this.pieces = [];
    this.archives = [];
    this.effects = [];
    this.boxNumber = 1;
    this.clock = 0;
    this.nextPieceId = 1;
    this.nextBlockId = 1;
    this.wordsPlayed = 0;
    this.cellsPlayed = 0;
  }

  // input

  setCursor(col) {
    this.cursorCol = Math.max(0, Math.min(this.cols - 1, Math.floor(col)));
  }

  moveCursor(delta) {
    this.setCursor(this.cursorCol + delta);
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
    return this.autoMode;
  }

  // pieces

  shapeFor(word, text) {
    return shapeForWord(text, wordSeed(word), this.cols, this.rows);
  }

  colorFor(word) {
    return BLOCK_COLORS[Math.floor(detHash01(wordSeed(word) + 7) * BLOCK_COLORS.length)];
  }

  // board with every falling piece landed
  projectedBoard() {
    if (!this.pieces.length) return this.board;
    const b = this.board.clone();
    for (const p of this.pieces) {
      b.place(p.shape, p.left, b.dropRow(p.shape, p.left, Math.floor(p.y)), () => true);
    }
    return b;
  }

  // piece column
  leftFor(shape, word, board = this.projectedBoard()) {
    if (this.autoMode) {
      const seed = Math.floor(word?.startTime ?? 0) + (word?.text || "").length * 17;
      return pickAutoColumn(board, shape, seed);
    }
    const left = this.cursorCol - Math.floor((shape.w - 1) / 2);
    return Math.max(0, Math.min(this.cols - shape.w, left));
  }

  // for the ghost and NEXT
  preview(word) {
    if (!word) return null;
    const text = cleanLyric(word.text);
    if (!text) return null;
    const shape = this.shapeFor(word, text);
    const board = this.projectedBoard();
    const left = this.leftFor(shape, word, board);
    return {
      shape,
      left,
      top: board.dropRow(shape, left),
      chars: Array.from(text).slice(0, shape.cells.length),
      color: this.colorFor(word),
    };
  }

  // landIn is the delay until the piece lands
  spawnWord(word, text, { landIn, beatMs } = {}) {
    // too many pieces in the air
    while (this.pieces.length >= MAX_FALLING_PIECES) {
      const oldest = this.pieces.shift();
      oldest.y = this.board.dropRow(oldest.shape, oldest.left, Math.floor(oldest.y));
      this._lock(oldest, { nice: false });
    }

    const shape = this.shapeFor(word, text);
    const left = this.leftFor(shape, word);
    const piece = {
      id: this.nextPieceId++,
      word,
      shape,
      left,
      chars: Array.from(text).slice(0, shape.cells.length),
      color: this.colorFor(word),
      top: topProfile(shape),
      bottom: bottomProfile(shape),
      y: -shape.h,
      speed: DEFAULT_FALL_SPEED,
      bornAt: this.clock,
      landAt: Number.isFinite(landIn) && landIn > 0 ? this.clock + landIn : null,
      beatMs: Number.isFinite(beatMs) && beatMs > 0 ? beatMs : 500,
    };

    // spawn above pieces still falling in the same columns
    for (const other of this.pieces) {
      piece.y = Math.min(piece.y, followLimit(piece, other));
    }

    // without beat data
    const next = word?.next;
    if (piece.landAt === null && next && next.startTime > word.startTime) {
      const gap = next.startTime - word.startTime;
      const distance = Math.max(1, this.board.dropRow(shape, left) - piece.y);
      const time = Math.max(MIN_FALL_TIME_MS, Math.min(MAX_FALL_TIME_MS, gap * 0.85));
      piece.speed = Math.max(MIN_FALL_SPEED, Math.min(MAX_FALL_SPEED, distance / time));
    }

    this.pieces.push(piece);
    this.wordsPlayed += 1;
    this.cellsPlayed += piece.chars.length;
    return piece;
  }

  hardDrop(beatDistance = Infinity) {
    const p = this.pieces[0];
    if (!p) return null;
    p.y = this.board.dropRow(p.shape, p.left, Math.floor(p.y));
    this.pieces.shift();
    const nice = !this.autoMode && beatDistance <= NICE_WINDOW_MS;
    return this._lock(p, { nice });
  }

  // falling pieces

  update(dt) {
    this.clock += dt;
    const falling = [];
    for (const p of this.pieces) {
      const landing = this.board.dropRow(p.shape, p.left, Math.floor(p.y));
      let limit = landing;
      for (const q of falling) limit = Math.min(limit, followLimit(p, q));

      const dist = landing - p.y;
      let v = p.speed;
      if (p.landAt !== null) {
        // late or too far
        const start = this.clock - dt;
        const held = limit < landing;
        while (p.landAt <= start || (!held && dist / fallLeft(p.landAt - start) > BEAT_MAX_FALL_SPEED * 1.01)) {
          p.landAt += p.beatMs / 2;
        }
        const before = fallLeft(p.landAt - start);
        const after = p.landAt - this.clock < dt / 2 ? 0 : fallLeft(p.landAt - this.clock);
        v = before > 0 ? (dist * (1 - after / before)) / dt : Infinity;
      } else if (dist > 0 && dist < SOFT_LANDING_ROWS) {
        v *= Math.max(0.3, dist / SOFT_LANDING_ROWS);
      }
      p.y = Math.min(p.y + v * dt, Math.max(p.y, limit));

      // in place but waiting for the beat
      const onTime = p.landAt === null || this.clock >= p.landAt - dt / 2;
      if (p.y >= landing && onTime) {
        p.y = landing;
        this._lock(p, { nice: false });
      } else {
        falling.push(p);
      }
    }
    this.pieces = falling;

    if (this.effects.length) {
      this.effects = this.effects.filter((e) => this.clock - e.at < EFFECT_TTL);
    }
  }

  _lock(p, { nice }) {
    const top = Math.round(p.y);
    const blocks = [];
    const overflow = this.board.place(p.shape, p.left, top, (i) => {
      const block = {
        id: this.nextBlockId++,
        pieceId: p.id,
        char: p.chars[i] ?? "",
        color: p.color,
        word: p.word,
        fall: 0,
        fallAt: 0,
        bornAt: this.clock,
      };
      blocks.push(block);
      return block;
    });
    p.blocks = blocks;

    const cx = p.left + p.shape.w / 2;
    const cy = top + p.shape.h / 2;

    if (overflow) {
      this._overflow();
      return { overflow: true, gained: 0 };
    }

    const rows = this.board.fullRows();
    if (rows.length) this._clearRows(rows);

    const gained = this.score.land({ rowsCleared: rows.length, nice, cells: p.chars.length });
    this._popup(cx, cy, `+${gained}`, "points");
    if (nice) this._popup(cx, cy - 1, "NICE!", "nice");
    if (rows.length) {
      const label = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS"][Math.min(rows.length, 4)];
      this._popup(this.cols / 2, rows[0] - 0.5, label, "lines");
      if (this.score.combo > 0) this._popup(this.cols / 2, rows[0] - 1.5, `COMBO ×${this.score.combo}`, "combo");
    }
    return { overflow: false, gained, rows: rows.length, nice };
  }

  _clearRows(rows) {
    // rows above move down by the rows cleared
    const shiftFor = (y) => rows.filter((r) => r > y).length;
    const moving = [];
    for (let y = 0; y < this.rows; y++) {
      if (rows.includes(y)) continue;
      const shift = shiftFor(y);
      if (shift > 0) for (const b of this.board.cells[y]) if (b) moving.push([b, shift]);
    }
    const removed = this.board.clearRows(rows);
    for (const [b, shift] of moving) {
      b.fall = shift;
      b.fallAt = this.clock;
    }
    this.effects.push({ type: "clear", at: this.clock, rows, removed });
  }

  _overflow() {
    this.archives.unshift({ box: this.boxNumber, board: this.board.clone() });
    if (this.archives.length > MAX_ARCHIVES) this.archives.length = MAX_ARCHIVES;
    this.score.overflow();
    this.effects.push({ type: "overflow", at: this.clock, penalty: true });
    this.boxNumber += 1;
    this.board.clear();
  }

  _popup(x, y, text, kind) {
    this.effects.push({ type: "popup", at: this.clock, x, y, text, kind });
  }

  // progress and rank

  reference() {
    return referenceScore(this.wordsPlayed, this.cellsPlayed);
  }

  rank() {
    if (this.wordsPlayed === 0) return "-";
    return this.score.rank(this.reference());
  }
}
