// Map lyric text (kanji or romaji) to an icon name.
// Shapes drawn in visualizer._drawEmote.

const RULES = [
  { match: /[夜月闇宵晩]/, emote: "moon" },
  { match: /[光日朝陽輝煌]/, emote: "spark" },
  { match: /星/, emote: "star" },
  { match: /[火炎燃焼熱]/, emote: "flame" },
  { match: /[水雨涙海雫露]/, emote: "drop" },
  { match: /[風空雲翼]/, emote: "swirl" },
  { match: /[心愛恋胸魂]/, emote: "heart" },
  { match: /[雷電強力激]/, emote: "bolt" },
  { match: /[爆破壊砕崩]/, emote: "fracture" },
  { match: /[未来明日先進]/, emote: "arrow_fwd" },
  { match: /[過去昔戻]/, emote: "arrow_back" },
  { match: /[夢眠]/, emote: "cloud" },
  { match: /[叫声歌唱響鳴音]/, emote: "wave" },
  { match: /[見眼目]/, emote: "eye" },
  { match: /[終死消]/, emote: "warning" },
  { match: /[始初新]/, emote: "triangle" },

  // romaji / english fallbacks
  { match: /\b(take|over|control|domin)/i, emote: "fracture" },
  { match: /\b(night|dark|moon)/i, emote: "moon" },
  { match: /\b(light|sun|shine|bright)/i, emote: "spark" },
  { match: /\b(fire|burn|flame)/i, emote: "flame" },
  { match: /\b(rain|cry|tear|water)/i, emote: "drop" },
  { match: /\b(wind|sky|fly)/i, emote: "swirl" },
  { match: /\b(love|heart|soul)/i, emote: "heart" },
  { match: /\b(power|strong|bolt|thunder)/i, emote: "bolt" },
  { match: /\b(break|crash|shatter)/i, emote: "fracture" },
  { match: /\b(future|forward|next)/i, emote: "arrow_fwd" },
  { match: /\b(past|back|before)/i, emote: "arrow_back" },
  { match: /\b(dream|sleep)/i, emote: "cloud" },
  { match: /\b(shout|sing|voice|sound)/i, emote: "wave" },
  { match: /\b(see|eye|watch)/i, emote: "eye" },
  { match: /\b(end|die|gone)/i, emote: "warning" },
  { match: /\b(start|begin|new)/i, emote: "triangle" },
];

export function pickEmote(text, pron = "") {
  const haystack = `${text || ""} ${pron || ""}`;
  for (const r of RULES) {
    if (r.match.test(haystack)) return r.emote;
  }
  return null;
}

export const EMOTES = [
  "moon",
  "spark",
  "star",
  "flame",
  "drop",
  "swirl",
  "heart",
  "bolt",
  "fracture",
  "arrow_fwd",
  "arrow_back",
  "cloud",
  "wave",
  "eye",
  "warning",
  "triangle",
];
