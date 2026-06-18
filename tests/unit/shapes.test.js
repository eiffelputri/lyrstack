import { describe, expect, it } from "vitest";
import {
  SHAPES,
  bottomProfile,
  candidateShapes,
  shapeForWord,
  topProfile,
  wrapShape,
} from "../../src/game/shapes.js";

function isConnected(cells) {
  const key = ([x, y]) => `${x},${y}`;
  const set = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const stack = [cells[0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = key(n);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(n);
      }
    }
  }
  return seen.size === cells.length;
}

const isReadingOrder = (cells) =>
  cells.every((c, i) => i === 0 || c[1] > cells[i - 1][1] || (c[1] === cells[i - 1][1] && c[0] > cells[i - 1][0]));

describe("shape library", () => {
  for (const [n, list] of Object.entries(SHAPES)) {
    it(`every ${n}-cell shape has ${n} connected cells in reading order`, () => {
      for (const s of list) {
        expect(s.cells, s.key).toHaveLength(Number(n));
        expect(isConnected(s.cells), s.key).toBe(true);
        expect(isReadingOrder(s.cells), s.key).toBe(true);
        expect(Math.max(...s.cells.map((c) => c[0])) + 1).toBe(s.w);
        expect(Math.max(...s.cells.map((c) => c[1])) + 1).toBe(s.h);
      }
    });
  }

  it("includes the seven classic tetrominoes", () => {
    const keys = SHAPES[4].map((s) => s.key);
    for (const k of ["I", "O", "T", "S", "Z", "L", "J"]) expect(keys).toContain(k);
  });

  it("shapes are frozen so a piece can't reshape the library", () => {
    expect(Object.isFrozen(SHAPES[4][0])).toBe(true);
    expect(Object.isFrozen(SHAPES[4][0].cells)).toBe(true);
  });
});

describe("candidateShapes", () => {
  it("keeps latin words horizontal", () => {
    for (const w of ["na", "Hello", "TAKEOVER", "together"]) {
      for (const s of candidateShapes(w, 8, 12)) expect(s.w).toBeGreaterThanOrEqual(s.h);
    }
    expect(candidateShapes("Hello", 8, 12)[0].h).toBe(1);
  });

  it("gives Japanese words several shapes to pick from", () => {
    expect(candidateShapes("鼓動する", 8, 12).length).toBeGreaterThan(5);
  });

  it("wraps long words and always fits the board", () => {
    for (let n = 1; n <= 40; n++) {
      const text = "あ".repeat(n);
      for (const s of candidateShapes(text, 8, 12)) {
        expect(s.w).toBeLessThanOrEqual(8);
        expect(s.h).toBeLessThanOrEqual(12);
        expect(s.cells.length).toBe(n);
      }
    }
  });

  it("never returns an empty list, even for absurd latin words", () => {
    for (const n of [9, 17, 40, 97, 10_000]) {
      const list = candidateShapes("x".repeat(n), 8, 12);
      expect(list.length, String(n)).toBeGreaterThan(0);
      for (const sh of list) expect(sh.h).toBeLessThanOrEqual(12);
    }
  });

  it("caps words longer than the whole board", () => {
    const [s] = candidateShapes("あ".repeat(500), 8, 12);
    expect(s.cells.length).toBe(96);
    expect(s.w).toBe(8);
  });

  it("respects a smaller board", () => {
    for (const s of candidateShapes("あいうえおかき", 4, 4)) {
      expect(s.w).toBeLessThanOrEqual(4);
      expect(s.h).toBeLessThanOrEqual(4);
    }
  });
});

describe("shapeForWord", () => {
  it("is deterministic per seed (preview == spawn)", () => {
    expect(shapeForWord("鼓動", 1234, 8, 12)).toBe(shapeForWord("鼓動", 1234, 8, 12));
  });

  it("varies across seeds", () => {
    const keys = new Set();
    for (let seed = 0; seed < 200; seed++) keys.add(shapeForWord("未来へ走る", seed * 977, 8, 12).key);
    expect(keys.size).toBeGreaterThan(4);
  });
});

describe("wrapShape + profiles", () => {
  it("builds a ragged block", () => {
    const s = wrapShape(10, 4);
    expect([s.w, s.h, s.cells.length]).toEqual([4, 3, 10]);
    expect(wrapShape(10, 4, true).cells.at(-1)).toEqual([3, 2]);
  });

  it("computes top / bottom profiles", () => {
    const T = SHAPES[4].find((s) => s.key === "T"); // ###/.#.
    expect(topProfile(T)).toEqual([0, 0, 0]);
    expect(bottomProfile(T)).toEqual([0, 1, 0]);
  });
});
