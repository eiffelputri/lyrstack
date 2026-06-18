import { describe, expect, it } from "vitest";
import { Board } from "../../src/game/board.js";
import { SHAPES } from "../../src/game/shapes.js";
import { boardRows } from "../helpers/fake-env.js";

const shape = (key) => Object.values(SHAPES).flat().find((s) => s.key === key);
const O = shape("O");
const I = shape("I");
const dot = shape("dot");

describe("Board", () => {
  it("starts empty", () => {
    const b = new Board(8, 12);
    expect(b.isEmpty()).toBe(true);
    expect(b.heights()).toEqual(new Array(8).fill(0));
  });

  it("drops a piece to the floor", () => {
    const b = new Board(8, 12);
    expect(b.dropRow(O, 0)).toBe(10);
  });

  it("stops on top of existing blocks", () => {
    const b = boardRows(new Board(4, 6), ["#...", "#..."]);
    expect(b.dropRow(dot, 0)).toBe(3);
    expect(b.dropRow(dot, 1)).toBe(5);
  });

  it("rejects out-of-bounds placements", () => {
    const b = new Board(4, 6);
    expect(b.fits(I, 1, 0)).toBe(false);
    expect(b.fits(I, -1, 0)).toBe(false);
    expect(b.fits(O, 0, 5)).toBe(false);
    expect(b.fits(O, 0, -1)).toBe(true); // above the board is empty
  });

  it("reports overflow when a piece locks above the top", () => {
    const b = new Board(4, 4);
    expect(b.place(O, 0, -1, () => ({}))).toBe(true);
    expect(b.place(O, 2, 2, () => ({}))).toBe(false);
  });

  it("clears full rows and drops everything above", () => {
    const b = boardRows(new Board(4, 5), ["#...", "####", ".#..", "####"]);
    const rows = b.fullRows();
    expect(rows).toEqual([2, 4]);
    const removed = b.clearRows(rows);
    expect(removed).toHaveLength(8);
    expect(b.heights()).toEqual([2, 1, 0, 0]);
    expect(b.get(0, 3)).toBeTruthy();
    expect(b.get(1, 4)).toBeTruthy();
  });

  it("counts holes", () => {
    const b = boardRows(new Board(3, 4), ["#..", "...", "##.", ".#."]);
    expect(b.holes()).toBe(2);
  });

  it("clone is independent", () => {
    const b = new Board(4, 4);
    const c = b.clone();
    c.place(O, 0, 2, () => ({}));
    expect(b.isEmpty()).toBe(true);
    expect(c.isEmpty()).toBe(false);
  });

  it("get() is safe out of range", () => {
    const b = new Board(2, 2);
    expect(b.get(-1, 0)).toBeNull();
    expect(b.get(0, 99)).toBeNull();
  });
});
