// weird lyrics test
import { describe, expect, it } from "vitest";
import { pickEmote } from "../../src/game/emotes.js";
import { Game } from "../../src/game/game.js";
import { LyricSync } from "../../src/game/lyric-sync.js";
import { FieldRenderer } from "../../src/render/field-renderer.js";
import { createFakeContext, createSong, playThrough } from "../helpers/fake-env.js";

const HOSTILE = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "\"'><svg/onload=alert(1)>",
  "${7*7}{{7*7}}",
  "__proto__",
  "constructor",
  String.fromCodePoint(0x202e) + "evil" + String.fromCodePoint(0x202c), // reversed text
  "a" + String.fromCodePoint(0x200b) + "b" + String.fromCodePoint(0x200d) + "c", // invisible characters
  String.fromCharCode(0xd800), // broken character
  String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x1f3b5), // joined emoji
  "\0\x07\x1b[31m",
  "   ",
  "",
  "!!!???…",
  "あ".repeat(500),
  "x".repeat(10_000),
];

function expectBoardIntegrity(g) {
  expect(Number.isFinite(g.score.score)).toBe(true);
  expect(g.score.score).toBeGreaterThanOrEqual(0);
  expect(g.board.cells).toHaveLength(g.rows);
  for (const row of g.board.cells) expect(row).toHaveLength(g.cols);
  for (const p of g.pieces) {
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.left + p.shape.w).toBeLessThanOrEqual(g.cols);
    expect(p.chars.length).toBeLessThanOrEqual(p.shape.cells.length);
  }
}

function run(texts, opts, { auto = false } = {}) {
  const g = new Game();
  if (auto) g.toggleAuto();
  playThrough(g, new LyricSync(), createSong(texts, opts));
  return g;
}

describe("hostile lyric text", () => {
  it.each([[false], [true]])("plays a song of hostile strings without throwing (auto=%s)", (auto) => {
    expectBoardIntegrity(run(HOSTILE, {}, { auto }));
  });

  it("draws markup-looking lyrics as plain characters", () => {
    const g = new Game();
    g.setCursor(0);
    g.spawnWord({ text: "<b>", startTime: 1000, endTime: 1300 }, "<b>");
    const { ctx, texts } = createFakeContext();
    const r = new FieldRenderer({ getContext: () => ctx, style: {}, width: 0, height: 0 }, { cols: 8, rows: 12 });
    r.resize(400, 700);
    r.draw({ game: g, preview: null });
    expect(texts.join("")).toContain("<b>");
  });

  it("caps a very long word to the board size", () => {
    const g = new Game();
    const p = g.spawnWord({ text: "長".repeat(5000), startTime: 1000, endTime: 1300 }, "長".repeat(5000));
    expect(p.chars.length).toBe(96);
    expectBoardIntegrity(g);
  });

  it("handles a flood of words with no gap", () => {
    expectBoardIntegrity(run(Array.from({ length: 400 }, (_, i) => `w${i}`), { gap: 1, dur: 1 }));
  });

  it("never puts punctuation on the board, however much there is", () => {
    const g = new Game();
    const sync = new LyricSync();
    playThrough(g, sync, createSong(["!".repeat(5000), "あ!?!?", "「」『』…"]));
    const chars = g.board.cells.flat().filter(Boolean).map((b) => b.char);
    expect(chars).toEqual(["あ"]);
  });

  it("handles words with missing text", () => {
    const g = new Game();
    const sync = new LyricSync();
    const song = createSong(["a", "b", "c"]);
    song.words[0].text = undefined;
    song.words[1].text = null;
    expect(() => playThrough(g, sync, song)).not.toThrow();
  });
});

describe("emote matcher", () => {
  it("returns only known emote names for hostile input", () => {
    for (const t of HOSTILE) {
      const e = pickEmote(t, t);
      expect(e === null || typeof e === "string").toBe(true);
    }
  });

  it("runs in linear time on huge input (no ReDoS)", () => {
    const big = "a".repeat(200_000) + "!";
    const start = performance.now();
    pickEmote(big, big);
    pickEmote(" ".repeat(200_000), "");
    expect(performance.now() - start).toBeLessThan(500);
  });
});
