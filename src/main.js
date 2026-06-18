import { Player } from "textalive-app-api";
import { SONG } from "./songs.js";
import { Visualizer } from "./visualizer.js";

const APP_TOKEN = "H6HQbwMszJn1uRTa";

// home-row column jumps: A-F = 0-3, J-; = 4-7
const COLUMN_KEYS = {
  KeyA: 0,
  KeyS: 1,
  KeyD: 2,
  KeyF: 3,
  KeyJ: 4,
  KeyK: 5,
  KeyL: 6,
  Semicolon: 7,
};

const $ = (sel) => document.querySelector(sel);

const els = {
  stage: $("#stage"),
  media: $("#media"),
  loading: $("#loading"),
  loadingText: $("#loading-text"),
  controls: $("#controls"),
  btnPlay: $("#btn-play"),
  btnRewind: $("#btn-rewind"),
  btnJump: $("#btn-jump"),
};

const visualizer = new Visualizer(els.stage);
visualizer.setPalette(SONG.palette);
visualizer.setSongId(SONG.id);

let isPlaying = false;
let videoDurationMs = 0;

const player = new Player({
  app: {
    token: APP_TOKEN,
    name: "LyrStack",
    author: { name: "Eiffel" },
  },
  mediaElement: els.media,
  throttleInterval: 16,
  vocalAmplitudeEnabled: true,
  valenceArousalEnabled: true,
});

player.addListener({
  onAppReady,
  onVideoReady,
  onTimerReady,
  onTimeUpdate,
  onPlay,
  onPause,
  onStop,
  onSeekComplete,
  onError,
});

const stages = { appReady: false, videoReady: false, timerReady: false };

// nicer message when loading hangs (usually file:// or slow song analysis)
const appReadyWatchdog = setTimeout(() => {
  if (els.loading.classList.contains("is-hidden")) return;
  if (stages.appReady) return;
  if (location.protocol === "file:") {
    setLoadingText(
      "TextAlive can't load from file:// — run the dev server (npm run dev) and open http://localhost:5173"
    );
  } else {
    setLoadingText("Connecting to TextAlive…");
  }
}, 6000);

setInterval(() => {
  if (els.loading.classList.contains("is-hidden")) return;
  if (!stages.appReady) return;
  if (stages.timerReady) return;
  setLoadingText(
    !stages.videoReady
      ? "Analyzing the song on TextAlive — first load can take 30–90s…"
      : "Loading audio…"
  );
}, 8000);

function onAppReady(app) {
  stages.appReady = true;
  clearTimeout(appReadyWatchdog);
  if (!app.managed) loadSong();
  if (app.songUrl) setLoadingText("Loading host-provided song…");
}

function onVideoReady(v) {
  stages.videoReady = true;
  visualizer.bindVideo(v);
  els.btnPlay.disabled = false;
  els.btnRewind.disabled = false;
  els.btnJump.disabled = !v.firstChar;
  setLoadingText("Loading audio…");
}

function onTimerReady() {
  stages.timerReady = true;
  videoDurationMs = player.video?.duration ?? 0;
  hideLoading();
}

function onTimeUpdate(positionMs) {
  visualizer.tick(positionMs, player);
  // onStop isn't reliable for natural song-end — detect via position
  if (videoDurationMs > 0 && positionMs >= videoDurationMs - 200) {
    visualizer.finalizeSession();
  }
}

function onPlay() {
  isPlaying = true;
  visualizer.markStarted();
  visualizer.setPaused(false);
  els.btnPlay.classList.add("is-playing");
  els.btnPlay.setAttribute("aria-label", "Pause");
  hideLoading();
}

function onPause() {
  isPlaying = false;
  visualizer.setPaused(true);
  els.btnPlay.classList.remove("is-playing");
  els.btnPlay.setAttribute("aria-label", "Play");
}

function onStop() {
  isPlaying = false;
  visualizer.setPaused(true);
  els.btnPlay.classList.remove("is-playing");
  els.btnPlay.setAttribute("aria-label", "Play");
  // log this run before wiping the field
  visualizer.finalizeSession();
  visualizer.reset();
}

function onSeekComplete() {
  // don't reset here — TextAlive also fires this during pause sync.
  // restart buttons call reset() themselves.
}

function onError(err) {
  console.error("[TextAlive]", err);
  const msg =
    (err && (err.message || err.code || err.name)) || String(err) || "unknown";
  setLoadingText(`Error: ${msg}`);
}

async function loadSong() {
  showLoading(`Loading "${SONG.title}"…`);
  try {
    await player.createFromSongUrl(SONG.songUrl, { video: SONG.video || {} });
  } catch (err) {
    onError(err);
  }
}

function wireControls() {
  els.btnPlay.addEventListener("click", () => {
    if (!player.video) return;
    if (isPlaying) player.requestPause();
    else player.requestPlay();
  });

  // both transport buttons restart from BOX 1
  const restart = () => {
    if (!player.video) return;
    visualizer.reset();
    player.requestMediaSeek(0);
  };
  els.btnRewind.addEventListener("click", restart);
  els.btnJump.addEventListener("click", restart);

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (!player.video) return;
    if (e.code === "Space") {
      e.preventDefault();
      isPlaying ? player.requestPause() : player.requestPlay();
    } else if (e.code === "KeyM") {
      e.preventDefault();
      visualizer.toggleAuto();
    } else if (e.code === "Slash" && e.shiftKey) {
      e.preventDefault();
      visualizer.toggleHelp();
    } else if (COLUMN_KEYS[e.code] !== undefined) {
      e.preventDefault();
      visualizer.setCursorCol(COLUMN_KEYS[e.code]);
    }
  });
}

function wireCanvasInteractivity() {
  els.stage.addEventListener("mousemove", (e) => {
    const rect = els.stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    visualizer.setMousePosition(x, y);
  });

  els.stage.addEventListener("mouseleave", () => {
    visualizer.clearMousePosition();
  });
}

function showLoading(text) {
  if (text) setLoadingText(text);
  els.loading.classList.remove("is-hidden");
}
function hideLoading() {
  els.loading.classList.add("is-hidden");
}
function setLoadingText(text) {
  els.loadingText.textContent = text;
}

wireControls();
wireCanvasInteractivity();
visualizer.start();
