// keyboard and mouse input

// column keys
export const COLUMN_KEYS = {
  KeyA: 0,
  KeyS: 1,
  KeyD: 2,
  KeyF: 3,
  KeyJ: 4,
  KeyK: 5,
  KeyL: 6,
  Semicolon: 7,
};

const TAP_MAX_MOVE_PX = 12;

function isTyping(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable;
}

// handlers
// isActive is true on the game screen
export function bindInput({ canvas, columnAt, handlers, isActive }) {
  function onKeyDown(e) {
    if (!isActive() || isTyping(e.target)) return;
    // let a focused button handle its own keys
    if (e.target?.tagName === "BUTTON" && (e.code === "Space" || e.code === "Enter")) return;

    if (e.code === "Space") handlers.playPause();
    else if (e.code === "ArrowLeft") handlers.moveColumn(-1);
    else if (e.code === "ArrowRight") handlers.moveColumn(1);
    else if (e.code === "ArrowDown" || e.code === "Enter") handlers.drop();
    else if (e.code === "KeyM") handlers.toggleAuto();
    else if (e.key === "?" || (e.code === "Slash" && e.shiftKey)) handlers.help();
    else if (COLUMN_KEYS[e.code] !== undefined) handlers.setColumn(COLUMN_KEYS[e.code]);
    else return;
    e.preventDefault();
  }

  let down = null;

  function aim(e) {
    const rect = canvas.getBoundingClientRect();
    handlers.setColumn(columnAt(e.clientX - rect.left));
  }

  function onPointerMove(e) {
    // aim with mouse or touch
    if (e.pointerType === "mouse" || down) aim(e);
  }

  function onPointerDown(e) {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture?.(e.pointerId);
    aim(e);
  }

  function onPointerUp(e) {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    // click to drop
    if (e.pointerType === "mouse" && moved <= TAP_MAX_MOVE_PX) handlers.drop();
  }

  function onPointerCancel() {
    down = null;
  }

  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
  };
}
