import { describe, expect, it } from "vitest";
import { BEAT_FALL_MIN_MS } from "../../src/config/game.js";
import { Game } from "../../src/game/game.js";
import { LyricSync, landingDelay } from "../../src/game/lyric-sync.js";
import { boardRows, createSong, playThrough } from "../helpers/fake-env.js";

const word = (text, startTime = 1000, next = null) => ({ text, startTime, endTime: startTime + 300, next });

function settle(game, ms = 5000) {
  for (let t = 0; t < ms && game.pieces.length; t += 16) game.update(16);
}

describe("Game: pieces", () => {
  it("spawns a piece shaped for the word and lands it", () => {
    const g = new Game();
    const p = g.spawnWord(word("鼓動"), "鼓動");
    expect(p.shape.cells).toHaveLength(2);
    expect(p.y).toBeLessThan(0);
    settle(g);
    expect(g.pieces).toHaveLength(0);
    expect(g.board.isEmpty()).toBe(false);
    expect(g.score.score).toBe(10);
  });

  it("puts each character in its own cell, in order", () => {
    const g = new Game();
    g.setCursor(0);
    g.spawnWord(word("Hello"), "Hello");
    settle(g);
    const row = g.board.cells[g.rows - 1].map((b) => b?.char ?? "").join("");
    expect(row.startsWith("Hello")).toBe(true);
  });

  it("aims at the cursor and clamps to the board", () => {
    const g = new Game();
    g.setCursor(99);
    expect(g.cursorCol).toBe(7);
    const p = g.spawnWord(word("TAKEOVER"), "TAKEOVER");
    expect(p.left + p.shape.w).toBeLessThanOrEqual(8);
    g.moveCursor(-100);
    expect(g.cursorCol).toBe(0);
  });

  it("preview matches the piece that actually spawns", () => {
    const g = new Game();
    g.setCursor(3);
    const w = word("未来へ", 4321);
    const pv = g.preview(w);
    const p = g.spawnWord(w, "未来へ");
    expect(p.shape).toBe(pv.shape);
    expect(p.left).toBe(pv.left);
    expect(p.color).toBe(pv.color);
  });

  it("no preview for punctuation or empty words", () => {
    const g = new Game();
    expect(g.preview(word("！"))).toBeNull();
    expect(g.preview(word("  "))).toBeNull();
    expect(g.preview(null)).toBeNull();
  });

  it("pieces in the same column don't overlap while falling", () => {
    const g = new Game();
    g.setCursor(2);
    g.spawnWord(word("あい", 1000), "あい");
    g.spawnWord(word("うえ", 1001), "うえ");
    for (let i = 0; i < 400; i++) {
      g.update(16);
      const cells = new Set();
      for (const p of g.pieces) {
        for (const [dx, dy] of p.shape.cells) {
          const key = `${p.left + dx},${Math.floor(p.y + dy)}`;
          expect(cells.has(key)).toBe(false);
          cells.add(key);
        }
      }
    }
  });
});

describe("Game: rules", () => {
  it("clears a completed row and scores it", () => {
    const g = new Game({ cols: 4, rows: 6 });
    boardRows(g.board, ["###."]);
    g.setCursor(3);
    g.spawnWord(word("字"), "字");
    settle(g);
    expect(g.score.lines).toBe(1);
    expect(g.board.isEmpty()).toBe(true);
    expect(g.score.score).toBe(110);
    expect(g.effects.some((e) => e.type === "clear")).toBe(true);
  });

  it("archives the box and applies the penalty on overflow", () => {
    const g = new Game({ cols: 4, rows: 4 });
    boardRows(g.board, [".###", ".###", ".###", ".###"]);
    g.score.score = 800;
    g.setCursor(1);
    g.spawnWord(word("あい"), "あい");
    settle(g);
    expect(g.boxNumber).toBe(2);
    expect(g.archives).toHaveLength(1);
    expect(g.archives[0].box).toBe(1);
    expect(g.score.score).toBe(300);
    expect(g.board.isEmpty()).toBe(true);
  });

  it("keeps every archived box, newest first", () => {
    const g = new Game({ cols: 2, rows: 2 });
    for (let i = 0; i < 22; i++) {
      boardRows(g.board, ["#.", "#."]);
      g.setCursor(0);
      g.spawnWord(word("あ", 1000 + i), "あ");
      settle(g);
    }
    expect(g.archives).toHaveLength(22);
    expect(g.archives[0].box).toBe(22);
    expect(g.archives.at(-1).box).toBe(1);
    expect(g.boxNumber).toBe(23);
  });

  it("hard drop locks instantly and pays NICE only near a beat", () => {
    const g = new Game();
    g.spawnWord(word("あ"), "あ");
    expect(g.hardDrop(40).nice).toBe(true);
    g.spawnWord(word("い", 2000), "い");
    expect(g.hardDrop(400).nice).toBe(false);
    expect(g.score.nice).toBe(1);
    expect(g.hardDrop(0)).toBeNull(); // nothing falling
  });

  it("AUTO mode never earns NICE", () => {
    const g = new Game();
    g.toggleAuto();
    g.spawnWord(word("あ"), "あ");
    expect(g.hardDrop(0).nice).toBe(false);
  });

  it("reset() clears the run but keeps AUTO / cursor", () => {
    const g = new Game();
    g.toggleAuto();
    g.setCursor(2);
    g.spawnWord(word("あいう"), "あいう");
    settle(g);
    g.reset();
    expect(g.board.isEmpty()).toBe(true);
    expect(g.score.score).toBe(0);
    expect(g.wordsPlayed).toBe(0);
    expect(g.autoMode).toBe(true);
    expect(g.cursorCol).toBe(2);
  });

  it("rank is '-' before any word", () => {
    expect(new Game().rank()).toBe("-");
  });
});

describe("Game: fall speed", () => {
  it("never slams a piece down faster than the minimum fall time", () => {
    const g = new Game();
    const next = { text: "い", startTime: 1010, endTime: 1100, next: null };
    const p = g.spawnWord({ text: "あ", startTime: 1000, endTime: 1010, next }, "あ");
    // 10 ms to the next word
    let ms = 0;
    while (g.pieces.includes(p) && ms < 5000) {
      g.update(16);
      ms += 16;
    }
    expect(ms).toBeGreaterThanOrEqual(500);
  });

  it("keeps at most 12 pieces in the air during a burst", () => {
    const g = new Game();
    for (let i = 0; i < 30; i++) {
      g.spawnWord({ text: "あ", startTime: 1000 + i, endTime: 1001 + i }, "あ");
      expect(g.pieces.length).toBeLessThanOrEqual(12);
    }
    expect(g.wordsPlayed).toBe(30);
  });
});

describe("Game: landing on the beat", () => {
  const beatPlayer = (len) => ({
    findBeat: (p) => {
      const s = Math.floor(p / len) * len;
      return { startTime: s, endTime: s + len, position: 1 };
    },
  });

  it("lands a piece exactly when asked", () => {
    const g = new Game();
    const p = g.spawnWord(word("あ"), "あ", { landIn: 900, beatMs: 450 });
    let ms = 0;
    while (g.pieces.includes(p) && ms < 5000) {
      g.update(16);
      ms += 16;
    }
    expect(Math.abs(ms - 900)).toBeLessThanOrEqual(16);
  });

  // play a song in one column
  function playOneColumn(song, beat) {
    const player = beatPlayer(beat);
    const g = new Game();
    const sync = new LyricSync();
    let pos = 0;
    let maxAir = 0;
    const landings = [];
    const lock = g._lock.bind(g);
    g._lock = (p, o) => {
      landings.push({ at: pos + 16, word: p.word });
      return lock(p, o);
    };
    for (pos = 0; pos < song.endMs; pos += 16) {
      for (const ev of sync.poll(pos, song.video, null)) {
        g.spawnWord(ev.word, ev.text, { landIn: landingDelay(player, pos, ev.word), beatMs: beat });
      }
      g.update(16);
      maxAir = Math.max(maxAir, g.pieces.length);
    }
    return { landings, maxAir };
  }

  // landing delay limit
  const lateLandings = (landings) =>
    landings.filter(({ at, word }) => {
      const sung = Math.min(word.endTime, word.next?.startTime ?? Infinity);
      return at > Math.max(sung + 30 + 200, word.startTime + BEAT_FALL_MIN_MS) + 16;
    });

  it("lands each piece on a beat around the end of its word", () => {
    const beat = 430;
    const texts = Array.from({ length: 40 }, (_, i) => "あいう".slice(0, 1 + (i % 3)));
    const { landings } = playOneColumn(createSong(texts, { gap: 900, dur: 800 }), beat);
    const offBeat = landings.map(({ at }) => Math.abs(at - Math.round(at / beat) * beat)).filter((d) => d > 16);
    expect(landings.length).toBe(40);
    expect(offBeat).toEqual([]);
    expect(lateLandings(landings)).toEqual([]);
  });

  it("brings fast lyrics down without piling up or falling behind", () => {
    const texts = Array.from({ length: 80 }, (_, i) => "あいう".slice(0, 1 + (i % 3)));
    const { landings, maxAir } = playOneColumn(createSong(texts, { gap: 300, dur: 250 }), 430);
    expect(lateLandings(landings)).toEqual([]);
    expect(maxAir).toBeLessThanOrEqual(2);
  });
});

describe("Game: AUTO over a whole song", () => {
  it("clears lines and keeps overflows rare on a dense song", () => {
    const vocab = ["影", "飲み込む", "言葉", "シグナル", "ない", "私", "たち", "この", "世界", "を", "鼓動", "くだらない", "夜", "明日へ"];
    const texts = Array.from({ length: 150 }, (_, i) => vocab[(i * 7) % vocab.length]);
    const g = new Game();
    g.toggleAuto();
    playThrough(g, new LyricSync(), createSong(texts, { gap: 450, dur: 300 }));
    expect(g.wordsPlayed).toBe(150);
    expect(g.score.lines).toBeGreaterThan(15);
    expect(g.score.overflows).toBeLessThanOrEqual(3);
  });
});
