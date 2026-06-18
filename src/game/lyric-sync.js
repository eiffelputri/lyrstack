// matches lyrics to the song position

import { BEAT_FALL_MAX_MS, BEAT_FALL_MIN_MS } from "../config/game.js";
import { pickEmote } from "./emotes.js";

const PUNCT_RE = /[.,!?;:、。，．！？…‥〜～〽"“”()[\]（）「」『』【】]/g;
// keep apostrophes inside words (don't)
const LONE_QUOTE_RE = /(?<!\p{L})['‘’]|['‘’](?!\p{L})/gu;

// strip punctuation from lyrics
export function cleanLyric(text) {
  return String(text ?? "").replace(PUNCT_RE, "").replace(LONE_QUOTE_RE, "").trim();
}

export function beatDistance(player, position) {
  const beat = player?.findBeat?.(position);
  if (!beat) return Infinity;
  return Math.min(Math.abs(position - beat.startTime), Math.abs(beat.endTime - position));
}

// tempo
export function beatStrength(player, position) {
  const beat = player?.findBeat?.(position);
  if (!beat) return 0;
  const len = Math.max(1, beat.endTime - beat.startTime);
  const t = Math.min(1, Math.max(0, (position - beat.startTime) / len));
  return (beat.position === 1 ? 1 : 0.55) * (1 - t);
}

// last beat tolerance
const LAST_BEAT_SLACK_MS = 30;
// allowed delay to hit a beat
const BEAT_GRACE_MS = 200;

// piece delay
export function landingDelay(player, position, word) {
  if (!player?.findBeat) return undefined;
  const from = position + BEAT_FALL_MIN_MS;
  const to = position + BEAT_FALL_MAX_MS;
  const sungUntil = Math.min(word?.endTime ?? NaN, word?.next?.startTime ?? Infinity);
  const end = Math.min(to, Number.isFinite(sungUntil) ? sungUntil + LAST_BEAT_SLACK_MS : from);
  const grace = end + BEAT_GRACE_MS;
  const pick = (times) => {
    const inTime = times.filter((t) => t >= from && t <= end);
    if (inTime.length) return inTime[inTime.length - 1];
    return times.find((t) => t >= from && t > end && t <= grace);
  };
  const full = [];
  const half = [];
  let beat = player.findBeat(from);
  for (let i = 0; beat && i < 24 && beat.startTime <= grace; i++) {
    full.push(beat.startTime);
    half.push((beat.startTime + beat.endTime) / 2);
    const next = player.findBeat(beat.endTime + 1);
    if (!next || next.startTime <= beat.startTime) break;
    beat = next;
  }
  return (pick(full) ?? pick(half) ?? Math.max(from, end)) - position;
}

export class LyricSync {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentWord = null;
    // last word
    this.lastRealWord = null;
    this.lastPosition = undefined;
    this.emote = null;
    this.emoteAt = 0;
  }

  // words that just started
  poll(position, video, audio) {
    const events = [];
    if (!video) return events;

    // when the song jumps
    const lastPos = this.lastPosition;
    this.lastPosition = position;
    if (lastPos !== undefined && Math.abs(position - lastPos) > 500) {
      this.currentWord = null;
      return events;
    }

    // wait while the audio is paused or not ready
    if (audio) {
      if (audio.paused) return events;
      if (position - audio.currentTime * 1000 > 500) return events;
    }

    const w = video.findWord?.(position);
    // exact word start time
    const live = w && position >= w.startTime ? w : null;
    if (live === this.currentWord) return events;

    // catch words skipped in fast parts
    if (this.currentWord && live && live !== this.currentWord.next) {
      let cursor = this.currentWord.next;
      let safety = 16;
      while (cursor && cursor !== live && safety-- > 0) {
        this._emit(cursor, position, events);
        cursor = cursor.next;
      }
    }

    this.currentWord = live;
    if (live) {
      this.lastRealWord = live;
      this._emit(live, position, events);
    } else {
      this.emote = null;
      this.emoteAt = position;
    }
    return events;
  }

  _emit(word, position, events) {
    this.emote = pickEmote(word.text || "", word.pron || "");
    this.emoteAt = position;
    const text = cleanLyric(word.text);
    if (!text) return;
    events.push({ word, text });
  }

  // next word for NEXT
  peekNext(video) {
    if (!video) return null;
    const base = this.currentWord || this.lastRealWord;
    let n = base ? base.next : video.firstWord;
    let guard = 0;
    while (n && guard < 32) {
      const t = cleanLyric(n.text);
      if (t) return n;
      n = n.next;
      guard++;
    }
    return null;
  }
}
