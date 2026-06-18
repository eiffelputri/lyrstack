// TextAlive token from .env
// this token is visible in the build on purpose
// never put secrets in VITE_ variables

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

const rawToken = import.meta.env.VITE_TEXTALIVE_APP_TOKEN;

export const APP_TOKEN =
  typeof rawToken === "string" && TOKEN_RE.test(rawToken.trim())
    ? rawToken.trim()
    : "";

export const APP_META = {
  name: "LyrStack",
  author: { name: "Eiffel" },
};
