// test doubles

export function createFakeContext() {
  const texts = [];
  const ctx = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          if (key === "fillText") texts.push(String(args[0]));
          if (key === "createLinearGradient" || key === "createRadialGradient") {
            return { addColorStop: () => {} };
          }
          if (key === "measureText") return { width: String(args[0]).length * 8 };
          return undefined;
        };
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    }
  );
  return { ctx, texts };
}

export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

// fake lyrics in TextAlive format
export function createSong(texts, { gap = 400, dur = 300, start = 1000 } = {}) {
  const words = [];
  let t = start;
  for (const text of texts) {
    words.push({ text, pron: "", startTime: t, endTime: t + dur });
    t += gap;
  }
  words.forEach((w, i) => {
    w.next = words[i + 1] ?? null;
  });
  const video = {
    firstWord: words[0] ?? null,
    firstChar: words.length ? {} : null,
    duration: t + 1000,
    findWord: (pos) => words.find((w) => pos >= w.startTime && pos < w.endTime) ?? null,
  };
  return { words, video, endMs: t + 1000 };
}

// play a whole song
export function playThrough(game, sync, song, { stepMs = 16, onTick } = {}) {
  for (let pos = 0; pos < song.endMs; pos += stepMs) {
    for (const ev of sync.poll(pos, song.video, null)) game.spawnWord(ev.word, ev.text);
    game.update(stepMs);
    onTick?.(game, pos);
  }
  // wait for the last pieces
  for (let i = 0; i < 400 && game.pieces.length; i++) game.update(stepMs);
}

// board from text
export function boardRows(board, rows) {
  const offset = board.rows - rows.length;
  rows.forEach((row, i) => {
    [...row].forEach((ch, x) => {
      board.cells[offset + i][x] = ch === "#" ? { char: "x", color: "#fff" } : null;
    });
  });
  return board;
}
