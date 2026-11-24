// Color de las barras de Safari iOS (status bar arriba, toolbar abajo).
// Safari 26 ignora theme-color y el fondo de html/body cambiado en vivo: tiñe cada barra
// con el fondo de un elemento position:fixed que toque ese borde (por eso Maison, con su
// cinta DLST fija arriba, se veía bien y el resto quedaba con el color anterior).
// Entonces: dos tiras fijas de 2px, una arriba y otra abajo, pintadas con el color que
// realmente hay en ese borde (fondo de la galería, aunque cambie con el scroll), o con
// `base` cuando debajo no hay fondo CSS (el canvas del mapa). Encima se mezclan los velos
// del menú/búsqueda para que las barras se oscurezcan con ellos.

let base = '#ffffff';
const overlays = new Map(); // id -> { r, g, b, a }
let strips = null;
let timer = null;

export const parseColor = (c) => {
  if (!c) return null;
  if (c.startsWith('#')) {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const [r, g, b, a = 1] = (c.match(/[\d.]+/g) || []).map(Number);
  return { r, g, b, a };
};

const blend = ({ r, g, b }) => {
  overlays.forEach((o) => {
    r = r * (1 - o.a) + o.r * o.a;
    g = g * (1 - o.a) + o.g * o.a;
    b = b * (1 - o.a) + o.b * o.a;
  });
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
};

// Primer fondo opaco debajo de (x, y), salteando las tiras, los velos y html/body
const sampleAt = (y) => {
  const x = window.innerWidth / 2;
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el === document.body || el === document.documentElement) break;
    if (strips?.includes(el) || el.closest('.mmodal, .bnav-overlay, .bnav')) continue;
    const c = parseColor(getComputedStyle(el).backgroundColor);
    if (c && c.a > 0.85) return c;
  }
  return parseColor(base);
};

const makeStrip = (edge) => {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;left:0;right:0;${edge}:0;height:2px;z-index:2147483647;pointer-events:none;`;
  document.body.appendChild(el);
  return el;
};

const apply = () => {
  if (!strips) strips = [makeStrip('top'), makeStrip('bottom')];
  const top = blend(sampleAt(3));
  const bottom = blend(sampleAt(window.innerHeight - 3));
  if (strips[0].style.backgroundColor !== top) strips[0].style.backgroundColor = top;
  if (strips[1].style.backgroundColor !== bottom) strips[1].style.backgroundColor = bottom;
  // Fallback para navegadores que sí leen estas fuentes (Safari viejo, Chrome Android)
  const meta = document.querySelector('meta[name="theme-color"]') || (() => {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    document.head.appendChild(m);
    return m;
  })();
  meta.setAttribute('content', top);
  document.documentElement.style.backgroundColor = bottom;
};

// Los fondos de varias galerías cambian con el scroll: re-muestrear seguido es barato
const ensureLoop = () => {
  if (timer) return;
  timer = setInterval(() => { if (!document.hidden) apply(); }, 250);
};

export const getPageBase = () => base;

export const setPageBase = (color) => {
  base = color || '#ffffff';
  apply();
  ensureLoop();
};

// color en rgba(...), p. ej. el velo oscuro del modal
export const setPageOverlay = (id, color) => {
  if (color) overlays.set(id, parseColor(color));
  else overlays.delete(id);
  apply();
  ensureLoop();
};
