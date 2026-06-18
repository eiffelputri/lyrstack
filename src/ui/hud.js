// score panels next to the board

import { drawMiniBoard, drawNextPiece } from "../render/mini.js";
import { isBetterRank } from "../services/records-store.js";
import { $, el, formatNumber, setText } from "./dom.js";

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--/--";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export class Hud {
  constructor(root = document) {
    this.els = {
      flavorJa: $("#game-flavor-ja", root),
      flavorEn: $("#game-flavor-en", root),
      title: $("#game-song-title", root),
      artist: $("#game-song-artist", root),
      score: $("#score", root),
      rank: $("#rank", root),
      combo: $("#combo", root),
      lines: $("#lines", root),
      nice: $("#nice", root),
      next: $("#next-canvas", root),
      box: $("#box-number", root),
      archives: $("#archive-list", root),
      bestScore: $("#best-score", root),
      bestNew: $("#best-new", root),
      bestRank: $("#best-rank", root),
      bestPlays: $("#best-plays", root),
      history: $("#best-history", root),
    };
    this.lastScore = -1;
    this.savedBest = 0;
    this.savedRank = "";
    this.lastNextKey = null;
    this.lastBox = -1;
  }

  setSong(song) {
    const e = this.els;
    setText(e.flavorJa, song.flavor.ja);
    setText(e.flavorEn, song.flavor.en);
    setText(e.title, song.title);
    setText(e.artist, song.artist);
    this.lastNextKey = null;
    this.lastBox = -1;
  }

  showRecords(rec) {
    const e = this.els;
    this.savedBest = rec.bestScore;
    this.savedRank = rec.bestRank;
    setText(e.bestScore, formatNumber(rec.bestScore));
    e.bestNew.hidden = true;
    setText(e.bestRank, rec.bestRank);
    setText(e.bestPlays, rec.plays);
    const items = rec.history.map((h) =>
      el("li", {}, [
        el("span", { className: "muted", text: shortDate(h.date) }),
        el("span", { text: `${formatNumber(h.score)}${h.rank ? ` ${h.rank}` : ""}` }),
      ])
    );
    if (!items.length) items.push(el("li", { className: "muted", text: "まだ きろくなし" }));
    e.history.replaceChildren(...items);
  }

  update(game, preview) {
    const e = this.els;
    const s = game.score;
    if (s.score !== this.lastScore) {
      setText(e.score, formatNumber(s.score));
      if (s.score > this.lastScore && this.lastScore >= 0) {
        e.score.classList.remove("bump");
        // restart the animation
        void e.score.offsetWidth;
        e.score.classList.add("bump");
        clearTimeout(this.bumpTimer);
        this.bumpTimer = setTimeout(() => e.score.classList.remove("bump"), 120);
      }
      this.lastScore = s.score;
    }
    // MY BEST follows a higher score
    const beating = s.score > this.savedBest;
    setText(e.bestScore, formatNumber(Math.max(this.savedBest, s.score)));
    if (e.bestNew.hidden === beating) e.bestNew.hidden = !beating;
    // best rank
    const rank = game.rank();
    setText(e.bestRank, isBetterRank(rank, this.savedRank) ? rank : this.savedRank);
    setText(e.rank, rank);
    setText(e.combo, s.maxCombo);
    setText(e.lines, s.lines);
    setText(e.nice, s.nice);

    const nextKey = preview ? `${preview.shape.key}|${preview.chars.join("")}|${preview.color}` : "";
    if (nextKey !== this.lastNextKey) {
      drawNextPiece(e.next, preview);
      this.lastNextKey = nextKey;
    }

    if (game.boxNumber !== this.lastBox) {
      setText(e.box, String(game.boxNumber).padStart(2, "0"));
      this._renderArchives(game.archives);
      this.lastBox = game.boxNumber;
    }
  }

  _renderArchives(archives) {
    if (!archives.length) {
      this.els.archives.replaceChildren(el("p", { className: "archive-empty", text: "あふれた はこは ここに" }));
      return;
    }
    const items = archives.map((a) => {
      const canvas = el("canvas", { attrs: { "aria-hidden": "true" } });
      const item = el("div", { className: "archive-item" }, [canvas, el("span", { text: `BOX ${String(a.box).padStart(2, "0")}` })]);
      return { item, canvas, board: a.board };
    });
    this.els.archives.replaceChildren(...items.map((i) => i.item));
    // draw after layout
    requestAnimationFrame(() => items.forEach((i) => drawMiniBoard(i.canvas, i.board)));
  }

  // redraw on resize
  invalidate() {
    this.lastNextKey = null;
    this.lastBox = -1;
  }
}
