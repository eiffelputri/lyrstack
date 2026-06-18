// game settings

// board size
export const BOARD_COLS = 8;
export const BOARD_ROWS = 12;
// space above the board for new pieces
export const SPAWN_GUTTER_ROWS = 1.4;

// fall speed without beat data
export const DEFAULT_FALL_SPEED = 0.02;
export const MIN_FALL_SPEED = 0.005;
export const MAX_FALL_SPEED = 0.024;
export const MIN_FALL_TIME_MS = 650;
export const MAX_FALL_TIME_MS = 1500;
// fall limits
export const BEAT_FALL_MIN_MS = 250;
export const BEAT_FALL_MAX_MS = 3000;
export const BEAT_MAX_FALL_SPEED = 0.09;
// max pieces in the air
export const MAX_FALLING_PIECES = 12;
// slow down before landing
export const SOFT_LANDING_ROWS = 1.8;


// scoring
export const POINTS = {
  land: 10,
  nice: 25,
  // by rows cleared at once
  lines: [0, 100, 300, 500, 800],
  comboStep: 50,
  overflowPenalty: 500,
};
// max distance from a beat for NICE
export const NICE_WINDOW_MS = 130;

// rank limits
export const RANKS = [
  { min: 0.8, grade: "S" },
  { min: 0.6, grade: "A" },
  { min: 0.4, grade: "B" },
  { min: 0.2, grade: "C" },
  { min: 0, grade: "D" },
];

// animation lengths
export const CLEAR_FLASH_MS = 360;
export const ROW_SHIFT_MS = 220;
export const POPUP_MS = 900;
export const OVERFLOW_FLASH_MS = 1200;
export const PIECE_FADE_IN_MS = 120;

// max boxes kept
export const MAX_ARCHIVES = 99;
