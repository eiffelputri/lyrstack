import { pickEmote } from "./emotes.js";

const SCAN_SWEEP_PERIOD_MS = 10000;
const NUM_BG_SHAPES = 12;

// quick accel then steady — feels like a "set" fall rather than free-fall
const GRAVITY = 0.012;
const TERMINAL_FALL_SPEED = 1.0; // px/ms — ~800ms full height
const SPAWN_VY_BOOST = 0;
const VERTICAL_PROB = 0.32;
// glow on contact cells when a piece lands on top of another
const LANDING_FLASH_MS = 420;

const ACTIVE_SIZE = 64;
const PAST_SIZE = 38;
// short words ≤ this stay on one row/col, no wrap
const SHORT_WORD_LIMIT = 5;
// longer words wrap to 2-char rows ("an/ti/do/te")
const MAX_HORIZONTAL_CHARS = 2;
const MAX_VERTICAL_CHARS = 4;
const VERTICAL_LINE_H_FACTOR = 1.05;
const BRACKET_GAP_PX = 6;
const BRACKET_ALPHA = 0.55;

// narrow vertical playfield centered on screen
const CELL_W = 56;
const CELL_H = 50;
const PLAYFIELD_COLS = 8;
const FIELD_TOP_MARGIN = 90;
const FIELD_BOTTOM_MARGIN = 90;
const SPAWN_ABOVE_FIELD_PX = 28;

const REPEAT_WINDOW_MS = 850; // same word within this → extras
const REPEAT_EXTRAS = 2;

// pure punctuation appends to previous piece instead of spawning
const PUNCT_RE = /^[\s.,!?;:、。！？…〜〽'"‘’“”()[\]（）「」『』]+$/u;

// cleared pieces linger for fade-out
const CLEAR_FADE_MS = 320;

// archived playfields (left-side playlist of past overflows)
const MAX_ARCHIVES = 3;
const ARCHIVE_SCALES = [0.55, 0.42, 0.32];
const ARCHIVE_GAP = 16;

// red border flash on active field after archive
const OVERFLOW_BORDER_FLASH_MS = 700;

const MAX_STACKED = 60;
const STACK_FADE_START_AGE = 22000;
const STACK_MAX_AGE = 48000;

const PILE_GAP_PX = 4;
// no jitter — spawn col follows cursor exactly
const SPAWN_X_JITTER = 0;
const SPAWN_PILE_MARGIN = 26;

// overflow penalty
const PENALTY_BASE = 2000;
const PENALTY_COMBO_MULT = 100;
const GAMEOVER_FLASH_MS = 1500;

// scoring
const COMBO_WINDOW_MS = 1800;
const BASE_POINTS = 100;

// rank thresholds keyed on max combo (HSR-ish grades).
// skill = "how long can you keep the field clean" rather than raw score.
const RANK_THRESHOLDS = [
  { min: 0,   grade: "D" },
  { min: 10,  grade: "C" },
  { min: 25,  grade: "B" },
  { min: 50,  grade: "A" },
  { min: 80,  grade: "S" },
  { min: 120, grade: "SS" },
  { min: 180, grade: "SSS" },
];

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    this.palette = {
      hue: 180,
      accent: "#39C5BB",
      highlight: "#FFA940",
    };

    this.lastBeat = null;
    this.beatPulse = 0;
    this.lastChordId = null;
    this.hasStarted = false;

    this.lastTickMs = 0;
    this.position = 0;
    this.player = null;
    this.video = null;
    this.isPaused = false;
    // auto mode = solver picks the column
    this.autoMode = false;

    this._currentWord = null;
    // last non-null word — peek uses this during instrumental gaps
    this._lastRealWord = null;
    this._currentEmote = null;
    this._currentEmoteAppearedAt = 0;

    this.landingFlashes = [];

    this.mouseX = null;
    this.mouseY = null;
    // target column for next spawn — mouse + keyboard both write here.
    // start centred so the first piece doesn't pin to an edge.
    this.cursorCol = Math.floor(PLAYFIELD_COLS / 2);
    this._keyboardCursorActive = false;
    this.showHelp = false;

    // personal best, persisted per song. reset() never touches it.
    this._songId = null;
    this.bestRunner = this._defaultBestRunner();

    this.fallingWords = [];
    this.stackedWords = [];
    this.clearingWords = []; // mid-fade after a line clear
    this.archivedFields = []; // overflowed piles preserved on the left
    this.boxNumber = 1;
    this.numCols = PLAYFIELD_COLS;
    this.cellW = CELL_W;
    // field bounds set in _onResize
    this.fieldX = 0;
    this.fieldWidth = 0;
    this.fieldBottomY = 0;
    // pileGrid[col][row] = filled. row 0 = bottom.
    this.pileGrid = [];

    // previous word for "na na na" repeat detector
    this._prevWordText = null;
    this._prevWordEndAt = -Infinity;


    // camera locked at 0 — true tetris field
    this.cameraY = 0;

    // set in _onResize
    this.maxPileRows = 14;
    this.fieldTopY = 0;

    // game-over flash
    this._gameOverFlashAt = -Infinity;
    this._lastPenalty = 0;
    this._scoreNegativeFlashAt = -Infinity;

    // line-clear flash
    this._lineClearFlashAt = -Infinity;
    this._lineClearLines = 0;
    this._lineClearBonus = 0;

    this.score = 0;
    this.displayScore = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.wordCount = 0;
    this.scorePulse = 0;
    this.lastLandAt = -Infinity;

    this.bgShapes = [];
    this.scanSweepStartMs = 0;

    this._onResize = this._onResize.bind(this);
    this._frame = this._frame.bind(this);
    window.addEventListener("resize", this._onResize);
    this._onResize();
    this._initBgEntities();
    this.scanSweepStartMs = performance.now();
  }

  start() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(this._frame);
  }
  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  setPalette(palette) {
    if (palette) this.palette = { ...this.palette, ...palette };
  }

  bindVideo(video) {
    this.video = video;
    this.reset();
  }

  markStarted() {
    this.hasStarted = true;
    this._sessionFinalized = false;
    if (this._playStartedAtPos < 0) this._playStartedAtPos = this.position;
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
    return this.autoMode;
  }

  toggleHelp() {
    this.showHelp = !this.showHelp;
    return this.showHelp;
  }

  setSongId(id) {
    this._songId = id;
    this.bestRunner = this._loadBestRunner();
  }

  _defaultBestRunner() {
    return {
      highScore: 0,
      peakCombo: 0,
      topRank: "D",
      runsLogged: 0,
      linesClr: 0,
      chainsHit: 0,
      syncLog: [],
    };
  }

  _storageKey() {
    return `mm2026.br.${this._songId || "default"}`;
  }

  _loadBestRunner() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return this._defaultBestRunner();
      return { ...this._defaultBestRunner(), ...JSON.parse(raw) };
    } catch (e) {
      return this._defaultBestRunner();
    }
  }

  _saveBestRunner() {
    try {
      localStorage.setItem(
        this._storageKey(),
        JSON.stringify(this.bestRunner)
      );
    } catch (e) {
      // quota / disabled — ignore
    }
  }

  // logs final score when a song ends — last 3 plays kept.
  // idempotent: multiple triggers (onStop + position-based) only log once
  finalizeSession() {
    if (this._sessionFinalized) return;
    if (this.wordCount === 0) return;
    this._sessionFinalized = true;
    this.bestRunner.syncLog.unshift({
      date: new Date().toISOString(),
      score: Math.round(this.score),
    });
    this.bestRunner.syncLog = this.bestRunner.syncLog.slice(0, 3);
    this._saveBestRunner();
  }

  tick(positionMs, player) {
    this.position = positionMs;
    this.player = player;
    // re-query each tick — TextAlive can swap the <audio> on seek
    this._audioEl = document.querySelector("#media audio");
  }


  reset() {
    this.lastBeat = null;
    this.beatPulse = 0;
    this.lastChordId = null;
    this._lastDetectPos = undefined;
    this._currentWord = null;
    this._lastRealWord = null;
    this._currentEmote = null;
    this.landingFlashes.length = 0;
    this.fallingWords.length = 0;
    this.stackedWords.length = 0;
    this.clearingWords.length = 0;
    this.archivedFields.length = 0;
    this.boxNumber = 1;
    this._resetPileGrid();
    this._prevWordText = null;
    this._prevWordEndAt = -Infinity;
    this.cameraY = 0;
    this._sessionFinalized = false;
    this.score = 0;
    this.displayScore = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.wordCount = 0;
    this.scorePulse = 0;
    this.lastLandAt = -Infinity;
  }

  hitTestWord() {
    return null;
  }

  setMousePosition(x, y) {
    this.mouseX = x;
    this.mouseY = y;
    // mouse takes over — cursor follows pointer until next keypress
    this._keyboardCursorActive = false;
    const col = Math.floor((x - this.fieldX) / this.cellW);
    this.cursorCol = Math.max(0, Math.min(this.numCols - 1, col));
  }

  setCursorCol(col) {
    this.cursorCol = Math.max(0, Math.min(this.numCols - 1, col));
    this._keyboardCursorActive = true;
  }

  setPaused(paused) {
    this.isPaused = !!paused;
  }

  clearMousePosition() {
    this._cursorVisible = false;
  }

  _resetPileGrid() {
    this.pileGrid = [];
    for (let c = 0; c < this.numCols; c++) {
      this.pileGrid.push(new Array(this.maxPileRows).fill(false));
    }
  }

  _columnFor(x) {
    const col = Math.floor((x - this.fieldX) / this.cellW);
    return Math.max(0, Math.min(this.numCols - 1, col));
  }

  // highest filled row + 1 (= next free row from bottom)
  _pileTopRow(col) {
    if (!this.pileGrid[col]) return 0;
    for (let r = this.maxPileRows - 1; r >= 0; r--) {
      if (this.pileGrid[col][r]) return r + 1;
    }
    return 0;
  }

  _pileTopWorldY(col) {
    return this.fieldBottomY - this._pileTopRow(col) * CELL_H;
  }

  _pileTopMinWorldY() {
    let min = this.fieldBottomY;
    for (let i = 0; i < this.numCols; i++) {
      const y = this._pileTopWorldY(i);
      if (y < min) min = y;
    }
    return min;
  }

  // pileGrid only tracks actual word cells. backfill is draw-only so
  // empty columns still drop to the floor.
  _setWordCells(word, filled) {
    const startCol = word.colIdxLeft;
    const endCol = startCol + word.cellsW - 1;
    const botY = word.y + (word.cellsH * CELL_H) / 2;
    const botRow = Math.round((this.fieldBottomY - botY) / CELL_H);
    const topRow = botRow + word.cellsH - 1;
    for (let c = startCol; c <= endCol; c++) {
      if (c < 0 || c >= this.numCols) continue;
      for (let r = botRow; r <= topRow; r++) {
        if (r >= 0 && r < this.maxPileRows) this.pileGrid[c][r] = filled;
      }
    }
  }

  _rebuildPileGrid() {
    this._resetPileGrid();
    for (const s of this.stackedWords) this._setWordCells(s, true);
  }

  _initBgEntities() {
    this.bgShapes.length = 0;
    for (let i = 0; i < NUM_BG_SHAPES; i++) {
      this.bgShapes.push(this._makeBgShape(i));
    }
  }

  _makeBgShape(seed) {
    const types = ["hex", "triangle", "ring"];
    return {
      type: types[seed % types.length],
      x: ((seed * 211) % this.width) || Math.random() * this.width,
      y: ((seed * 113) % this.height) || Math.random() * this.height,
      size: 36 + ((seed * 17) % 80),
      angle: ((seed * 41) % 360) * (Math.PI / 180),
      angleVel: (((seed * 7) % 100) - 50) / 80000,
      vy: -(0.004 + ((seed * 17) % 40) / 30000),
      opacityBase: 0.05 + ((seed * 19) % 70) / 1200,
    };
  }

  _frame(tMs) {
    const dt = Math.min(64, tMs - (this.lastTickMs || tMs));
    this.lastTickMs = tMs;

    this.beatPulse = Math.max(0, this.beatPulse - dt / 280);

    if (
      this.player &&
      this.player.video &&
      !this.isPaused &&
      this.hasStarted
    ) {
      this._detectBeat();
      this._detectChord();
      this._detectWordChange();
    }

    this._updateBgEntities(dt);
    if (!this.isPaused) {
      this._updateFallingWords(dt);
      this._updateStackedShifts(dt);
    }
    this._updateCamera(dt);
    this._updateScoreTick(dt);

    this._drawBackground();
    this._drawBgEntities();
    this._drawCellField();
    this._drawScanSweep(tMs);
    this._drawHudTitleBlock();
    this._drawScorePanel();
    this._drawBestRunnerPanel();
    this._drawCornerBrackets();
    this._drawArchivedFields();
    this._drawPileBackfill();
    this._drawLandingFlashes();
    this._drawStackedWords();
    this._drawClearingWords();
    this._drawFallingWords();
    this._drawCursorIndicator();
    this._drawLineClearFlash();
    this._drawGameOverFlash();
    if (this.showHelp) this._drawHelpOverlay();

    this._raf = requestAnimationFrame(this._frame);
  }

  _detectBeat() {
    const beat = this.player.findBeat?.(this.position);
    if (beat && beat !== this.lastBeat) {
      this.lastBeat = beat;
      const strength = beat.position === 1 ? 1.0 : 0.55;
      this.beatPulse = Math.max(this.beatPulse, strength);
    }
  }

  _detectChord() {
    const chord = this.player.findChord?.(this.position);
    if (chord && chord !== this.lastChordId) this.lastChordId = chord;
  }

  _detectWordChange() {
    // position leap > 500ms = seek or decoder catch-up, skip the tick
    const lastPos = this._lastDetectPos;
    this._lastDetectPos = this.position;
    if (lastPos !== undefined && Math.abs(this.position - lastPos) > 500) {
      return;
    }

    // audio-truth gate:
    //   1. paused → skip (covers pause, seek transitions, decoder stalls)
    //   2. timer way ahead of audio.currentTime → skip (cold-start race)
    const audio = this._audioEl;
    if (audio) {
      if (audio.paused) return;
      const audioMs = audio.currentTime * 1000;
      if (this.position - audioMs > 500) return;
    }

    const w = this.video.findWord?.(this.position);
    // honour startTime exactly — no grace on the hot path
    const live = w && this.position >= w.startTime ? w : null;
    if (live === this._currentWord) return;

    // tight chorus: a slow tick can skip words between _currentWord and live.
    // walk the linked list to catch them — only on continuous playback
    // (both ends non-null) so seeks don't retro-spawn old lyrics.
    if (this._currentWord && live && live !== this._currentWord.next) {
      let cursor = this._currentWord.next;
      let safety = 16;
      while (cursor && cursor !== live && safety-- > 0) {
        this._processLiveWord(cursor);
        cursor = cursor.next;
      }
    }

    this._currentWord = live;
    if (live) {
      this._lastRealWord = live;
      this._processLiveWord(live);
    } else {
      this._currentEmote = null;
      this._currentEmoteAppearedAt = this.position;
    }
  }

  _processLiveWord(w) {
    this._currentEmote = pickEmote(w.text || "", w.pron || "");
    this._currentEmoteAppearedAt = this.position;
    // drop parens. keep 「」『』 — they matter in JP lyrics.
    const text = (w.text || "").trim().replace(/[()（）]/g, "");
    if (!text) return;
    if (PUNCT_RE.test(text)) {
      this._appendToLastWord(text);
    } else {
      this._spawnFallingWord(w, null, text);
    }
  }

  // append punctuation to the most-recent piece.
  // for falling pieces, also extend the cell box (else "Aha"+"!" overlaps last "a").
  _appendToLastWord(punct) {
    let target = this.fallingWords[this.fallingWords.length - 1];
    const isFalling = !!target;
    if (!target) target = this.stackedWords[this.stackedWords.length - 1];
    if (!target) return;

    target.text += punct;
    target.chars = Array.from(target.text);

    if (!isFalling) return;

    // recompute cells using the same rule as spawn
    let newW, newH;
    if (target.isVertical) {
      newW = 1;
      newH = target.chars.length;
    } else if (target.chars.length <= SHORT_WORD_LIMIT) {
      newW = target.chars.length;
      newH = 1;
    } else {
      newW = MAX_HORIZONTAL_CHARS;
      newH = Math.ceil(target.chars.length / newW);
    }
    if (newH > this.maxPileRows) {
      newW = Math.ceil(target.chars.length / this.maxPileRows);
      newH = Math.ceil(target.chars.length / newW);
    }
    newW = Math.min(newW, this.numCols);
    newH = Math.min(newH, this.maxPileRows);

    const extraW = newW - target.cellsW;
    const extraH = newH - target.cellsH;
    if (extraW > 0) {
      target.cellsW = newW;
      target.x += (extraW * this.cellW) / 2;
      const maxColLeft = this.numCols - newW;
      if (target.colIdxLeft > maxColLeft) {
        const shift = target.colIdxLeft - maxColLeft;
        target.colIdxLeft = maxColLeft;
        target.x -= shift * this.cellW;
      }
    }
    if (extraH > 0) {
      target.cellsH = newH;
      target.y -= (extraH * CELL_H) / 2;
    }
  }

  // overrideX = repeat-extras (legacy). overrideText = prepended punct.
  _spawnFallingWord(word, overrideX = null, overrideText = null) {
    const text = overrideText !== null ? overrideText : (word.text || "");
    if (!text.trim()) return;

    // deterministic from word timing so preview matches the actual spawn
    const isVertical = this._decideVertical(word, text);

    // never truncate. wrap long words into a rectangle.
    const chars = Array.from(text);
    const ctx = this.ctx;
    ctx.font = `500 ${PAST_SIZE}px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", ui-sans-serif, system-ui, sans-serif`;

    let cellsW, cellsH;
    if (isVertical) {
      cellsW = 1;
      cellsH = Math.max(1, chars.length);
    } else if (chars.length <= SHORT_WORD_LIMIT) {
      cellsW = Math.max(1, chars.length);
      cellsH = 1;
    } else {
      // wrap to 2 chars/row
      cellsW = MAX_HORIZONTAL_CHARS;
      cellsH = Math.ceil(chars.length / cellsW);
    }
    // too tall for the field → widen to fit all chars
    if (cellsH > this.maxPileRows) {
      cellsW = Math.ceil(chars.length / this.maxPileRows);
      cellsH = Math.ceil(chars.length / cellsW);
    }
    cellsW = Math.min(cellsW, this.numCols);
    cellsH = Math.min(cellsH, this.maxPileRows);

    // landing column. auto runs the same solver as the preview;
    // manual reads cursorCol. overrideX kept for legacy repeat-extras.
    const maxColLeft = Math.max(0, this.numCols - cellsW);
    let colIdxLeft;
    if (this.autoMode && overrideX === null) {
      colIdxLeft = this._autoPickColumn(cellsW, cellsH, word);
    } else if (overrideX !== null) {
      const cursorCol = Math.max(
        0,
        Math.min(
          this.numCols - 1,
          Math.floor((overrideX - this.fieldX) / this.cellW)
        )
      );
      colIdxLeft = cursorCol - Math.floor((cellsW - 1) / 2);
    } else {
      colIdxLeft = this.cursorCol - Math.floor((cellsW - 1) / 2);
    }
    if (colIdxLeft < 0) colIdxLeft = 0;
    if (colIdxLeft > maxColLeft) colIdxLeft = maxColLeft;
    const sx = this.fieldX + (colIdxLeft + cellsW / 2) * this.cellW;

    // spawn Y must be above the pile top across the covered cols, or the
    // piece collides on frame 1 and snaps upward.
    const halfH = (cellsH * CELL_H) / 2;
    let maxPileTopY = this.fieldBottomY;
    for (let c = colIdxLeft; c < colIdxLeft + cellsW; c++) {
      const top = this._pileTopWorldY(c);
      if (top < maxPileTopY) maxPileTopY = top;
    }
    const idealAboveField = this.fieldTopY - SPAWN_ABOVE_FIELD_PX - halfH;
    const aboveSafePile = maxPileTopY - halfH - 6;
    // pick the lower Y, but above the pile. tall piles → spawn off-canvas, fine.
    let sy = idealAboveField;
    if (sy > aboveSafePile) sy = aboveSafePile;

    // stagger Y against any falling piece in our column footprint.
    // fix for same-tick-collision: two pieces spawned same tick share Y,
    // land same iteration, second one snaps up by CELL_H.
    for (const other of this.fallingWords) {
      const overlapStart = Math.max(colIdxLeft, other.colIdxLeft);
      const overlapEnd = Math.min(
        colIdxLeft + cellsW,
        other.colIdxLeft + other.cellsW
      );
      if (overlapStart >= overlapEnd) continue;
      const otherTopY = other.y - (other.cellsH * CELL_H) / 2;
      const safeY = otherTopY - halfH - 10;
      if (safeY < sy) sy = safeY;
    }

    // adaptive fall speed — each piece should land before the next word
    // fires. capped low enough that chorus pieces stay legible.
    let targetVy = TERMINAL_FALL_SPEED;
    if (word.next && word.next.startTime > word.startTime) {
      const gap = word.next.startTime - word.startTime;
      const fallDistance = Math.max(120, this.fieldBottomY - sy);
      const desiredTime = Math.max(250, Math.min(1500, gap * 0.85));
      const computed = fallDistance / desiredTime;
      targetVy = Math.max(0.25, Math.min(2.5, computed));
    }

    this.fallingWords.push({
      word,
      text,
      chars,
      x: sx,
      y: sy,
      vx: 0,
      // constant-speed fall reads smoother than ease-in
      vy: targetVy,
      rot: 0,
      rotVel: 0,
      isVertical,
      cellsW,
      cellsH,
      colIdxLeft,
      targetVy,
      spawnedAt: this.position,
    });
  }

  _updateFallingWords(dt) {
    const remaining = [];

    for (const f of this.fallingWords) {
      const startCol = f.colIdxLeft;
      const endCol = f.colIdxLeft + f.cellsW - 1;

      let landingRow = 0;
      for (let c = startCol; c <= endCol; c++) {
        const top = this._pileTopRow(c);
        if (top > landingRow) landingRow = top;
      }
      const topY = this.fieldBottomY - landingRow * CELL_H;
      const halfH = (f.cellsH * CELL_H) / 2;

      // soft landing — ease vy over the last 90px so it settles
      const distanceToLand = topY - (f.y + halfH);
      let velocity = f.targetVy || TERMINAL_FALL_SPEED;
      if (distanceToLand > 0 && distanceToLand < 90) {
        const factor = Math.max(0.3, distanceToLand / 90);
        velocity *= factor;
      }
      f.vy = velocity;
      f.y += f.vy * dt;

      if (f.y + halfH >= topY) {
        f.y = topY - halfH;
        f.vy = 0;
        f.landedAt = this.position;
        this._setWordCells(f, true);
        this.stackedWords.push(f);

        // glow only on contact cells when stacking on a piece, not the floor
        if (landingRow > 0) {
          for (let c = f.colIdxLeft; c < f.colIdxLeft + f.cellsW; c++) {
            this.landingFlashes.push({
              col: c,
              row: landingRow,
              startedAt: this.position,
            });
          }
        }

        if (landingRow + f.cellsH > this.maxPileRows) {
          f.isOverflow = true;
          this._triggerOverflow();
        } else {
          this._scoreWord();
          this._checkLineClear();
        }
      } else {
        remaining.push(f);
      }
    }
    this.fallingWords = remaining;

    if (this.clearingWords.length) {
      this.clearingWords = this.clearingWords.filter(
        (c) => this.position - c.clearedAt < CLEAR_FADE_MS
      );
    }

    if (this.landingFlashes.length) {
      this.landingFlashes = this.landingFlashes.filter(
        (f) => this.position - f.startedAt < LANDING_FLASH_MS
      );
    }
  }

  _scoreWord() {
    // combo only resets on game-over now
    this.combo = Math.min(999, this.combo + 1);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastLandAt = this.position;
    this.wordCount += 1;
    this.score += BASE_POINTS * this.combo;
    this.scorePulse = 1;
    this.bestRunner.chainsHit += 1;
    // first word = new run
    if (this.wordCount === 1) {
      this.bestRunner.runsLogged += 1;
    }
    this._refreshBestRunner();
  }

  _refreshBestRunner() {
    if (this.score > this.bestRunner.highScore) {
      this.bestRunner.highScore = Math.round(this.score);
    }
    if (this.maxCombo > this.bestRunner.peakCombo) {
      this.bestRunner.peakCombo = this.maxCombo;
      this.bestRunner.topRank = rankFor(this.maxCombo);
    }
    // always save so cumulative stats persist too, not just record-breakers
    this._saveBestRunner();
  }

  _checkLineClear() {
    const linesCleared = [];
    for (let r = 0; r < this.maxPileRows; r++) {
      let full = true;
      for (let c = 0; c < this.numCols; c++) {
        if (!this.pileGrid[c][r]) {
          full = false;
          break;
        }
      }
      if (full) linesCleared.push(r);
    }
    if (linesCleared.length === 0) return;

    const clearedSet = new Set(linesCleared);
    const clearedAt = this.position;
    const survivors = [];
    const fullyCleared = [];

    for (const s of this.stackedWords) {
      const botY = s.y + (s.cellsH * CELL_H) / 2;
      const botRow = Math.round((this.fieldBottomY - botY) / CELL_H);

      // translate cleared pile rows into this piece's render-row coords
      const clearedRenderRows = new Set();
      for (let r = botRow; r < botRow + s.cellsH; r++) {
        if (clearedSet.has(r)) {
          clearedRenderRows.add(s.cellsH - 1 - (r - botRow));
        }
      }

      if (clearedRenderRows.size === 0) {
        survivors.push(s);
        continue;
      }
      if (clearedRenderRows.size === s.cellsH) {
        fullyCleared.push(s);
        continue;
      }

      // partial clear: keep surviving chars, shrink cellsH, pin BOTTOM edge.
      // pinning top would leave the new bottom cell in the cleared row.
      const newChars = [];
      for (let r = 0; r < s.cellsH; r++) {
        if (clearedRenderRows.has(r)) continue;
        for (let c = 0; c < s.cellsW; c++) {
          const charIdx = s.isVertical
            ? c * s.cellsH + r
            : r * s.cellsW + c;
          if (charIdx < s.chars.length) newChars.push(s.chars[charIdx]);
        }
      }
      const oldBotY = s.y + (s.cellsH * CELL_H) / 2;
      const newCellsH = s.cellsH - clearedRenderRows.size;
      s.chars = newChars;
      s.text = newChars.join("");
      s.cellsH = newCellsH;
      s.y = oldBotY - (newCellsH * CELL_H) / 2;
      // already at final spot — skip gravity below
      s.justPartialCleared = true;
      survivors.push(s);
    }

    // fade out fully-cleared pieces, free their cells now
    for (const s of fullyCleared) {
      this._setWordCells(s, false);
      this.clearingWords.push({ word: s, clearedAt });
    }
    this.stackedWords = survivors;

    // gravity: each survivor slides down by # of cleared rows strictly
    // below its bottom. shiftOffsetY eases back to 0 for the animation.
    for (const s of this.stackedWords) {
      if (s.justPartialCleared) {
        delete s.justPartialCleared;
        continue;
      }
      const botY = s.y + (s.cellsH * CELL_H) / 2;
      const botRow = Math.round((this.fieldBottomY - botY) / CELL_H);
      let shiftBy = 0;
      for (const r of linesCleared) {
        if (r < botRow) shiftBy++;
      }
      if (shiftBy > 0) {
        s.y += shiftBy * CELL_H;
        s.shiftOffsetY = (s.shiftOffsetY || 0) - shiftBy * CELL_H;
      }
    }

    this._rebuildPileGrid();

    const n = linesCleared.length;
    const bonus = 1000 * n * n;
    this.score += bonus;
    this.combo = Math.min(999, this.combo + n * 3);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.scorePulse = 1;
    this._lineClearFlashAt = this.position;
    this.bestRunner.linesClr += n;
    this._refreshBestRunner();
    this._lineClearLines = n;
    this._lineClearBonus = bonus;
  }

  _triggerOverflow() {
    if (this.stackedWords.length > 0) {
      this.archivedFields.unshift({
        stackedWords: this.stackedWords.slice(),
        archivedAt: this.position,
        boxNumber: this.boxNumber,
      });
      if (this.archivedFields.length > MAX_ARCHIVES) {
        this.archivedFields.length = MAX_ARCHIVES;
      }
    }

    const penalty = PENALTY_BASE;
    this._lastPenalty = penalty;
    this.score = Math.max(0, this.score - penalty);
    this.combo = 1;
    this.scorePulse = 0;
    this._gameOverFlashAt = this.position;
    this._scoreNegativeFlashAt = this.position;

    this.boxNumber += 1;
    this.stackedWords = [];
    this.clearingWords = [];
    this._resetPileGrid();
  }

  _updateCamera() {
    // pile bounded by maxPileRows — camera stays put
    this.cameraY = 0;
  }

  // mirrors _spawnFallingWord so the cursor indicator matches the actual spawn
  _previewSpawn() {
    const next = this._peekNextWord();
    const nextText = next
      ? (next.text || "").trim().replace(/[()（）]/g, "")
      : "";
    const willBeVertical = next ? this._decideVertical(next, nextText) : false;
    const cellsW = willBeVertical ? 1 : this._previewCellsW(nextText);
    const cellsH = next ? this._previewCellsH(nextText, willBeVertical) : 1;

    // auto: solver chases clears then flattens. manual: read cursorCol.
    let cursorCol;
    if (this.autoMode && next) {
      const bestLeft = this._autoPickColumn(cellsW, cellsH, next);
      cursorCol = bestLeft + Math.floor(cellsW / 2);
    } else {
      cursorCol = this.cursorCol;
    }

    let colIdxLeft = cursorCol - Math.floor((cellsW - 1) / 2);
    const maxColLeft = Math.max(0, this.numCols - cellsW);
    if (colIdxLeft < 0) colIdxLeft = 0;
    if (colIdxLeft > maxColLeft) colIdxLeft = maxColLeft;

    const sx = this.fieldX + (colIdxLeft + cellsW / 2) * this.cellW;
    const sy = this.fieldTopY - 22;
    return {
      x: sx,
      y: sy,
      col: cursorCol,
      cellsW,
      colIdxLeft,
      nextText: nextText || "",
    };
  }

  // — Auto solver —
  // tiers (earlier wins before later matters):
  //   1. clears — rows the placement would complete
  //   2. maxH   — tallest col after placement (lower better)
  //   3. sumH   — total fill (lower better)
  // ties broken by hashing the word so pieces fan across cols.
  _autoPickColumn(cellsW, cellsH, word) {
    let bestClears = -1;
    let bestMaxH = Infinity;
    let bestSumH = Infinity;
    const candidates = [];
    const maxLeft = Math.max(0, this.numCols - cellsW);

    for (let left = 0; left <= maxLeft; left++) {
      // piece rests on tallest col in its footprint
      let landBottomRow = 0;
      for (let c = 0; c < cellsW; c++) {
        const h = this._pileTopRow(left + c);
        if (h > landBottomRow) landBottomRow = h;
      }
      const landTopRow = landBottomRow + cellsH;
      // reject overflow — auto must never break its own combo
      if (landTopRow > this.maxPileRows) continue;

      // count rows that would fill after placement
      let clears = 0;
      for (let r = landBottomRow; r < landTopRow; r++) {
        let rowFull = true;
        for (let col = 0; col < this.numCols; col++) {
          const inPiece = col >= left && col < left + cellsW;
          const filled = inPiece || this.pileGrid[col][r];
          if (!filled) {
            rowFull = false;
            break;
          }
        }
        if (rowFull) clears++;
      }

      // pile profile across the whole field
      let maxH = 0;
      let sumH = 0;
      for (let col = 0; col < this.numCols; col++) {
        const h =
          col >= left && col < left + cellsW
            ? landTopRow
            : this._pileTopRow(col);
        if (h > maxH) maxH = h;
        sumH += h;
      }

      const tier =
        clears > bestClears
          ? "better"
          : clears < bestClears
            ? "worse"
            : maxH < bestMaxH
              ? "better"
              : maxH > bestMaxH
                ? "worse"
                : sumH < bestSumH
                  ? "better"
                  : sumH > bestSumH
                    ? "worse"
                    : "equal";

      if (tier === "better") {
        bestClears = clears;
        bestMaxH = maxH;
        bestSumH = sumH;
        candidates.length = 0;
        candidates.push(left);
      } else if (tier === "equal") {
        candidates.push(left);
      }
    }

    if (!candidates.length) return 0;
    // hash so tied placements vary per piece. mixing length keeps consecutive
    // short words off the same col when start times share a residue.
    const seed = word
      ? Math.floor(word.startTime) + (word.text || "").length * 17
      : 0;
    return candidates[Math.abs(seed) % candidates.length];
  }

  // next non-empty, non-punct lyric word. falls back through _lastRealWord
  // during instrumental gaps so preview doesn't snap back to the first word.
  _peekNextWord() {
    if (!this.video) return null;
    const base = this._currentWord || this._lastRealWord;
    let n = base ? base.next : this.video.firstWord;
    let guard = 0;
    while (n && guard < 32) {
      const t = (n.text || "").trim().replace(/[()（）]/g, "");
      if (t && !PUNCT_RE.test(t)) {
        return n;
      }
      n = n.next;
      guard++;
    }
    return null;
  }

  // deterministic so preview and spawn match
  _decideVertical(word, text) {
    if (!word) return false;
    const hasLatin = /[A-Za-z]/.test(text);
    if (hasLatin || text.length > MAX_VERTICAL_CHARS) return false;
    const verticalProb =
      text.length <= 2 ? VERTICAL_PROB + 0.18 : VERTICAL_PROB;
    const seed = (word.startTime | 0) * 1031 + (word.endTime | 0);
    return detHash01(seed) < verticalProb;
  }

  // same wrap as spawn — predicts next piece's width
  _previewCellsW(text) {
    const chars = Array.from(text);
    if (chars.length === 0) return 1;
    if (chars.length <= SHORT_WORD_LIMIT) {
      return Math.min(chars.length, this.numCols);
    }
    return MAX_HORIZONTAL_CHARS;
  }

  // mirrors cellsH math in _spawnFallingWord
  _previewCellsH(text, isVertical) {
    const chars = Array.from(text);
    if (chars.length === 0) return 1;
    if (isVertical) return Math.min(chars.length, this.maxPileRows);
    if (chars.length <= SHORT_WORD_LIMIT) return 1;
    return Math.min(
      Math.ceil(chars.length / MAX_HORIZONTAL_CHARS),
      this.maxPileRows
    );
  }

  // line-clear gravity: s.y is at final, shiftOffsetY holds the negative
  // visual delta. each tick eases it back to 0 so survivors glide in.
  _updateStackedShifts(dt) {
    const decay = Math.pow(0.86, dt / 16);
    for (const s of this.stackedWords) {
      if (!s.shiftOffsetY) continue;
      s.shiftOffsetY *= decay;
      if (Math.abs(s.shiftOffsetY) < 0.5) s.shiftOffsetY = 0;
    }
  }

  _updateScoreTick(dt) {
    const diff = this.score - this.displayScore;
    if (diff > 0) {
      this.displayScore += Math.max(0.8, diff * 0.14);
      if (this.displayScore > this.score - 0.5) this.displayScore = this.score;
    }
    this.scorePulse = Math.max(0, this.scorePulse - dt / 600);
  }

  _updateBgEntities(dt) {
    for (const s of this.bgShapes) {
      s.y += s.vy * dt;
      s.angle += s.angleVel * dt;
      if (s.y < -s.size - 30) {
        s.y = this.height + s.size + 30;
        s.x = Math.random() * this.width;
      }
    }
  }

  _drawBackground() {
    const { ctx, width, height } = this;
    const { hue } = this.palette;
    const pulseBoost = this.beatPulse * 12;

    const g = ctx.createRadialGradient(
      width / 2,
      height * 0.5,
      Math.min(width, height) * 0.05,
      width / 2,
      height * 0.5,
      Math.max(width, height) * 0.85
    );
    g.addColorStop(0, `hsl(${hue} 45% ${8 + pulseBoost}%)`);
    g.addColorStop(0.6, `hsl(${(hue + 20) % 360} 35% ${4 + pulseBoost * 0.3}%)`);
    g.addColorStop(1, `hsl(${hue} 30% 2%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.022;
    ctx.fillStyle = "#ffffff";
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    ctx.globalAlpha = 1;
  }

  _drawBgEntities() {
    const { ctx } = this;
    for (const s of this.bgShapes) {
      const op = s.opacityBase + this.beatPulse * 0.1;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = `rgba(245,241,232,${op})`;
      ctx.lineWidth = 1;
      this._drawShape(s.type, s.size);
      ctx.restore();
    }
  }

  _drawShape(type, size) {
    const { ctx } = this;
    const r = size / 2;
    ctx.beginPath();
    switch (type) {
      case "hex":
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case "triangle":
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case "ring":
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
  }

  _drawCellField() {
    const { ctx, fieldX, fieldWidth, fieldTopY, fieldBottomY, maxPileRows } = this;
    const rgb = hexToRgb(this.palette.accent);

    // subtle tint inside the field
    ctx.fillStyle = `rgba(0,0,0,0.22)`;
    ctx.fillRect(fieldX, fieldTopY, fieldWidth, fieldBottomY - fieldTopY);

    // grid lines
    ctx.strokeStyle = `rgba(${rgb},0.14)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < this.numCols; i++) {
      const x = fieldX + i * this.cellW;
      ctx.moveTo(x, fieldTopY);
      ctx.lineTo(x, fieldBottomY);
    }
    for (let r = 1; r < maxPileRows; r++) {
      const y = fieldBottomY - r * CELL_H;
      ctx.moveTo(fieldX, y);
      ctx.lineTo(fieldX + fieldWidth, y);
    }
    ctx.stroke();

    // red border right after overflow archive — cue that box swapped
    const sinceOverflow = this.position - this._gameOverFlashAt;
    const isFlashing = sinceOverflow >= 0 && sinceOverflow < OVERFLOW_BORDER_FLASH_MS;
    ctx.strokeStyle = isFlashing ? "#ff5050" : `rgba(${rgb},0.4)`;
    ctx.lineWidth = isFlashing ? 2 : 1.5;
    ctx.strokeRect(fieldX, fieldTopY, fieldWidth, fieldBottomY - fieldTopY);

    // box number label, top-left of field
    ctx.font = '500 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = `rgba(${rgb},0.85)`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `BOX ${String(this.boxNumber).padStart(2, "0")}`,
      fieldX + 6,
      fieldTopY - 4
    );
  }

  _drawLineClearFlash() {
    const since = this.position - this._lineClearFlashAt;
    if (since < 0 || since > 900) return;
    const t = since / 900;
    const alpha = Math.max(0, 1 - t);

    const { ctx } = this;
    const cx = this.fieldX + this.fieldWidth / 2;
    const cy = this.fieldTopY - 56;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,170,80,${alpha})`;
    ctx.font = '500 18px ui-monospace, "JetBrains Mono", Menlo, monospace';
    const tag =
      this._lineClearLines >= 4
        ? "QUAD"
        : ["", "SINGLE", "DOUBLE", "TRIPLE"][this._lineClearLines] || "MULTI";
    ctx.fillText(
      `${tag} CLEAR  +${formatScore(this._lineClearBonus)}`,
      cx,
      cy
    );
    ctx.restore();
  }

  _drawGameOverFlash() {
    const since = this.position - this._gameOverFlashAt;
    if (since < 0 || since > GAMEOVER_FLASH_MS) return;
    const t = since / GAMEOVER_FLASH_MS;
    const alpha = Math.max(0, 1 - t);

    const { ctx, width, height } = this;

    // red wash over the field
    ctx.fillStyle = `rgba(255,80,80,${alpha * 0.22})`;
    ctx.fillRect(
      this.fieldX,
      this.fieldTopY,
      this.fieldWidth,
      this.fieldBottomY - this.fieldTopY
    );

    // headline + penalty centred in field
    const cx = this.fieldX + this.fieldWidth / 2;
    const cy = (this.fieldTopY + this.fieldBottomY) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,90,90,${alpha})`;
    ctx.font = '500 22px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("OVERFLOW //", cx, cy - 18);
    ctx.font = '500 18px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("ARCHIVED", cx, cy + 6);

    ctx.fillStyle = `rgba(255,170,80,${alpha})`;
    ctx.font = '500 16px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText(
      `-${formatScore(this._lastPenalty)}`,
      cx,
      cy + 32
    );
    ctx.restore();
  }

  _drawHelpOverlay() {
    const { ctx, width, height } = this;
    const accentRgb = hexToRgb(this.palette.accent);
    const highlightRgb = hexToRgb(this.palette.highlight);

    // backdrop wash to mute the field
    ctx.fillStyle = "rgba(6,12,20,0.72)";
    ctx.fillRect(0, 0, width, height);

    const panelW = 560;
    const panelH = 380;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    // panel bg + accent border
    ctx.fillStyle = "rgba(10,18,24,0.92)";
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = `rgba(${accentRgb},0.55)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);

    // corner ticks
    ctx.strokeStyle = `rgba(${accentRgb},0.9)`;
    ctx.lineWidth = 2;
    const tick = 14;
    const corners = [
      [px, py, 1, 1],
      [px + panelW, py, -1, 1],
      [px, py + panelH, 1, -1],
      [px + panelW, py + panelH, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * tick, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * tick);
      ctx.stroke();
    }

    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    ctx.fillStyle = `rgba(${highlightRgb},1)`;
    ctx.font = '500 14px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("> CONTROLS", px + 24, py + 22);
    ctx.fillStyle = `rgba(${accentRgb},0.6)`;
    ctx.font = '400 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("PRESS [Shift + /] TO CLOSE", px + 24, py + 42);

    const sections = [
      {
        heading: "PLAYBACK",
        rows: [
          ["[Space]", "Play / Pause"],
          ["[|◄] / [►|]", "Restart from beginning of song"],
        ],
      },
      {
        heading: "PLACEMENT",
        rows: [
          ["[Mouse]", "Hover to aim cursor"],
          ["[A] [S] [D] [F]", "Cols 1-4 (left hand)"],
          ["[J] [K] [L] [;]", "Cols 5-8 (right hand)"],
          ["[M]", "Toggle AUTO mode"],
        ],
      },
    ];

    let yCursor = py + 80;
    for (const sec of sections) {
      ctx.fillStyle = `rgba(${accentRgb},0.9)`;
      ctx.font = '500 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
      ctx.fillText(sec.heading, px + 24, yCursor);
      ctx.fillStyle = `rgba(${accentRgb},0.25)`;
      ctx.fillRect(px + 24, yCursor + 18, panelW - 48, 1);
      yCursor += 28;

      ctx.font = '400 13px ui-monospace, "JetBrains Mono", Menlo, monospace';
      for (const [key, desc] of sec.rows) {
        ctx.fillStyle = `rgba(${highlightRgb},0.95)`;
        ctx.fillText(key, px + 24, yCursor);
        ctx.fillStyle = "rgba(245,241,232,0.78)";
        ctx.fillText(desc, px + 230, yCursor);
        yCursor += 22;
      }
      yCursor += 12;
    }
  }

  _drawScanSweep(tMs) {
    const { ctx, width, height } = this;
    const phase =
      ((tMs - this.scanSweepStartMs) % SCAN_SWEEP_PERIOD_MS) /
      SCAN_SWEEP_PERIOD_MS;
    const eased = 0.5 - Math.cos(phase * Math.PI * 2) / 2;
    const y = eased * height;

    const accentRgb = hexToRgb(this.palette.accent);
    const grad = ctx.createLinearGradient(0, y - 50, 0, y + 50);
    grad.addColorStop(0, `rgba(${accentRgb},0)`);
    grad.addColorStop(0.5, `rgba(${accentRgb},0.07)`);
    grad.addColorStop(1, `rgba(${accentRgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 50, width, 100);

    ctx.fillStyle = `rgba(${accentRgb},0.28)`;
    ctx.fillRect(0, y, width, 1);
  }

  _drawCornerBrackets() {
    const { ctx, width, height } = this;
    const inset = 14;
    const len = 22;
    ctx.strokeStyle = this.palette.accent;
    ctx.lineWidth = 1.5;
    const corners = [
      [inset, inset, 1, 1],
      [width - inset, inset, -1, 1],
      [inset, height - inset, 1, -1],
      [width - inset, height - inset, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y + len * dy);
      ctx.lineTo(x, y);
      ctx.lineTo(x + len * dx, y);
      ctx.stroke();
    }
  }

  _drawHudTitleBlock() {
    const { ctx } = this;
    const x = 32;
    const y = 36;
    ctx.fillStyle = this.palette.accent;
    ctx.font = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("LYRSTACK // NOW PLAYING", x, y);
    ctx.font = '400 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = "rgba(245,241,232,0.62)";
    ctx.fillText("SONG : TAKEOVER - TWINFIELD", x, y + 22);
    ctx.fillText("BY   : EIFFEL", x, y + 38);

    if (this.autoMode) {
      ctx.font = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
      ctx.fillStyle = this.palette.highlight;
      ctx.fillText("[M] AUTO ON", x, y + 60);
    } else {
      ctx.fillStyle = "rgba(245,241,232,0.32)";
      ctx.fillText("[M] AUTO OFF", x, y + 60);
    }
    ctx.font = '400 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = "rgba(245,241,232,0.32)";
    ctx.fillText("[Shift + /] HELP", x, y + 78);
  }

  _drawScorePanel() {
    const { ctx } = this;
    const px = this.width - 32;
    const py = 36;

    ctx.textBaseline = "top";
    ctx.textAlign = "right";

    ctx.fillStyle = this.palette.accent;
    ctx.font = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("SCORE //", px, py);

    const negativeSince = this.position - this._scoreNegativeFlashAt;
    const isNegFlash = negativeSince >= 0 && negativeSince < 900;
    let scoreColor;
    if (isNegFlash) scoreColor = "#ff5a5a";
    else if (this.scorePulse > 0.3) scoreColor = this.palette.highlight;
    else scoreColor = "#f5f1e8";
    ctx.fillStyle = scoreColor;
    ctx.font = '500 24px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText(formatScore(this.displayScore), px, py + 17);

    const rank = rankFor(this.combo);
    ctx.fillStyle = this.palette.accent;
    ctx.font = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText(">  RANK    ", px - 60, py + 52);
    ctx.fillStyle = this.palette.highlight;
    ctx.font = '500 13px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText(rank.padStart(3, " "), px, py + 51);

    ctx.font = '400 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = "rgba(245,241,232,0.62)";
    ctx.fillText(
      `>  COMBO  ×${String(this.combo).padStart(3, "0")}`,
      px,
      py + 70
    );
    ctx.fillText(
      `>  CHAIN   ${String(this.wordCount).padStart(3, "0")}`,
      px,
      py + 86
    );
  }

  _drawBestRunnerPanel() {
    const { ctx } = this;
    const rightEdge = this.width - 32;
    const panelW = 240;
    const panelLeft = rightEdge - panelW;
    // centre panel against the field
    const panelHeight = 270;
    const fieldCenterY = (this.fieldTopY + this.fieldBottomY) / 2;
    let y = Math.max(130, fieldCenterY - panelHeight / 2);
    const panelTopY = y;

    // dashed connector from field to panel — terminal ticks + dashes
    const rgbAccent = hexToRgb(this.palette.accent);
    const connY = panelTopY + 78; // line up with HIGH_SCORE row
    const connStart = this.fieldX + this.fieldWidth + 10;
    const connEnd = panelLeft - 14;
    if (connEnd > connStart) {
      ctx.save();
      ctx.strokeStyle = `rgba(${rgbAccent},0.4)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(connStart, connY);
      ctx.lineTo(connEnd, connY);
      ctx.stroke();
      ctx.setLineDash([]);

      // ticks at each end
      ctx.fillStyle = `rgba(${rgbAccent},0.7)`;
      ctx.fillRect(connStart - 1, connY - 3, 3, 6);
      ctx.fillRect(connEnd - 1, connY - 3, 3, 6);
      ctx.restore();
    }

    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.fillStyle = this.palette.accent;
    ctx.font = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("BEST.RUNNER //", panelLeft, y);
    y += 18;
    ctx.fillStyle = "rgba(245,241,232,0.32)";
    ctx.font = '400 10px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("// LYRSTACK ARCHIVE", panelLeft, y);
    y += 18;

    ctx.fillStyle = `rgba(${hexToRgb(this.palette.accent)},0.28)`;
    ctx.fillRect(panelLeft, y, panelW, 1);
    y += 12;

    // headline high score
    ctx.fillStyle = "rgba(245,241,232,0.62)";
    ctx.font = '400 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("HIGH_SCORE", panelLeft, y);
    y += 16;
    ctx.fillStyle = this.palette.highlight;
    ctx.font = '500 22px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText(formatScore(this.bestRunner.highScore), panelLeft, y);
    y += 32;

    // stat block — label left, value right
    const valueX = rightEdge;
    const drawStat = (label, value) => {
      ctx.font = '400 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
      ctx.fillStyle = "rgba(245,241,232,0.62)";
      ctx.textAlign = "left";
      ctx.fillText(label, panelLeft, y);
      ctx.fillStyle = this.palette.highlight;
      ctx.textAlign = "right";
      ctx.fillText(value, valueX, y);
      y += 16;
    };

    drawStat("PEAK_COMBO", `×${String(this.bestRunner.peakCombo).padStart(3, "0")}`);
    drawStat("TOP_RANK", this.bestRunner.topRank);
    y += 4;
    ctx.fillStyle = `rgba(${hexToRgb(this.palette.accent)},0.28)`;
    ctx.fillRect(panelLeft, y, panelW, 1);
    y += 12;

    drawStat("RUNS_LOGGED", formatCompact(this.bestRunner.runsLogged));
    drawStat("LINES_CLR", formatCompact(this.bestRunner.linesClr));
    drawStat("CHAINS_HIT", formatCompact(this.bestRunner.chainsHit));
    y += 4;

    ctx.fillStyle = `rgba(${hexToRgb(this.palette.accent)},0.28)`;
    ctx.fillRect(panelLeft, y, panelW, 1);
    y += 12;

    // sync log
    ctx.textAlign = "left";
    ctx.fillStyle = this.palette.accent;
    ctx.font = '500 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillText("SYNC.LOG //", panelLeft, y);
    y += 18;

    // newest first
    ctx.font = '400 10px ui-monospace, "JetBrains Mono", Menlo, monospace';
    const entries = this.bestRunner.syncLog || [];
    if (entries.length === 0) {
      ctx.fillStyle = "rgba(245,241,232,0.32)";
      ctx.fillText("// no records yet", panelLeft, y);
    } else {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const idx = entries.length - i;
        ctx.fillStyle = "rgba(245,241,232,0.55)";
        ctx.textAlign = "left";
        ctx.fillText(`[${idx}] ${formatSyncDate(e.date)}`, panelLeft, y);
        ctx.fillStyle = this.palette.highlight;
        ctx.textAlign = "right";
        ctx.fillText(formatScore(e.score), valueX, y);
        y += 14;
      }
    }
  }

  _drawStackedWords() {
    const { ctx } = this;
    for (const s of this.stackedWords) {
      const screenY = s.y + (s.shiftOffsetY || 0) - this.cameraY;
      if (screenY < -200 || screenY > this.height + 200) continue;

      const age = this.position - s.landedAt;
      let alpha = 0.92;
      if (age > STACK_FADE_START_AGE) {
        const t =
          (age - STACK_FADE_START_AGE) /
          (STACK_MAX_AGE - STACK_FADE_START_AGE);
        alpha = Math.max(0.12, 0.92 * (1 - t));
      }
      const isActive = this._currentWord === s.word;
      this._drawWordBlock(s.x, screenY, s, alpha, isActive);
    }
  }

  // cosmetic backfill — fill empty cells below the top word in each col
  // so the pile reads as solid. doesn't affect collision.
  _drawPileBackfill() {
    if (this.stackedWords.length === 0) return;
    const { ctx } = this;
    const accentRgb = hexToRgb(this.palette.accent);
    const boxPadW = this.cellW - 6;
    const boxPadH = CELL_H - 6;

    for (let c = 0; c < this.numCols; c++) {
      // highest filled word cell in this col
      let topRow = -1;
      for (let r = this.maxPileRows - 1; r >= 0; r--) {
        if (this.pileGrid[c][r]) {
          topRow = r;
          break;
        }
      }
      if (topRow <= 0) continue;

      for (let r = 0; r < topRow; r++) {
        if (this.pileGrid[c][r]) continue; // real word cell
        const cx = this.fieldX + (c + 0.5) * this.cellW;
        const cy = this.fieldBottomY - (r + 0.5) * CELL_H;
        ctx.fillStyle = `rgba(${accentRgb},0.12)`;
        ctx.fillRect(
          cx - boxPadW / 2,
          cy - boxPadH / 2,
          boxPadW,
          boxPadH
        );
        ctx.strokeStyle = `rgba(${accentRgb},0.38)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          cx - boxPadW / 2,
          cy - boxPadH / 2,
          boxPadW,
          boxPadH
        );
      }
    }
  }

  // orange glow on cells where a piece just landed on top of another
  _drawLandingFlashes() {
    if (this.landingFlashes.length === 0) return;
    const { ctx } = this;
    const padW = this.cellW - 4;
    const padH = CELL_H - 4;
    for (const f of this.landingFlashes) {
      const age = this.position - f.startedAt;
      const t = age / LANDING_FLASH_MS;
      const alpha = Math.max(0, 1 - t);
      const cx = this.fieldX + (f.col + 0.5) * this.cellW;
      const cy = this.fieldBottomY - (f.row + 0.5) * CELL_H;
      ctx.fillStyle = `rgba(255, 169, 64, ${alpha * 0.28})`;
      ctx.fillRect(cx - padW / 2, cy - padH / 2, padW, padH);
      ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.9})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - padW / 2, cy - padH / 2, padW, padH);
    }
  }

  // shrunken previews of past overflowed playfields, left of the active one
  _drawArchivedFields() {
    if (this.archivedFields.length === 0) return;
    const { ctx } = this;
    const accentRgb = hexToRgb(this.palette.accent);
    const fieldH = this.fieldBottomY - this.fieldTopY;

    let cursorX = this.fieldX - ARCHIVE_GAP;

    for (let i = 0; i < this.archivedFields.length; i++) {
      const scale = ARCHIVE_SCALES[Math.min(i, ARCHIVE_SCALES.length - 1)];
      const aw = this.fieldWidth * scale;
      const ah = fieldH * scale;
      const ax = cursorX - aw;
      const ay = this.fieldTopY + (fieldH - ah) / 2;
      cursorX = ax - ARCHIVE_GAP;

      if (ax + aw < 0) break;

      const alpha = Math.max(0.35, 1 - i * 0.25);

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(ax, ay, aw, ah);
      ctx.strokeStyle = `rgba(${accentRgb},0.32)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(ax, ay, aw, ah);

      // label = the box number this archive had when active
      const num = this.archivedFields[i].boxNumber ?? i + 1;
      ctx.fillStyle = `rgba(${accentRgb},0.7)`;
      ctx.font = '500 10px ui-monospace, "JetBrains Mono", Menlo, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`BOX ${String(num).padStart(2, "0")}`, ax + 4, ay + 4);

      // map canvas coords to the scaled archive rect
      ctx.translate(ax, ay);
      ctx.scale(scale, scale);
      ctx.translate(-this.fieldX, -this.fieldTopY);
      for (const s of this.archivedFields[i].stackedWords) {
        this._drawWordBlock(s.x, s.y, s, 1, false);
      }
      ctx.restore();
    }
  }

  // fade + slight scale-out so clears don't pop out instantly
  _drawClearingWords() {
    for (const c of this.clearingWords) {
      const t = Math.min(
        1,
        Math.max(0, (this.position - c.clearedAt) / CLEAR_FADE_MS)
      );
      const alpha = 1 - t;
      const scale = 1 + 0.18 * t;
      const { ctx } = this;
      ctx.save();
      ctx.translate(c.word.x, c.word.y);
      ctx.scale(scale, scale);
      ctx.translate(-c.word.x, -c.word.y);
      this._drawWordBlock(c.word.x, c.word.y, c.word, alpha, false);
      ctx.restore();
    }
  }

  // one outlined cell per char — tetris look
  _drawWordBlock(x, y, w, alpha, isActive) {
    const { ctx } = this;
    const size = PAST_SIZE;
    const accentRgb = hexToRgb(this.palette.accent);
    const cellW = this.cellW;

    const isOver = w.isOverflow;
    const boxStrokeStyle = isOver
      ? "#ff5050"
      : isActive
      ? this.palette.highlight
      : `rgba(${accentRgb},0.45)`;
    const boxLineWidth = isOver ? 1.8 : isActive ? 1.6 : 1;
    const charColor = isOver ? "#ff8888" : "#f5f1e8";
    const boxPadW = cellW - 6;
    const boxPadH = CELL_H - 6;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;

    ctx.font = `500 ${size}px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const totalW = w.cellsW * cellW;
    const totalH = w.cellsH * CELL_H;
    const startX = -totalW / 2 + cellW / 2;
    const startY = -totalH / 2 + CELL_H / 2;

    // iterate whole bbox so empty wrap-cells still get outlined
    for (let row = 0; row < w.cellsH; row++) {
      for (let col = 0; col < w.cellsW; col++) {
        let charIdx;
        if (w.isVertical) {
          charIdx = col * w.cellsH + row;
        } else {
          charIdx = row * w.cellsW + col;
        }
        const cx = startX + col * cellW;
        const cy = startY + row * CELL_H;

        ctx.strokeStyle = boxStrokeStyle;
        ctx.lineWidth = boxLineWidth;
        ctx.strokeRect(cx - boxPadW / 2, cy - boxPadH / 2, boxPadW, boxPadH);

        if (charIdx < w.chars.length) {
          ctx.fillStyle = charColor;
          ctx.fillText(w.chars[charIdx], cx, cy);
        }
      }
    }

    ctx.restore();
  }

  _drawFallingWords() {
    const { ctx } = this;
    if (this.fallingWords.length === 0 && this.stackedWords.length === 0) {
      if (!this.hasStarted) this._drawPlaceholder();
      return;
    }

    for (const f of this.fallingWords) {
      const isActive = this._currentWord === f.word;
      const age = this.position - f.spawnedAt;
      const fadeIn = Math.min(1, age / 120);
      const screenY = f.y - this.cameraY;
      this._drawWordBlock(f.x, screenY, f, fadeIn, isActive);
    }

    if (this._currentEmote && this.mouseX !== null) {
      const since = this.position - this._currentEmoteAppearedAt;
      const emoteIn = Math.min(1, since / 220);
      const spawn = this._previewSpawn();
      const ex = spawn.x;
      const ey = spawn.y - 46;
      const size = 32;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.scale(0.55 + 0.45 * emoteIn, 0.55 + 0.45 * emoteIn);
      ctx.globalAlpha = emoteIn;
      this._drawEmote(this._currentEmote, size);
      ctx.restore();
    }
  }

  _drawCursorIndicator() {
    // show whenever any input is driving the cursor (mouse/keyboard/auto)
    if (
      this.mouseX === null &&
      !this.autoMode &&
      !this._keyboardCursorActive
    ) {
      return;
    }
    const { ctx } = this;

    const spawn = this._previewSpawn();
    const { colIdxLeft, cellsW } = spawn;
    const pieceLeft = this.fieldX + colIdxLeft * this.cellW;
    const pieceWidth = cellsW * this.cellW;
    const pieceCenterX = pieceLeft + pieceWidth / 2;

    // highest pile-top (smallest Y) across covered cols
    let pileTop = this.fieldBottomY;
    for (let c = colIdxLeft; c < colIdxLeft + cellsW; c++) {
      const t = this._pileTopWorldY(c);
      if (t < pileTop) pileTop = t;
    }

    const arrowY = spawn.y;
    const pulse = 0.6 + this.beatPulse * 0.4;
    const accentRgb = hexToRgb(this.palette.accent);

    ctx.save();

    // highlight across full piece footprint so width is visible
    ctx.fillStyle = `rgba(${accentRgb},${0.06 + this.beatPulse * 0.05})`;
    ctx.fillRect(pieceLeft, this.fieldTopY, pieceWidth, pileTop - this.fieldTopY);

    // per-col divider ticks so multi-col highlight doesn't read as one block
    if (cellsW > 1) {
      ctx.strokeStyle = `rgba(${accentRgb},0.25)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < cellsW; i++) {
        const x = pieceLeft + i * this.cellW;
        ctx.moveTo(x, this.fieldTopY);
        ctx.lineTo(x, pileTop);
      }
      ctx.stroke();
    }

    // next-word hint above the arrow
    if (spawn.nextText) {
      const hint = spawn.nextText.length > 8
        ? spawn.nextText.slice(0, 7) + "…"
        : spawn.nextText;
      ctx.globalAlpha = 0.75;
      ctx.font =
        '500 11px ui-monospace, "JetBrains Mono", Menlo, monospace';
      ctx.fillStyle = `rgba(${accentRgb},0.85)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`> ${hint}`, pieceCenterX, arrowY - 12);
      ctx.globalAlpha = 1;
    }

    // arrow centred on piece
    ctx.globalAlpha = pulse;
    ctx.fillStyle = this.palette.highlight;
    ctx.beginPath();
    ctx.moveTo(pieceCenterX - 9, arrowY - 8);
    ctx.lineTo(pieceCenterX + 9, arrowY - 8);
    ctx.lineTo(pieceCenterX, arrowY + 6);
    ctx.closePath();
    ctx.fill();

    // landing line across piece footprint
    ctx.strokeStyle = this.palette.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pieceLeft + 3, pileTop);
    ctx.lineTo(pieceLeft + pieceWidth - 3, pileTop);
    ctx.stroke();

    ctx.restore();
  }

  _drawEmote(name, size) {
    const { ctx } = this;
    const r = size / 2;
    ctx.strokeStyle = this.palette.highlight;
    ctx.fillStyle = this.palette.highlight;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (name) {
      case "moon":
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI * 0.3, Math.PI * 1.7, false);
        ctx.arc(r * 0.35, 0, r * 0.85, Math.PI * 1.7, Math.PI * 0.3, true);
        ctx.closePath();
        ctx.stroke();
        return;
      case "spark":
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 4) * i;
          const r1 = i % 2 === 0 ? r : r * 0.4;
          const x = Math.cos(a) * r1;
          const y = Math.sin(a) * r1;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        return;
      case "star":
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const r1 = i % 2 === 0 ? r : r * 0.45;
          const x = Math.cos(a) * r1;
          const y = Math.sin(a) * r1;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        return;
      case "flame":
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.7, r, 0, r);
        ctx.bezierCurveTo(-r * 0.7, r, -r * 0.9, -r * 0.2, 0, -r);
        ctx.closePath();
        ctx.stroke();
        return;
      case "drop":
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.bezierCurveTo(r * 0.8, -r * 0.1, r * 0.7, r, 0, r);
        ctx.bezierCurveTo(-r * 0.7, r, -r * 0.8, -r * 0.1, 0, -r);
        ctx.closePath();
        ctx.stroke();
        return;
      case "swirl":
        ctx.beginPath();
        for (let i = 0; i < 50; i++) {
          const t = i / 49;
          const a = t * Math.PI * 3;
          const rr = r * (1 - t * 0.85);
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      case "heart":
        ctx.beginPath();
        ctx.moveTo(0, r * 0.7);
        ctx.bezierCurveTo(r * 1.2, 0, r * 0.55, -r * 1.15, 0, -r * 0.35);
        ctx.bezierCurveTo(-r * 0.55, -r * 1.15, -r * 1.2, 0, 0, r * 0.7);
        ctx.closePath();
        ctx.stroke();
        return;
      case "bolt":
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r);
        ctx.lineTo(r * 0.4, -r * 0.1);
        ctx.lineTo(0, -r * 0.1);
        ctx.lineTo(r * 0.2, r);
        ctx.lineTo(-r * 0.4, r * 0.1);
        ctx.lineTo(0, r * 0.1);
        ctx.closePath();
        ctx.stroke();
        return;
      case "fracture":
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.7);
        ctx.lineTo(-r * 0.1, -r * 0.2);
        ctx.lineTo(-r * 0.45, r * 0.1);
        ctx.lineTo(r * 0.2, r * 0.4);
        ctx.lineTo(-r * 0.05, r);
        ctx.moveTo(-r * 0.1, -r * 0.2);
        ctx.lineTo(r * 0.5, -r * 0.6);
        ctx.lineTo(r, -r * 0.1);
        ctx.moveTo(r * 0.2, r * 0.4);
        ctx.lineTo(r * 0.7, r * 0.3);
        ctx.stroke();
        return;
      case "arrow_fwd":
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r * 0.7, 0);
        ctx.moveTo(r * 0.2, -r * 0.5);
        ctx.lineTo(r * 0.7, 0);
        ctx.lineTo(r * 0.2, r * 0.5);
        ctx.stroke();
        return;
      case "arrow_back":
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.7, 0);
        ctx.moveTo(-r * 0.2, -r * 0.5);
        ctx.lineTo(-r * 0.7, 0);
        ctx.lineTo(-r * 0.2, r * 0.5);
        ctx.stroke();
        return;
      case "cloud":
        ctx.beginPath();
        ctx.arc(-r * 0.4, 0, r * 0.45, 0, Math.PI * 2);
        ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2);
        ctx.arc(r * 0.45, 0, r * 0.45, 0, Math.PI * 2);
        ctx.moveTo(-r * 0.85, r * 0.35);
        ctx.lineTo(r * 0.9, r * 0.35);
        ctx.stroke();
        return;
      case "wave":
        ctx.beginPath();
        for (let i = -r; i <= r; i += 2) {
          const y = Math.sin((i / r) * Math.PI * 2) * r * 0.5;
          if (i === -r) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
        return;
      case "eye":
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.quadraticCurveTo(0, -r * 0.85, r, 0);
        ctx.quadraticCurveTo(0, r * 0.85, -r, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        return;
      case "warning":
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, r * 0.85);
        ctx.lineTo(-r, r * 0.85);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.25);
        ctx.lineTo(0, r * 0.35);
        ctx.stroke();
        return;
      case "triangle":
      default:
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        return;
    }
  }

  _drawPlaceholder() {
    const { ctx, width, height } = this;
    ctx.save();
    ctx.fillStyle = "rgba(245,241,232,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 40px "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';
    ctx.fillText("♪", width / 2, height / 2 - 16);
    ctx.font = '400 13px ui-monospace, "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = "rgba(245,241,232,0.55)";
    ctx.fillText(
      "STACK THE WORDS // DON'T OVERFLOW",
      width / 2,
      height / 2 + 28
    );
    ctx.restore();
  }

  _onResize() {
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    this.width = cssW;
    this.height = cssH;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // save old anchor so pieces can shift to the new field
    const oldFieldX = this.fieldX;
    const oldFieldBottomY = this.fieldBottomY;

    // narrow vertical field, centred
    const maxFieldWidth = Math.max(CELL_W * 4, this.width - 32);
    this.numCols = Math.min(PLAYFIELD_COLS, Math.floor(maxFieldWidth / CELL_W));
    this.cellW = CELL_W;
    this.fieldWidth = this.numCols * this.cellW;
    this.fieldX = Math.round((this.width - this.fieldWidth) / 2);
    this.fieldBottomY = this.height - FIELD_BOTTOM_MARGIN;
    const desiredTop = FIELD_TOP_MARGIN;
    this.maxPileRows = Math.max(
      4,
      Math.floor((this.fieldBottomY - desiredTop) / CELL_H)
    );
    // snap fieldTopY so every row is exactly CELL_H tall (no stretched top)
    this.fieldTopY = this.fieldBottomY - this.maxPileRows * CELL_H;
    this._resetPileGrid();

    // shift pieces by the field delta
    const dx = this.fieldX - oldFieldX;
    const dy = this.fieldBottomY - oldFieldBottomY;
    if (dx !== 0 || dy !== 0) {
      for (const f of this.fallingWords) {
        f.x += dx;
        f.y += dy;
      }
      for (const s of this.stackedWords) {
        s.x += dx;
        s.y += dy;
      }
      for (const a of this.archivedFields) {
        for (const s of a.stackedWords) {
          s.x += dx;
          s.y += dy;
        }
      }
    }

    this._rebuildPileGrid();
  }
}

// cheap deterministic hash → [0, 1)
function detHash01(seed) {
  let x = (seed | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

function formatScore(n) {
  return String(Math.round(n)).padStart(8, "0");
}

function formatCompact(n) {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return (v < 10 ? v.toFixed(1) : Math.floor(v)) + "M";
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return (v < 10 ? v.toFixed(1) : Math.floor(v)) + "K";
  }
  return String(n).padStart(3, "0");
}

function formatSyncDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "----";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${yyyy}-${mm}-${dd} ${String(h).padStart(2, "0")}:${min}${ampm}`;
}

function rankFor(value) {
  let r = RANK_THRESHOLDS[0].grade;
  for (const t of RANK_THRESHOLDS) {
    if (value >= t.min) r = t.grade;
  }
  return r;
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
