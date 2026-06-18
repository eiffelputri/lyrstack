// score and rank
// rank compares against the lyrics so far

import { BOARD_COLS, POINTS, RANKS } from "../config/game.js";

export function lineClearPoints(rows) {
  if (rows <= 0) return 0;
  return POINTS.lines[Math.min(rows, POINTS.lines.length - 1)];
}

// reference score for rank
// NICE is left out so phone players can still get S
export function referenceScore(words, cells) {
  if (words <= 0) return 0;
  const rows = cells / BOARD_COLS;
  return words * POINTS.land + rows * 150;
}

export function rankFor(score, reference) {
  if (!(reference > 0)) return RANKS[RANKS.length - 1].grade;
  const ratio = score / reference;
  for (const r of RANKS) if (ratio >= r.min) return r.grade;
  return RANKS[RANKS.length - 1].grade;
}

export class ScoreKeeper {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    // for combos
    this.cleared = false;
    this.maxCombo = 0;
    this.lines = 0;
    this.nice = 0;
    this.overflows = 0;
    this.pieces = 0;
    this.cells = 0;
  }

  // add score when a piece lands
  land({ rowsCleared = 0, nice = false, cells = 1 } = {}) {
    let gained = POINTS.land;
    this.pieces += 1;
    this.cells += cells;
    if (nice) {
      gained += POINTS.nice;
      this.nice += 1;
    }
    if (rowsCleared > 0) {
      gained += lineClearPoints(rowsCleared);
      if (this.cleared) {
        this.combo += 1;
        gained += POINTS.comboStep * this.combo;
      }
      this.cleared = true;
      this.lines += rowsCleared;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      this.cleared = false;
      this.combo = 0;
    }
    this.score += gained;
    return gained;
  }

  overflow() {
    this.overflows += 1;
    this.pieces += 1;
    this.combo = 0;
    this.cleared = false;
    this.score = Math.max(0, this.score - POINTS.overflowPenalty);
  }

  rank(reference) {
    return rankFor(this.score, reference);
  }
}
