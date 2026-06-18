// Magical Mirai 2026 contest songs
// song IDs from this page
// https://developer.textalive.jp/events/magicalmirai2026/
// use the dated piapro URL
// each song has its own milk flavour

export const SONGS = [
  {
    id: "takeover",
    title: "TAKEOVER",
    artist: "Twinfield",
    award: "Runner-Up",
    songUrl: "https://piapro.jp/t/E2i3/20251215092113",
    lyricsUrl: "https://piapro.jp/t/zxWP",
    video: {
      beatId: 4827298,
      chordId: 2963759,
      repetitiveSegmentId: 3086266,
      lyricId: 126533,
      lyricDiffId: 28631,
    },
    flavor: { ja: "ソーダ", en: "SODA", color: "#8FD3EE", deep: "#2F7FA8" },
  },
  {
    id: "answer-me",
    title: "Answer Me",
    artist: "imie",
    award: "Grand Prize",
    songUrl: "https://piapro.jp/t/6W2N/20251215164617",
    lyricsUrl: "https://piapro.jp/t/9o24",
    video: {
      beatId: 4827293,
      chordId: 2963754,
      repetitiveSegmentId: 3086261,
      lyricId: 126519,
      lyricDiffId: 28645,
    },
    flavor: { ja: "いちご", en: "STRAWBERRY", color: "#F6A6B9", deep: "#C4506F" },
  },
  {
    id: "after-the-curtain",
    title: "After The Curtain",
    artist: "Rulmry",
    award: "Runner-Up",
    songUrl: "https://piapro.jp/t/zoqO/20251214200738",
    lyricsUrl: "https://piapro.jp/t/EVO2",
    video: {
      beatId: 4827294,
      chordId: 2963755,
      repetitiveSegmentId: 3086262,
      lyricId: 126591,
      lyricDiffId: 28627,
    },
    flavor: { ja: "ぶどう", en: "GRAPE", color: "#C9B6E8", deep: "#7A58AE" },
  },
  {
    id: "shutter-chance",
    title: "Shutter Chance",
    artist: "Yamiagari",
    award: "Runner-Up",
    songUrl: "https://piapro.jp/t/PNpQ/20251209170719",
    lyricsUrl: "https://piapro.jp/t/wyWv",
    video: {
      beatId: 4827295,
      chordId: 2963756,
      repetitiveSegmentId: 3086263,
      lyricId: 126542,
      lyricDiffId: 28628,
    },
    flavor: { ja: "メロン", en: "MELON", color: "#B7E3A6", deep: "#4E9446" },
  },
  {
    id: "the-last-march-on-earth",
    title: "The Last March on Earth",
    artist: "Natsuyama Yotsugi × Dopam!ne",
    award: "Runner-Up",
    songUrl: "https://piapro.jp/t/B3yJ/20251215061727",
    lyricsUrl: "https://piapro.jp/t/9U-6",
    video: {
      beatId: 4827296,
      chordId: 2963757,
      repetitiveSegmentId: 3086264,
      lyricId: 126594,
      lyricDiffId: 28629,
    },
    flavor: { ja: "バナナ", en: "BANANA", color: "#F9DF8E", deep: "#B58A12" },
  },
  {
    id: "toritsukulogy",
    title: "Toritsukulogy",
    artist: "Tsuruzou",
    award: "Runner-Up",
    songUrl: "https://piapro.jp/t/QBdL/20251215094303",
    lyricsUrl: "https://piapro.jp/t/Nixq",
    video: {
      beatId: 4827297,
      chordId: 2963758,
      repetitiveSegmentId: 3086265,
      lyricId: 126593,
      lyricDiffId: 28630,
    },
    flavor: { ja: "コーヒー", en: "COFFEE", color: "#DDBE9C", deep: "#8A5A36" },
  },
];

export const DEFAULT_SONG_ID = "takeover";

export function findSong(id) {
  return SONGS.find((s) => s.id === id) ?? null;
}

// block colours
export const BLOCK_COLORS = [
  "#F6A6B9", // strawberry
  "#8FD3EE", // soda
  "#B7E3A6", // melon
  "#F9DF8E", // banana
  "#C9B6E8", // grape
  "#FFC39E", // peach
];
