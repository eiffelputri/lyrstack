// browser security rules
// allowed outside sources
//   'unsafe-eval'      used by TextAlive while loading
//   textalive, songle  TextAlive lyric script and API
//   piapro             songs and lyrics
//   https:, blob:      song audio from TextAlive
//   'unsafe-inline'    TextAlive styles
const TEXTALIVE = [
  "https://textalive.jp",
  "https://*.textalive.jp",
  "https://songle.jp",
  "https://*.songle.jp",
];
const PIAPRO = ["https://piapro.jp", "https://*.piapro.jp"];

const directives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-eval'", ...TEXTALIVE],
  "connect-src": ["'self'", ...TEXTALIVE, ...PIAPRO],
  "media-src": ["'self'", "https:", "blob:"],
  "img-src": ["'self'", "data:", "https:"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "font-src": ["'self'", "data:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'none'"],
};

export const CONTENT_SECURITY_POLICY = Object.entries(directives)
  .map(([name, values]) => `${name} ${values.join(" ")}`)
  .join("; ");

// security headers for npm run dev and npm run preview
// CSP goes in a meta tag for GitHub Pages
// no X-Frame-Options because TextAlive opens the app in an iframe
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};
