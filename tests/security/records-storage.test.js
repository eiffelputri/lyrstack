// localStorage test
import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  defaultRecords,
  isBetterRank,
  loadLastSong,
  loadRecords,
  recordRun,
  sanitizeRecords,
  saveLastSong,
  saveRecords,
  storageKey,
} from "../../src/services/records-store.js";
import { createMemoryStorage } from "../helpers/fake-env.js";

const KEY = storageKey("takeover");
const loadRaw = (raw) => loadRecords("takeover", createMemoryStorage({ [KEY]: raw }));

describe("records: tampered data", () => {
  it("returns defaults for corrupt JSON", () => {
    expect(loadRaw("{not json")).toEqual(defaultRecords());
    expect(loadRaw("")).toEqual(defaultRecords());
  });

  it.each([["null"], ["[]"], ['"str"'], ["42"], ["true"]])("returns defaults for non-object JSON %s", (raw) => {
    expect(loadRaw(raw)).toEqual(defaultRecords());
  });

  it("does not pollute Object.prototype via __proto__ / constructor", () => {
    const out = loadRaw(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted2":true}},"bestScore":5}'
    );
    expect({}.polluted).toBeUndefined();
    expect({}.polluted2).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(out, "__proto__")).toBe(false);
    expect(out.bestScore).toBe(5);
  });

  it("drops unknown keys", () => {
    const out = loadRaw('{"bestScore":1,"evil":"<script>","toString":"x"}');
    expect(Object.keys(out).sort()).toEqual(Object.keys(defaultRecords()).sort());
  });

  it("coerces stats to bounded non-negative integers", () => {
    const out = loadRaw(
      JSON.stringify({
        bestScore: "<img src=x onerror=alert(1)>",
        bestCombo: -50,
        plays: 1e308,
        totalLines: "12",
        totalNice: { valueOf: 1 },
      })
    );
    expect(out.bestScore).toBe(0);
    expect(out.bestCombo).toBe(0);
    expect(Number.isSafeInteger(out.plays)).toBe(true);
    expect(out.plays).toBeLessThanOrEqual(1e9);
    expect(out.totalLines).toBe(12);
    expect(out.totalNice).toBe(0);
  });

  it("only accepts real rank grades", () => {
    expect(loadRaw('{"bestRank":"S"}').bestRank).toBe("S");
    expect(loadRaw('{"bestRank":"<b>S</b>"}').bestRank).toBe("");
    expect(loadRaw('{"bestRank":["S"]}').bestRank).toBe("");
  });

  it("caps and validates history", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      date: new Date(2026, 0, 1 + i).toISOString(),
      score: i,
      rank: "A",
    }));
    expect(loadRaw(JSON.stringify({ history: many })).history).toHaveLength(HISTORY_LIMIT);

    const bad = loadRaw(
      JSON.stringify({
        history: [null, "x", { date: "nope", score: 1 }, { date: "x".repeat(10_000) }, { date: 1 }],
      })
    );
    expect(bad.history).toEqual([]);
    expect(loadRaw('{"history":{"length":3}}').history).toEqual([]);
  });

  it("ignores oversized payloads without parsing them", () => {
    expect(loadRaw(JSON.stringify({ bestScore: 9, pad: "a".repeat(100_000) }))).toEqual(defaultRecords());
  });

  it("survives storage that throws (private mode / disabled)", () => {
    const throwing = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadRecords("takeover", throwing)).toEqual(defaultRecords());
    expect(saveRecords("takeover", defaultRecords(), throwing)).toBe(false);
    expect(loadLastSong(throwing)).toBeNull();
    expect(() => saveLastSong("takeover", throwing)).not.toThrow();
  });

  it("only writes sanitized data back", () => {
    const storage = createMemoryStorage();
    saveRecords("takeover", { ...defaultRecords(), bestScore: 10, injected: "x" }, storage);
    const written = JSON.parse(storage.getItem(KEY));
    expect(written.injected).toBeUndefined();
    expect(written.bestScore).toBe(10);
  });
});

describe("records: keys", () => {
  it.each([[undefined], [null], [""], ["../../etc"], ["a".repeat(200)], ["TAKEOVER"], [{ toString: () => "x" }]])(
    "falls back to the default key for unsafe song id %s",
    (id) => {
      expect(storageKey(id)).toBe("lyrstack.v2.default");
    }
  );

  it("last-song only stores and returns safe ids", () => {
    const storage = createMemoryStorage();
    saveLastSong("<script>", storage);
    expect(storage.map.size).toBe(0);
    storage.setItem("lyrstack.lastSong", "javascript:alert(1)");
    expect(loadLastSong(storage)).toBeNull();
    saveLastSong("answer-me", storage);
    expect(loadLastSong(storage)).toBe("answer-me");
  });
});

describe("recordRun", () => {
  it("folds a run into the records", () => {
    const now = new Date("2026-09-25T10:00:00Z");
    const first = recordRun(defaultRecords(), { score: 1200, rank: "B", lines: 7, maxCombo: 2, nice: 9 }, now);
    expect(first.newBest).toBe(true);
    expect(first.records).toMatchObject({ bestScore: 1200, bestRank: "B", plays: 1, totalLines: 7, totalNice: 9, bestCombo: 2 });

    const second = recordRun(first.records, { score: 900, rank: "A", lines: 1, maxCombo: 1, nice: 0 }, now);
    expect(second.newBest).toBe(false);
    expect(second.records.bestScore).toBe(1200);
    expect(second.records.bestRank).toBe("A");
    expect(second.records.history.map((h) => h.score)).toEqual([900, 1200]);
  });

  it("ignores hostile run values", () => {
    const { records } = recordRun(defaultRecords(), { score: "1e999", rank: "<i>", lines: -4, maxCombo: NaN });
    expect(records).toMatchObject({ bestScore: 0, bestRank: "", totalLines: 0, bestCombo: 0 });
  });

  it("rank ordering", () => {
    expect(isBetterRank("S", "A")).toBe(true);
    expect(isBetterRank("C", "B")).toBe(false);
    expect(isBetterRank("D", "")).toBe(true);
    expect(isBetterRank("", "D")).toBe(false);
  });

  it("returns fresh objects", () => {
    const input = defaultRecords();
    const out = sanitizeRecords(input);
    expect(out).not.toBe(input);
    expect(out.history).not.toBe(input.history);
  });
});
