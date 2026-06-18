// turns words into piece shapes
// one character per cell

import { detHash01 } from "../utils/hash.js";

function parse(key, art) {
  const rows = art.trim().split("/");
  const cells = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") cells.push([x, y]);
    });
  });
  const w = Math.max(...cells.map(([x]) => x)) + 1;
  const h = rows.length;
  return Object.freeze({ key, w, h, cells: Object.freeze(cells.map((c) => Object.freeze(c))) });
}

// shape format
const ART = {
  1: { dot: "#" },
  2: { I2: "##", I2v: "#/#" },
  3: {
    I3: "###",
    I3v: "#/#/#",
    V3a: "#./##",
    V3b: "##/#.",
    V3c: "##/.#",
    V3d: ".#/##",
  },
  4: {
    I: "####",
    Iv: "#/#/#/#",
    O: "##/##",
    T: "###/.#.",
    Tu: ".#./###",
    Tl: ".#/##/.#",
    Tr: "#./##/#.",
    S: ".##/##.",
    Sv: "#./##/.#",
    Z: "##./.##",
    Zv: ".#/##/#.",
    L: "#./#./##",
    Lh: "###/#..",
    L2: "##/.#/.#",
    Lh2: "..#/###",
    J: ".#/.#/##",
    Jh: "#../###",
    J2: "##/#./#.",
    Jh2: "###/..#",
  },
  5: {
    I5: "#####",
    P: "##/##/#.",
    Pq: "##/##/.#",
    Pb: "#./##/##",
    U: "#.#/###",
    Un: "###/#.#",
    T5: "###/.#./.#.",
    V5: "#../#../###",
    L5: "#.../####",
    J5: "...#/####",
    X: ".#./###/.#.",
    S5: "##./.#./.##",
  },
  6: {
    R32: "###/###",
    R23: "##/##/##",
    St6: "###./.###",
    St6b: ".###/###.",
    L6: "####/##..",
    J6: "####/..##",
  },
  7: {
    B7: "####/###.",
    B7b: "####/.###",
    B7c: "###./####",
    T7: "###/###/.#.",
    H7: "#.#/###/#.#",
  },
  8: {
    R42: "####/####",
    R24: "##/##/##/##",
    St8: "####./.####",
  },
};

export const SHAPES = Object.freeze(
  Object.fromEntries(
    Object.entries(ART).map(([n, set]) => [
      n,
      Object.freeze(Object.entries(set).map(([key, art]) => parse(key, art))),
    ])
  )
);

// split long words into rows
export function wrapShape(n, width, alignRight = false) {
  const cells = [];
  const rows = Math.ceil(n / width);
  for (let y = 0; y < rows; y++) {
    const count = Math.min(width, n - y * width);
    const offset = alignRight ? width - count : 0;
    for (let i = 0; i < count; i++) cells.push([offset + i, y]);
  }
  return { key: `wrap${width}${alignRight ? "r" : "l"}`, w: width, h: rows, cells };
}

const LATIN_RE = /[A-Za-z0-9]/;

// shapes that fit the board
export function candidateShapes(text, cols, rows) {
  const n = Math.max(1, Array.from(text).length);
  const latin = LATIN_RE.test(text);
  const fits = (s) => s.w <= cols && s.h <= rows;

  // keep English words flat
  if (latin) {
    if (n <= Math.min(5, cols)) return [wrapShape(n, n)];
    const two = wrapShape(n, Math.min(cols, Math.max(3, Math.ceil(n / 2))));
    if (fits(two)) return [two];
  } else {
    const list = (SHAPES[n] ?? []).filter(fits);
    if (list.length) return list;
  }

  // widen until it fits
  for (let width = Math.min(4, cols); width <= cols; width++) {
    if (Math.ceil(n / width) <= rows) {
      const out = [wrapShape(n, width, false), wrapShape(n, width, true)];
      if (width > 3 && Math.ceil(n / (width - 1)) <= rows) {
        out.push(wrapShape(n, width - 1, false));
      }
      return out;
    }
  }
  // capped to the board size
  return [wrapShape(cols * rows, cols)];
}

// NEXT matches the piece that falls
export function shapeForWord(text, seed, cols, rows) {
  const list = candidateShapes(text, cols, rows);
  const idx = Math.floor(detHash01(seed) * list.length) % list.length;
  return list[idx];
}

// lowest cell per column
export function bottomProfile(shape) {
  const out = new Array(shape.w).fill(-1);
  for (const [x, y] of shape.cells) if (y > out[x]) out[x] = y;
  return out;
}

// highest cell per column
export function topProfile(shape) {
  const out = new Array(shape.w).fill(Infinity);
  for (const [x, y] of shape.cells) if (y < out[x]) out[x] = y;
  return out;
}
