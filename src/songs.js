// Active song: TAKEOVER by Twinfield.
// IDs from the MM2026 support page:
// https://developer.textalive.jp/events/magicalmirai2026/
//
// Use the timestamped piapro URL — short URLs go via songle.jp and CORS-fail.

export const SONG = {
  id: "takeover",
  title: "TAKEOVER",
  artist: "Twinfield",
  award: "Magical Mirai 2026 Song Contest · Runner-Up",
  songUrl: "https://piapro.jp/t/E2i3/20251215092113",
  lyricsUrl: "https://piapro.jp/t/zxWP",
  video: {
    beatId: 4827298,
    chordId: 2963759,
    repetitiveSegmentId: 3086266,
    lyricId: 126533,
    lyricDiffId: 28631,
  },
  palette: { hue: 180, accent: "#39C5BB", highlight: "#FFA940" },
};

// other 5 designated songs — swap SONG above to switch.
// Answer Me (こたえて) chorus timings overlap: see
// https://developer.textalive.jp/events/magicalmirai2026/6W2N_chorus_timings.jsonc
export const ALL_SONGS = [
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
    palette: { hue: 215, accent: "#7aa9ff" },
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
    palette: { hue: 285, accent: "#c084fc" },
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
    palette: { hue: 195, accent: "#5ee2ff" },
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
    palette: { hue: 12, accent: "#ff7a59" },
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
    palette: { hue: 135, accent: "#5cf2a4" },
  },
  SONG,
];
