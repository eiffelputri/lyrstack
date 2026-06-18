// DOM helpers

const SVG_NS = "http://www.w3.org/2000/svg";

export function $(selector, root = document) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`missing element: ${selector}`);
  return node;
}

export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) if (child) node.append(child);
  return node;
}

export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

// update only when the value changes
export function setText(node, value) {
  const s = String(value);
  if (node.textContent !== s) node.textContent = s;
}

export function formatNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

export function openDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

export function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}
