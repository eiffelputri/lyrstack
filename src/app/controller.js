// connects every part of the game
// screen order for title, song select, game, result
// skip song select inside the TextAlive page

import { BOARD_COLS, BOARD_ROWS } from "../config/game.js";
import { SONGS } from "../config/songs.js";
import { Game } from "../game/game.js";
import { LyricSync, beatDistance, beatStrength, landingDelay } from "../game/lyric-sync.js";
import { FieldRenderer } from "../render/field-renderer.js";
import {
  loadLastSong,
  loadRecords,
  recordRun,
  saveLastSong,
  saveRecords,
} from "../services/records-store.js";
import { $, closeDialog, formatNumber, openDialog, setText } from "../ui/dom.js";
import { Hud } from "../ui/hud.js";
import { bindEasterEgg } from "../ui/easter-egg.js";
import { bindInput } from "../ui/input.js";
import { renderSongList } from "../ui/song-select.js";
import { createPlayer, errorMessage, hasToken } from "./player.js";

const SCREENS = ["title", "select", "game"];

const START_TEXT = "▶ で スタート";
const NO_LYRICS_TEXT = "かしが よみこめません\nあとで もういちど ためしてね";

export function startApp(root = document) {
  const els = {
    body: root.body,
    screens: Object.fromEntries(SCREENS.map((s) => [s, $(`#screen-${s}`, root)])),
    media: $("#media", root),
    start: $("#btn-start", root),
    titleStatus: $("#title-status", root),
    selectBack: $("#btn-select-back", root),
    songList: $("#song-list", root),
    fieldWrap: $("#field-wrap", root),
    field: $("#field", root),
    hint: $("#field-hint", root),
    menu: $("#btn-menu", root),
    restart: $("#btn-restart", root),
    play: $("#btn-play", root),
    auto: $("#btn-auto", root),
    help: $("#btn-help", root),
    helpDialog: $("#help", root),
    helpClose: $("#btn-help-close", root),
    result: $("#result", root),
    retry: $("#btn-retry", root),
    resultSelect: $("#btn-result-select", root),
    loading: $("#loading", root),
    loadingText: $("#loading-text", root),
  };

  const game = new Game({ cols: BOARD_COLS, rows: BOARD_ROWS });
  const sync = new LyricSync();
  const renderer = new FieldRenderer(els.field, { cols: BOARD_COLS, rows: BOARD_ROWS });
  const hud = new Hud(root);

  const state = {
    screen: "title",
    song: null,
    hostManaged: false,
    appReady: false,
    videoReady: false,
    timerReady: false,
    playing: false,
    // true once the player presses play
    started: false,
    finished: false,
    position: 0,
    duration: 0,
    loadError: false,
    // lyrics came back empty (e.g. piapro is down)
    noLyrics: false,
  };

  // set after the listener is made
  let player = null;
  let appWatchdog = null;

  // screens

  function showScreen(name) {
    state.screen = name;
    els.body.dataset.screen = name;
    for (const [key, node] of Object.entries(els.screens)) node.hidden = key !== name;
    if (name === "game") fitField();
  }

  function applyFlavor(song) {
    const style = root.documentElement.style;
    style.setProperty("--flavor", song.flavor.color);
    style.setProperty("--flavor-deep", song.flavor.deep);
    renderer.setFlavor(song.flavor);
  }

  function openSelect() {
    pause();
    showScreen("select");
    renderSongList(els.songList, SONGS, { lastSongId: loadLastSong(), onPick: pickSong });
  }

  function pickSong(song) {
    saveLastSong(song.id);
    enterGame(song);
    loadSong(song);
  }

  function enterGame(song) {
    state.song = song;
    applyFlavor(song);
    hud.setSong(song);
    hud.showRecords(loadRecords(song.id));
    resetRun();
    showScreen("game");
  }

  // loading

  function showLoading(text) {
    state.loadError = false;
    setText(els.loadingText, text);
    els.loading.hidden = false;
  }

  function hideLoading() {
    els.loading.hidden = true;
  }

  function setTransportEnabled(on) {
    els.play.disabled = !on;
    els.restart.disabled = !on;
  }

  function loadSong(song) {
    if (!player) {
      showLoading("TextAlive のトークンが ありません（.env を確認してね）");
      state.loadError = true;
      return;
    }
    state.videoReady = false;
    state.timerReady = false;
    setNoLyrics(false);
    setTransportEnabled(false);
    try {
      if (player.video) player.requestStop();
    } catch {
      // nothing playing yet
    }
    showLoading(`「${song.title}」を よみこみ中…`);
    player.createFromSongUrl(song.songUrl, { video: song.video || {} }).catch(onError);
  }

  // play and pause

  function resetRun() {
    game.reset();
    sync.reset();
    state.finished = false;
    state.started = false;
    hud.invalidate();
  }

  function playPause() {
    if (!player?.video || !state.timerReady) return;
    if (state.playing) player.requestPause();
    else {
      if (state.finished) restart();
      state.started = true;
      player.requestPlay();
    }
  }

  function pause() {
    if (state.playing) player?.requestPause();
  }

  function restart() {
    if (!player?.video) return;
    resetRun();
    // keep the start hint hidden on restart
    state.started = state.playing;
    player.requestMediaSeek(0);
  }

  function drop() {
    if (!state.playing) return;
    game.hardDrop(beatDistance(player, state.position));
  }

  function toggleAuto() {
    const on = game.toggleAuto();
    els.auto.setAttribute("aria-pressed", String(on));
  }

  function setPlayingUi(playing) {
    state.playing = playing;
    els.play.classList.toggle("is-playing", playing);
    els.play.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  // song end check when TextAlive pauses
  function onPausedOrStopped() {
    setPlayingUi(false);
    checkSongEnd();
  }

  function checkSongEnd() {
    const pos = Math.max(state.position, player?.timer?.position ?? 0);
    if (state.duration > 0 && pos >= state.duration - 1500) finish();
  }

  function finish() {
    if (state.finished || game.wordsPlayed === 0 || !state.song) return;
    state.finished = true;
    pause();
    const s = game.score;
    const run = {
      score: s.score,
      rank: game.rank(),
      lines: s.lines,
      maxCombo: s.maxCombo,
      nice: s.nice,
    };
    const { records, newBest } = recordRun(loadRecords(state.song.id), run);
    saveRecords(state.song.id, records);
    hud.showRecords(records);

    setText($("#result-song", root), `${state.song.title} / ${state.song.artist}`);
    setText($("#result-rank", root), run.rank);
    setText($("#result-score", root), formatNumber(run.score));
    setText($("#result-lines", root), s.lines);
    setText($("#result-combo", root), s.maxCombo);
    setText($("#result-nice", root), s.nice);
    setText($("#result-overflow", root), s.overflows);
    $("#result-newbest", root).hidden = !newBest;
    openDialog(els.result);
  }

  function onAppReady(app) {
    state.appReady = true;
    clearTimeout(appWatchdog);
    state.hostManaged = Boolean(app?.managed);
    setText(els.titleStatus, state.hostManaged ? "ホストの きょくで あそべます" : "");
  }

  function setNoLyrics(on) {
    state.noLyrics = on;
    els.hint.classList.toggle("is-warning", on);
    setText(els.hint, on ? NO_LYRICS_TEXT : START_TEXT);
  }

  function onVideoReady() {
    state.videoReady = true;
    setNoLyrics(!player?.video?.firstWord);
    sync.reset();
    game.reset();
    if (state.hostManaged && !state.song) enterGame(hostSong());
    setText(els.loadingText, "おんがくを よみこみ中…");
  }

  function onTimerReady() {
    state.timerReady = true;
    state.duration = player.video?.duration ?? 0;
    setTransportEnabled(true);
    hideLoading();
  }

  function onTimeUpdate(position) {
    state.position = position;
    // song end check from position
    if (state.duration > 0 && position >= state.duration - 200) finish();
  }

  function onError(err) {
    console.error("[TextAlive]", err);
    state.loadError = true;
    els.loading.hidden = false;
    setText(els.loadingText, `エラー: ${errorMessage(err)}（タップで とじる）`);
  }

  // song picked by the TextAlive page
  function hostSong() {
    const url = player?.data?.song?.permalink || player?.app?.songUrl || "";
    const known = SONGS.find((s) => url && url.startsWith(s.songUrl.split("/").slice(0, 5).join("/")));
    if (known) return known;
    return {
      id: "host",
      title: player?.data?.song?.name || "Song",
      artist: player?.data?.song?.artist?.name || "",
      award: "",
      flavor: SONGS[0].flavor,
    };
  }

  const listener = {
    onAppReady,
    onVideoReady,
    onTimerReady,
    onTimeUpdate,
    onPlay: () => setPlayingUi(true),
    onPause: onPausedOrStopped,
    onStop: onPausedOrStopped,
    onError,
  };

  // message when loading takes too long
  appWatchdog = setTimeout(() => {
    if (state.appReady) return;
    if (!player) return;
    setText(
      els.titleStatus,
      location.protocol === "file:"
        ? "file:// では うごきません。npm run dev で ひらいてね"
        : "TextAlive に せつぞく中…"
    );
  }, 6000);

  setInterval(() => {
    if (els.loading.hidden || state.loadError || state.timerReady) return;
    setText(
      els.loadingText,
      state.videoReady ? "おんがくを よみこみ中…" : "きょくを かいせき中… はじめては 30〜90びょう かかることも"
    );
  }, 8000);

  player = hasToken() ? createPlayer(els.media, listener) : null;
  if (!player) {
    els.start.disabled = true;
    setText(els.titleStatus, "TextAlive のトークンが ありません。.env.example を .env にコピーして設定してね");
  }

  // buttons and events
  // song end check from audio
  els.media.addEventListener("ended", () => finish(), true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.screen === "game") checkSongEnd();
  });
  bindEasterEgg($("#egg-wrap", root), $("#egg", root));

  els.start.addEventListener("click", () => {
    if (state.hostManaged) {
      if (state.song) showScreen("game");
      else showLoading("ホストの きょくを まっています…");
    } else openSelect();
  });
  els.selectBack.addEventListener("click", () => showScreen("title"));
  els.menu.addEventListener("click", () => (state.hostManaged ? showScreen("title") : openSelect()));
  els.play.addEventListener("click", playPause);
  els.restart.addEventListener("click", restart);
  els.auto.addEventListener("click", toggleAuto);
  els.help.addEventListener("click", () => {
    pause();
    openDialog(els.helpDialog);
  });
  els.helpClose.addEventListener("click", () => closeDialog(els.helpDialog));
  els.retry.addEventListener("click", () => {
    closeDialog(els.result);
    restart();
    state.started = true;
    player?.requestPlay();
  });
  els.resultSelect.addEventListener("click", () => {
    closeDialog(els.result);
    state.hostManaged ? showScreen("title") : openSelect();
  });
  els.loading.addEventListener("click", () => {
    if (state.loadError) hideLoading();
  });

  bindInput({
    canvas: els.field,
    columnAt: (x) => renderer.columnAt(x),
    isActive: () => state.screen === "game" && !els.result.open && !els.helpDialog.open,
    handlers: {
      setColumn: (c) => game.setCursor(c),
      moveColumn: (d) => game.moveCursor(d),
      drop,
      playPause,
      toggleAuto,
      help: () => {
        pause();
        openDialog(els.helpDialog);
      },
    },
  });

  function fitField() {
    const w = els.fieldWrap.clientWidth;
    const h = els.fieldWrap.clientHeight;
    if (w > 0 && h > 0) renderer.resize(w, h);
    hud.invalidate();
  }

  if (typeof ResizeObserver === "function") new ResizeObserver(fitField).observe(els.fieldWrap);
  else window.addEventListener("resize", fitField);

  let lastT = performance.now();
  // land pieces on the beat
  function landingOptions(word) {
    const landIn = landingDelay(player, state.position, word);
    const beat = player?.findBeat?.(state.position);
    return { landIn, beatMs: beat ? beat.endTime - beat.startTime : undefined };
  }

  function frame(t) {
    const dt = Math.min(64, Math.max(0, t - lastT));
    lastT = t;
    if (state.screen === "game") {
      const video = player?.video;
      if (state.playing && video) {
        const audio = els.media.querySelector("audio");
        for (const ev of sync.poll(state.position, video, audio)) {
          game.spawnWord(ev.word, ev.text, landingOptions(ev.word));
        }
        game.update(dt);
        // song started outside the game
        if (state.position > 500) state.started = true;
      }
      const preview = state.videoReady ? game.preview(sync.peekNext(video)) : null;
      renderer.draw({
        game,
        preview,
        currentWord: sync.currentWord,
        emote: state.playing ? sync.emote : null,
        beat: state.playing ? beatStrength(player, state.position) : 0,
      });
      hud.update(game, preview);
      // ▶ で スタート stays until the run starts
      const showHint = state.noLyrics || (state.timerReady && !state.started && game.wordsPlayed === 0);
      if (els.hint.hidden === showHint) els.hint.hidden = !showHint;
    }
    requestAnimationFrame(frame);
  }

  showScreen("title");
  requestAnimationFrame(frame);

  return { game, state, player };
}
