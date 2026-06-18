// TextAlive player setup

import { Player } from "textalive-app-api";
import { APP_META, APP_TOKEN } from "../config/app.js";

export function hasToken() {
  return Boolean(APP_TOKEN);
}

export function createPlayer(mediaElement, listener) {
  const player = new Player({
    app: { token: APP_TOKEN, ...APP_META },
    mediaElement,
    throttleInterval: 16,
  });
  player.addListener(listener);
  return player;
}

export function errorMessage(err) {
  return (err && (err.message || err.code || err.name)) || String(err) || "unknown";
}
