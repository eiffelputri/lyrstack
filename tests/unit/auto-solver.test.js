import { describe, expect, it } from "vitest";
import { pickAutoColumn } from "../../src/game/auto-solver.js";
import { Board } from "../../src/game/board.js";
import { SHAPES } from "../../src/game/shapes.js";
import { boardRows } from "../helpers/fake-env.js";

const shape = (key) => Object.values(SHAPES).flat().find((s) => s.key === key);

describe("pickAutoColumn", () => {
  it("completes a line when it can", () => {
    const b = boardRows(new Board(8, 6), ["###.####"]);
    expect(pickAutoColumn(b, shape("dot"))).toBe(3);
  });

  it("fills the gap that fits the piece", () => {
    const b = boardRows(new Board(8, 6), ["##..####", "##..####"]);
    expect(pickAutoColumn(b, shape("O"))).toBe(2);
  });

  it("avoids overflowing when there is room elsewhere", () => {
    const b = boardRows(new Board(4, 4), ["###.", "###.", "###.", "###."]);
    expect(pickAutoColumn(b, shape("I2v"))).toBe(3);
  });

  it("returns a legal column even when everything overflows", () => {
    const b = boardRows(new Board(4, 2), ["####", "####"]);
    const left = pickAutoColumn(b, shape("O"));
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(2);
  });

  it("keeps wide pieces inside the board", () => {
    const b = new Board(8, 12);
    for (const s of Object.values(SHAPES).flat()) {
      const left = pickAutoColumn(b, s, 1234);
      expect(left + s.w).toBeLessThanOrEqual(8);
    }
  });

  it("does not modify the board", () => {
    const b = boardRows(new Board(8, 6), ["#.#.#.#."]);
    const before = JSON.stringify(b.cells);
    pickAutoColumn(b, shape("T"));
    expect(JSON.stringify(b.cells)).toBe(before);
  });
});
