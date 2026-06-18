// song select screen

import { loadRecords } from "../services/records-store.js";
import { el, formatNumber, svg } from "./dom.js";

function cartonTop() {
  // carton top
  return svg("svg", { class: "carton-top", viewBox: "0 0 100 46", preserveAspectRatio: "none", "aria-hidden": "true" }, [
    svg("rect", { x: "22", y: "2", width: "56", height: "12", rx: "2" }),
    svg("polygon", { points: "2,45 18,14 82,14 98,45" }),
  ]);
}

function cartonFor(song, isLast) {
  const rec = loadRecords(song.id);
  // BEST label
  const best = rec.plays
    ? [el("small", { text: "BEST" }), el("span", { text: `${formatNumber(rec.bestScore)}${rec.bestRank ? ` · ${rec.bestRank}` : ""}` })]
    : [el("span", { text: "NEW" })];

  const button = el("button", {
    className: `carton${isLast ? " is-last" : ""}`,
    attrs: {
      type: "button",
      "data-song": song.id,
      "aria-label": `${song.title} / ${song.artist}${isLast ? " (前回)" : ""}`,
    },
  }, [
    isLast
      ? el("span", { className: "carton-sticker", attrs: { "aria-hidden": "true" } }, [
          document.createTextNode("前回"),
          el("small", { text: "LAST" }),
        ])
      : null,
    cartonTop(),
    el("span", { className: "carton-body" }, [
      el("span", { className: "carton-flavor" }, [
        document.createTextNode(song.flavor.ja),
        el("small", { text: song.flavor.en }),
      ]),
      el("span", { className: "carton-label" }, [
        el("span", { className: "carton-title", text: song.title }),
        el("span", { className: "carton-artist", text: song.artist }),
      ]),
      el("span", { className: "carton-meta" }, [
        el("span", { className: "carton-award", text: song.award }),
        el("span", { className: "carton-best" }, best),
      ]),
    ]),
  ]);
  button.style.setProperty("--c", song.flavor.color);
  button.style.setProperty("--d", song.flavor.deep);
  return el("li", {}, [button]);
}

// milk boxes and flavours
export function renderSongList(list, songs, { lastSongId, onPick }) {
  list.replaceChildren(...songs.map((s) => cartonFor(s, s.id === lastSongId)));
  list.onclick = (e) => {
    const button = e.target.closest("[data-song]");
    if (!button) return;
    const song = songs.find((s) => s.id === button.dataset.song);
    if (song) onPick(song);
  };
  const focusTarget = list.querySelector(".is-last") || list.querySelector("button");
  focusTarget?.focus({ preventScroll: true });
}
