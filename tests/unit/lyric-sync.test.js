import { describe, expect, it } from "vitest";
import { BEAT_FALL_MAX_MS, BEAT_FALL_MIN_MS } from "../../src/config/game.js";
import { LyricSync, beatDistance, beatStrength, cleanLyric, landingDelay } from "../../src/game/lyric-sync.js";
import { createSong } from "../helpers/fake-env.js";

function collect(sync, song, from, to, step = 16, audio = null) {
  const out = [];
  for (let pos = from; pos < to; pos += step) out.push(...sync.poll(pos, song.video, audio));
  return out;
}

describe("LyricSync", () => {
  it("emits each word once, in order", () => {
    const song = createSong(["あ", "い", "う"]);
    const events = collect(new LyricSync(), song, 0, song.endMs);
    expect(events.map((e) => e.text)).toEqual(["あ", "い", "う"]);
  });

  it("skips punctuation-only lyrics and strips punctuation from words", () => {
    const song = createSong(["Aha!", "!", "(yeah)", "「ねえ」？", "…"]);
    const events = collect(new LyricSync(), song, 0, song.endMs);
    expect(events.map((e) => e.text)).toEqual(["Aha", "yeah", "ねえ"]);
  });

  it("catches words skipped by a slow tick", () => {
    const song = createSong(["a", "b", "c", "d"], { gap: 100, dur: 90 });
    const sync = new LyricSync();
    const events = [...sync.poll(1010, song.video, null), ...sync.poll(1310, song.video, null)];
    expect(events.map((e) => e.text)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not replay lyrics after a seek", () => {
    const song = createSong(["a", "b", "c", "d", "e"], { gap: 1000, dur: 900 });
    const sync = new LyricSync();
    collect(sync, song, 0, 1500);
    // jump 3 seconds
    expect(sync.poll(4500, song.video, null)).toEqual([]);
    // after a jump only the current word shows
    expect(sync.poll(4516, song.video, null).map((e) => e.text)).toEqual(["d"]);
  });

  it("stays quiet while the audio element is paused or behind", () => {
    const song = createSong(["a"]);
    const sync = new LyricSync();
    expect(sync.poll(1100, song.video, { paused: true, currentTime: 1.1 })).toEqual([]);
    expect(sync.poll(1116, song.video, { paused: false, currentTime: 0.2 })).toEqual([]);
    expect(sync.poll(1132, song.video, { paused: false, currentTime: 1.13 })).toHaveLength(1);
  });

  it("peekNext skips punctuation and survives gaps", () => {
    const song = createSong(["a", "、", "b"]);
    const sync = new LyricSync();
    expect(sync.peekNext(song.video).text).toBe("a");
    collect(sync, song, 0, 1100);
    expect(sync.peekNext(song.video).text).toBe("b");
    expect(sync.peekNext(null)).toBeNull();
  });

  it("returns nothing without a video", () => {
    expect(new LyricSync().poll(1000, null, null)).toEqual([]);
  });
});

describe("helpers", () => {
  it("cleanLyric trims and drops brackets, quotes and question marks", () => {
    expect(cleanLyric("  (あ)「い」 ")).toBe("あい");
    expect(cleanLyric("『う』？")).toBe("う");
    expect(cleanLyric("Why?")).toBe("Why");
    expect(cleanLyric("「")).toBe("");
    expect(cleanLyric("Hey!!、")).toBe("Hey");
    expect(cleanLyric("'cause don't")).toBe("cause don't");
    expect(cleanLyric("ラ〜ララ…")).toBe("ラララ");
    expect(cleanLyric(undefined)).toBe("");
    expect(cleanLyric(null)).toBe("");
  });

  it("beatDistance / beatStrength", () => {
    const player = { findBeat: () => ({ startTime: 1000, endTime: 1500, position: 1 }) };
    expect(beatDistance(player, 1030)).toBe(30);
    expect(beatDistance(player, 1480)).toBe(20);
    expect(beatDistance({}, 1000)).toBe(Infinity);
    expect(beatStrength(player, 1000)).toBe(1);
    expect(beatStrength(player, 1500)).toBe(0);
    expect(beatStrength(null, 0)).toBe(0);
  });
});

describe("landingDelay", () => {
  // beat every 500 ms
  const player = {
    findBeat: (p) => {
      const s = Math.floor(p / 500) * 500;
      return { startTime: s, endTime: s + 500, position: 1 };
    },
  };
  const at = (word) => landingDelay(player, word.startTime, word) + word.startTime;

  it("lands on the last beat of a long note", () => {
    expect(at({ startTime: 1000, endTime: 3500 })).toBe(3500);
    expect(at({ startTime: 1000, endTime: 3300 })).toBe(3000);
  });

  it("is down before the next word starts", () => {
    expect(at({ startTime: 1000, endTime: 3300, next: { startTime: 2600 } })).toBe(2500);
  });

  it("lands on a beat just after a quick word ends", () => {
    expect(at({ startTime: 1000, endTime: 1400 })).toBe(1500);
  });

  it("falls back to a half beat", () => {
    expect(at({ startTime: 1000, endTime: 1050 })).toBe(1250);
  });

  it("lands as soon as it can when no beat is near", () => {
    // no beat between 1260 and 1330
    expect(at({ startTime: 1010, endTime: 1100 })).toBe(1260);
  });

  it("never lands before the shortest fall time", () => {
    expect(at({ startTime: 1000, endTime: 1100 })).toBe(1000 + BEAT_FALL_MIN_MS);
  });

  it("never waits longer than the longest fall time", () => {
    expect(at({ startTime: 1000, endTime: 9000 }) - 1000).toBeLessThanOrEqual(BEAT_FALL_MAX_MS);
  });

  it("needs a player, and still lands by the word end without beats", () => {
    expect(landingDelay(null, 1000, {})).toBeUndefined();
    expect(landingDelay({ findBeat: () => null }, 1000, { startTime: 1000, endTime: 1100 })).toBe(BEAT_FALL_MIN_MS);
  });
});
