// click me easter egg on the title screen

export function bindEasterEgg(wrap, button) {
  button.addEventListener("click", () => {
    const open = !wrap.classList.contains("is-open");
    wrap.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
  });
}
