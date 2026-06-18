// @vitest-environment jsdom
// whole app test
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeContext } from "../helpers/fake-env.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const XSS = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';

const h = vi.hoisted(() => ({ players: [] }));

vi.mock("textalive-app-api", () => ({
  Player: class {
    constructor(opts) {
      this.opts = opts;
      this.video = null;
      this.createFromSongUrl = vi.fn(async () => {});
      this.requestPlay = vi.fn();
      this.requestPause = vi.fn();
      this.requestStop = vi.fn();
      this.requestMediaSeek = vi.fn();
      this.findBeat = () => null;
      h.players.push(this);
    }
    addListener(l) {
      this.listener = l;
    }
  },
}));

let startApp;

beforeAll(async () => {
  vi.stubEnv("VITE_TEXTALIVE_APP_TOKEN", "TestToken12345");
  HTMLCanvasElement.prototype.getContext = function () {
    return createFakeContext().ctx;
  };
  ({ startApp } = await import("../../src/app/controller.js"));
});

function mountPage() {
  const page = new DOMParser().parseFromString(HTML, "text/html");
  page.querySelectorAll("script").forEach((s) => s.remove());
  document.body.replaceWith(document.importNode(page.body, true));
}

let app;
let player;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  mountPage();
  app = startApp(document);
  player = h.players.at(-1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.__pwned;
});

const $ = (s) => document.querySelector(s);
const key = (code, target = window, extra = {}) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true, ...extra }));

function openSelect() {
  $("#btn-start").click();
  return [...document.querySelectorAll("#song-list [data-song]")];
}

function loadAndReady(songId = "takeover") {
  openSelect();
  document.querySelector(`[data-song="${songId}"]`).click();
  player.video = { duration: 200_000, firstWord: null, findWord: () => null };
  player.listener.onVideoReady(player.video);
  player.listener.onTimerReady();
}

describe("app flow", () => {
  it("passes the env token (not a hard-coded one) to TextAlive", () => {
    expect(player.opts.app.token).toBe("TestToken12345");
  });

  it("title to song select lists the 6 contest songs", () => {
    const cartons = openSelect();
    expect(document.body.dataset.screen).toBe("select");
    expect(cartons).toHaveLength(6);
    expect(cartons[0].textContent).toContain("TAKEOVER");
  });

  it("picking a song loads only its https piapro URL", () => {
    openSelect();
    document.querySelector('[data-song="answer-me"]').click();
    expect(document.body.dataset.screen).toBe("game");
    expect(player.createFromSongUrl).toHaveBeenCalledTimes(1);
    const [url, opts] = player.createFromSongUrl.mock.calls[0];
    expect(url).toMatch(/^https:\/\/piapro\.jp\/t\//);
    expect(opts.video.lyricId).toBeTypeOf("number");
    expect($("#loading").hidden).toBe(false);
  });

  it("host-managed mode skips the song select", () => {
    player.listener.onAppReady({ managed: true });
    $("#btn-start").click();
    expect(document.body.dataset.screen).not.toBe("select");
  });
});

describe("text only, never HTML", () => {
  it("renders TextAlive error messages as text", () => {
    player.listener.onError({ message: XSS });
    expect($("#loading-text").textContent).toContain(XSS);
    expect(document.querySelector("#loading img, #loading script")).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  it("copes with errors that have no message", () => {
    expect(() => player.listener.onError(undefined)).not.toThrow();
    expect(() => player.listener.onError({})).not.toThrow();
  });

  it("tampered records show up sanitized on the select screen and HUD", () => {
    localStorage.setItem(
      "lyrstack.v2.takeover",
      JSON.stringify({ bestScore: XSS, bestRank: XSS, plays: 3, history: [{ date: XSS, score: 1 }] })
    );
    const cartons = openSelect();
    expect(cartons[0].querySelector("img, script")).toBeNull();
    expect(cartons[0].textContent).not.toContain("onerror");
    cartons[0].click();
    expect($("#best-rank").textContent).toBe("");
    expect($("#best-history").querySelector("img, script")).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  it("song select renders hostile song data as text", async () => {
    const { renderSongList } = await import("../../src/ui/song-select.js");
    const list = document.createElement("ul");
    const evil = {
      id: "evil",
      title: XSS,
      artist: XSS,
      award: XSS,
      flavor: { ja: XSS, en: XSS, color: "red;background:url(javascript:alert(1))", deep: "#000" },
    };
    renderSongList(list, [evil], { lastSongId: null, onPick: () => {} });
    expect(list.querySelector("img, script")).toBeNull();
    expect(list.textContent).toContain("<img");
    expect(window.__pwned).toBeUndefined();
  });
});

describe("input scope", () => {
  it("game keys do nothing outside the game screen", () => {
    openSelect();
    key("KeyA");
    key("Space");
    expect(app.game.cursorCol).toBe(4);
    expect(player.requestPlay).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while typing in a form field", () => {
    loadAndReady();
    const input = document.createElement("input");
    document.body.appendChild(input);
    key("KeyA", input);
    key("Space", input);
    expect(app.game.cursorCol).toBe(4);
    expect(player.requestPlay).not.toHaveBeenCalled();
  });

  it("maps home-row keys to columns 0-7 and arrows move by one", () => {
    loadAndReady();
    const cols = [];
    for (const code of ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"]) {
      key(code);
      cols.push(app.game.cursorCol);
    }
    expect(cols).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    key("ArrowRight");
    expect(app.game.cursorCol).toBe(7);
    key("ArrowLeft");
    expect(app.game.cursorCol).toBe(6);
  });

  it("Space plays once the song is ready; M toggles AUTO", () => {
    loadAndReady();
    key("Space");
    expect(player.requestPlay).toHaveBeenCalledTimes(1);
    key("KeyM");
    expect(app.game.autoMode).toBe(true);
    expect($("#btn-auto").getAttribute("aria-pressed")).toBe("true");
  });

  it("restart resets the board and seeks to 0", () => {
    loadAndReady();
    $("#btn-restart").click();
    expect(player.requestMediaSeek).toHaveBeenCalledWith(0);
  });
});

describe("start hint + live best", () => {
  const frame = () => vi.advanceTimersByTime(40);
  const hint = () => !$("#field-hint").hidden;

  it("is hidden while loading, then stays until the player presses play", () => {
    openSelect();
    document.querySelector(`[data-song="takeover"]`).click();
    frame();
    expect(hint()).toBe(false); // still loading
    player.video = { duration: 200_000, firstWord: null, findWord: () => null };
    player.listener.onVideoReady(player.video);
    player.listener.onTimerReady();
    frame();
    expect(hint()).toBe(true);
    // TextAlive plays and pauses by itself while loading
    player.listener.onPlay();
    frame();
    player.listener.onPause();
    frame();
    expect(hint()).toBe(true);
    // player starts the song
    key("Space");
    player.listener.onPlay();
    frame();
    expect(hint()).toBe(false);
  });

  it("does not come back when restarting mid-song", () => {
    loadAndReady();
    key("Space");
    player.listener.onPlay();
    frame();
    $("#btn-restart").click();
    frame();
    expect(hint()).toBe(false);
  });

  it("comes back after restarting while paused", () => {
    loadAndReady();
    key("Space");
    player.listener.onPlay();
    player.listener.onPause();
    $("#btn-restart").click();
    frame();
    expect(hint()).toBe(true);
  });

  it("MY BEST follows the current score once it beats the record", () => {
    localStorage.setItem("lyrstack.v2.takeover", JSON.stringify({ bestScore: 500, plays: 1 }));
    loadAndReady();
    frame();
    expect($("#best-score").textContent).toBe("500");
    expect($("#best-new").hidden).toBe(true);
    app.game.score.score = 1234;
    frame();
    expect($("#best-score").textContent).toBe("1,234");
    expect($("#best-new").hidden).toBe(false);
  });

  it("shows the highest combo of the run, not the current one", () => {
    loadAndReady();
    app.game.score.maxCombo = 3;
    app.game.score.combo = 0;
    frame();
    expect($("#combo").textContent).toBe("3");
  });

  it("MY BEST shows this run's rank once it is better than the saved one", () => {
    localStorage.setItem("lyrstack.v2.takeover", JSON.stringify({ bestScore: 500, bestRank: "B", plays: 1 }));
    loadAndReady();
    frame();
    expect($("#best-rank").textContent).toBe("B");
    app.game.rank = () => "A";
    frame();
    expect($("#best-rank").textContent).toBe("A");
    expect($("#rank").textContent).toBe("A");
    app.game.rank = () => "C";
    frame();
    expect($("#best-rank").textContent).toBe("B");
  });

  it("closes the run when TextAlive pauses at the very end", () => {
    loadAndReady();
    app.game.spawnWord({ text: "あ", startTime: 1000, endTime: 1200 }, "あ");
    app.state.position = 199_300; // near the end but not closed yet
    player.listener.onPause();
    expect($("#result").open || $("#result").hasAttribute("open")).toBe(true);
    expect(JSON.parse(localStorage.getItem("lyrstack.v2.takeover")).plays).toBe(1);
  });
});

describe("NICE + song end in a real run", () => {
  // fake song
  function song() {
    const words = [];
    for (let i = 0; i < 40; i++) words.push({ text: "あい", startTime: 1000 + i * 700, endTime: 1500 + i * 700 });
    words.forEach((w, i) => (w.next = words[i + 1] ?? null));
    return {
      duration: 40_000,
      firstWord: words[0],
      findWord: (p) => words.find((w) => p >= w.startTime && p < w.endTime) ?? null,
    };
  }

  function start() {
    openSelect();
    document.querySelector('[data-song="takeover"]').click();
    player.findBeat = (pos) => {
      const b = Math.floor(pos / 500) * 500;
      return { startTime: b, endTime: b + 500, position: 1 };
    };
    player.video = song();
    player.listener.onVideoReady(player.video);
    player.listener.onTimerReady();
    key("Space");
    player.listener.onPlay();
  }

  function playTo(ms) {
    let pos = app.state.position;
    while (pos < ms) {
      pos += 16;
      player.listener.onTimeUpdate(pos);
      vi.advanceTimersByTime(16);
    }
  }

  const resultOpen = () => $("#result").open || $("#result").hasAttribute("open");

  it("a drop right on the beat scores NICE, a drop between beats does not", () => {
    start();
    playTo(1020);
    player.listener.onTimeUpdate(1510);
    key("ArrowDown");
    expect(app.game.score.nice).toBe(1);
    playTo(1800);
    player.listener.onTimeUpdate(2250);
    key("ArrowDown");
    expect(app.game.score.nice).toBe(1);
  });

  it("switching AUTO on and off does not stop the song from finishing", () => {
    start();
    playTo(3000);
    key("KeyM");
    playTo(8000);
    key("KeyM");
    playTo(39_900);
    expect(resultOpen()).toBe(true);
  });

  it("finishes from the audio 'ended' event when position updates stopped", () => {
    start();
    playTo(5000);
    const audio = document.createElement("audio");
    $("#media").append(audio);
    audio.dispatchEvent(new Event("ended"));
    expect(resultOpen()).toBe(true);
  });

  it("finishes on pause at the end using the player timer, not a stale position", () => {
    start();
    playTo(5000); // tab goes to the background
    player.timer = { position: 39_990 };
    player.listener.onPause();
    expect(resultOpen()).toBe(true);
  });

  it("a normal pause mid-song does not end the run", () => {
    start();
    playTo(5000);
    player.timer = { position: 5000 };
    player.listener.onPause();
    expect(resultOpen()).toBe(false);
  });
});

describe("easter egg", () => {
  it("the click-me block toggles a note with the maker", () => {
    const open = () => $("#egg-wrap").classList.contains("is-open");
    expect(open()).toBe(false);
    $("#egg").click();
    expect(open()).toBe(true);
    expect($("#egg").getAttribute("aria-expanded")).toBe("true");
    expect($("#egg-msg").textContent).toContain("Eiffel");
    const link = $("#egg-msg a");
    expect(link.href).toBe("https://github.com/eiffelputri");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    // stays open until clicked again
    vi.advanceTimersByTime(10_000);
    expect(open()).toBe(true);
    $("#egg").click();
    expect(open()).toBe(false);
    expect($("#egg").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("missing token", () => {
  it("disables PLAY and explains what to do", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_TEXTALIVE_APP_TOKEN", "");
    const mod = await import("../../src/app/controller.js");
    mountPage();
    mod.startApp(document);
    expect($("#btn-start").disabled).toBe(true);
    expect($("#title-status").textContent).toMatch(/\.env/);
    vi.stubEnv("VITE_TEXTALIVE_APP_TOKEN", "TestToken12345");
  });
});
