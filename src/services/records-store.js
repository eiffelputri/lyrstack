// saves records per song in localStorage
// everything read back is checked

import { RANKS } from "../config/game.js";

const KEY_PREFIX = "lyrstack.v2.";
const LAST_SONG_KEY = "lyrstack.lastSong";
const SONG_ID_RE = /^[a-z0-9-]{1,64}$/;
export const HISTORY_LIMIT = 3;
// max score
const MAX_STAT = 1e9;
// ignore oversized data
const MAX_RAW_LENGTH = 16 * 1024;

const GRADES = RANKS.map((r) => r.grade);
const VALID_RANKS = new Set(GRADES);

// ranks from best to worst
export function isBetterRank(a, b) {
  const ia = GRADES.indexOf(a);
  const ib = GRADES.indexOf(b);
  if (ia < 0) return false;
  return ib < 0 || ia < ib;
}

export function defaultRecords() {
  return {
    bestScore: 0,
    bestRank: "",
    bestCombo: 0,
    plays: 0,
    totalLines: 0,
    totalNice: 0,
    history: [],
  };
}

export function storageKey(songId) {
  const id = typeof songId === "string" && SONG_ID_RE.test(songId) ? songId : "default";
  return KEY_PREFIX + id;
}

function toStat(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_STAT, Math.floor(n));
}

function toRank(v) {
  return typeof v === "string" && VALID_RANKS.has(v) ? v : "";
}

function toHistoryEntry(e) {
  if (!e || typeof e !== "object") return null;
  if (typeof e.date !== "string" || e.date.length > 40) return null;
  if (Number.isNaN(new Date(e.date).getTime())) return null;
  return { date: e.date, score: toStat(e.score), rank: toRank(e.rank) };
}

// rebuilt from scratch to stay safe
export function sanitizeRecords(data) {
  const out = defaultRecords();
  if (!data || typeof data !== "object" || Array.isArray(data)) return out;
  out.bestScore = toStat(data.bestScore);
  out.bestRank = toRank(data.bestRank);
  out.bestCombo = toStat(data.bestCombo);
  out.plays = toStat(data.plays);
  out.totalLines = toStat(data.totalLines);
  out.totalNice = toStat(data.totalNice);
  if (Array.isArray(data.history)) {
    out.history = data.history.slice(0, HISTORY_LIMIT).map(toHistoryEntry).filter(Boolean);
  }
  return out;
}

export function loadRecords(songId, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(storageKey(songId));
    if (!raw || raw.length > MAX_RAW_LENGTH) return defaultRecords();
    return sanitizeRecords(JSON.parse(raw));
  } catch {
    // broken data or storage off
    return defaultRecords();
  }
}

export function saveRecords(songId, data, storage = globalThis.localStorage) {
  try {
    storage.setItem(storageKey(songId), JSON.stringify(sanitizeRecords(data)));
    return true;
  } catch {
    // storage full or off
    return false;
  }
}

// score history
export function recordRun(records, run, now = new Date()) {
  const r = sanitizeRecords(records);
  const score = toStat(run.score);
  const rank = toRank(run.rank);
  const newBest = score > r.bestScore;
  r.plays += 1;
  r.totalLines += toStat(run.lines);
  r.totalNice += toStat(run.nice);
  r.bestCombo = Math.max(r.bestCombo, toStat(run.maxCombo));
  if (newBest) r.bestScore = score;
  if (isBetterRank(rank, r.bestRank)) r.bestRank = rank;
  r.history = [{ date: now.toISOString(), score, rank }, ...r.history].slice(0, HISTORY_LIMIT);
  return { records: r, newBest };
}

export function loadLastSong(storage = globalThis.localStorage) {
  try {
    const id = storage.getItem(LAST_SONG_KEY);
    return typeof id === "string" && SONG_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function saveLastSong(songId, storage = globalThis.localStorage) {
  try {
    if (SONG_ID_RE.test(songId)) storage.setItem(LAST_SONG_KEY, songId);
  } catch {
    // ignore
  }
}
