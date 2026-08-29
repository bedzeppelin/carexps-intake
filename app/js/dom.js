// Tiny DOM builders. These exist so screens can be assembled from real
// element nodes rather than innerHTML strings — which matters because the
// patient screen reveals fields as you type, and re-rendering markup mid-
// keystroke would destroy focus and caret position.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') applyStyle(node, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : String(v));
  }
  append(node, children);
  return node;
}

function applyStyle(node, style) {
  for (const [k, v] of Object.entries(style)) {
    if (k.startsWith('--')) node.style.setProperty(k, v);
    else node.style[k] = v;
  }
}

export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const frag = children => append(document.createDocumentFragment(), children);

// Icons are inline SVG rather than the stacked absolutely-positioned divs the
// design prototype used — same shapes, but they scale cleanly and survive a
// font-size change on a tablet.
const SVG = {
  card: `<svg viewBox="0 0 48 36" width="48" height="36" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="46" height="34" rx="7" stroke="currentColor" stroke-width="2"/>
    <circle cx="11.5" cy="11.5" r="5.5" fill="currentColor"/>
    <rect x="20" y="6" width="22" height="3" rx="1.5" fill="currentColor"/>
    <rect x="20" y="13" width="16" height="3" rx="1.5" fill="currentColor" opacity=".6"/>
    <rect x="6" y="23" width="36" height="3" rx="1.5" fill="currentColor" opacity=".4"/></svg>`,
  person: `<svg viewBox="0 0 48 36" width="48" height="36" fill="none" aria-hidden="true">
    <circle cx="24" cy="8" r="7" stroke="currentColor" stroke-width="2"/>
    <path d="M8 35v-8a9 9 0 0 1 9-9h14a9 9 0 0 1 9 9v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  keypad: `<svg viewBox="0 0 48 36" width="48" height="36" aria-hidden="true">
    <g fill="currentColor">
      <rect x="0" y="0" width="14" height="15" rx="3"/><rect x="17" y="0" width="14" height="15" rx="3"/><rect x="34" y="0" width="14" height="15" rx="3"/>
      <rect x="0" y="21" width="14" height="15" rx="3" opacity=".5"/><rect x="17" y="21" width="14" height="15" rx="3" opacity=".5"/><rect x="34" y="21" width="14" height="15" rx="3" opacity=".5"/>
    </g></svg>`,
  nocard: `<svg viewBox="0 0 48 36" width="48" height="36" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="46" height="34" rx="7" stroke="currentColor" stroke-width="2"/>
    <circle cx="11.5" cy="11.5" r="5.5" fill="currentColor" opacity=".5"/>
    <rect x="20" y="6" width="22" height="3" rx="1.5" fill="currentColor" opacity=".5"/>
    <path d="M2 30 46 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  plus: `<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
    <rect x="8" y="0" width="6" height="22" rx="2" fill="currentColor"/>
    <rect x="0" y="8" width="22" height="6" rx="2" fill="currentColor"/></svg>`,
  check: `<svg viewBox="0 0 32 24" width="32" height="24" fill="none" aria-hidden="true">
    <path d="M3 13.5 11.5 21 29 3.5" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

export function icon(name, className) {
  const holder = document.createElement('span');
  holder.innerHTML = SVG[name];
  const svg = holder.firstElementChild;
  if (className) svg.setAttribute('class', className);
  return svg;
}
