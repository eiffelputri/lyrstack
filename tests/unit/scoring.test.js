import { describe, expect, it } from "vitest";
import { ScoreKeeper, lineClearPoints, rankFor, referenceScore } from "../../src/game/scoring.js";

describe("points", () => {
  it.each([
    [0, 0],
    [1, 100],
    [2, 300],
    [3, 500],
    [4, 800],
    [6, 800],
  ])("%d rows gives %d", (rows, pts) => {
    expect(lineClearPoints(rows)).toBe(pts);
  });
});

describe("ScoreKeeper", () => {
  it("gives +10 per landing", () => {
    const s = new ScoreKeeper();
    expect(s.land()).toBe(10);
    s.land();
    expect(s.score).toBe(20);
  });

  it("adds +25 for NICE", () => {
    const s = new ScoreKeeper();
    expect(s.land({ nice: true })).toBe(35);
    expect(s.nice).toBe(1);
  });

  it("builds a combo only on back-to-back clears", () => {
    const s = new ScoreKeeper();
    expect(s.land({ rowsCleared: 1 })).toBe(110); // first clear
    expect(s.land({ rowsCleared: 2 })).toBe(10 + 300 + 50); // combo 1
    expect(s.land({ rowsCleared: 1 })).toBe(10 + 100 + 100); // combo 2
    expect(s.maxCombo).toBe(2);
    expect(s.land()).toBe(10); // combo ends
    expect(s.combo).toBe(0);
    expect(s.land({ rowsCleared: 1 })).toBe(110);
    expect(s.lines).toBe(5);
  });

  it("overflow costs 500, ends the combo and never goes below 0", () => {
    const s = new ScoreKeeper();
    s.land({ rowsCleared: 4 });
    s.land({ rowsCleared: 1 });
    expect(s.combo).toBe(1);
    const before = s.score;
    s.overflow();
    expect(s.score).toBe(before - 500);
    expect(s.combo).toBe(0);
    s.overflow();
    s.overflow();
    expect(s.score).toBe(0);
    expect(s.overflows).toBe(3);
  });

  it("reset clears everything", () => {
    const s = new ScoreKeeper();
    s.land({ rowsCleared: 1, nice: true });
    s.reset();
    expect([s.score, s.lines, s.nice, s.combo, s.cleared]).toEqual([0, 0, 0, 0, false]);
  });
});

describe("rank", () => {
  it("is relative to the reference score", () => {
    expect(rankFor(95, 100)).toBe("S");
    expect(rankFor(70, 100)).toBe("A");
    expect(rankFor(55, 100)).toBe("B");
    expect(rankFor(30, 100)).toBe("C");
    expect(rankFor(10, 100)).toBe("D");
  });

  it("handles an empty reference", () => {
    expect(rankFor(100, 0)).toBe("D");
    expect(rankFor(100, NaN)).toBe("D");
  });

  it("reference grows with the lyrics played", () => {
    expect(referenceScore(0, 0)).toBe(0);
    expect(referenceScore(10, 40)).toBeLessThan(referenceScore(20, 80));
  });
});
