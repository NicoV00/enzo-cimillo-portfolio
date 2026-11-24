// Lee qué hay detrás de un punto de la pantalla para decidir si el texto de una
// pill de vidrio va oscuro (fondo claro) o blanco (fondo oscuro).
// Orden: data-nav-tone forzado > foto/video (promedio de la zona) > color de fondo
// CSS > color base de la página (el canvas del mapa, ver pageTint.setPageBase).
import { getPageBase, parseColor } from './pageTint';

const SKIP = '.bnav, .bnav-overlay, .mmodal, .mcursor, .pcursor';
const RADIUS = 18; // css px alrededor del punto que se promedian en fotos

let ctx = null;
const getCtx = () => {
  if (!ctx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    ctx = c.getContext('2d', { willReadFrequently: true });
  }
  return ctx;
};

// Color promedio de la zona de una foto o video que cae bajo (x, y), respetando object-fit
const mediaColor = (el, x, y) => {
  const w = el.videoWidth || el.naturalWidth;
  const h = el.videoHeight || el.naturalHeight;
  if (!w || !h || (el.tagName === 'IMG' && !el.complete)) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const fit = getComputedStyle(el).objectFit;
  let sx = w / r.width;
  let sy = h / r.height;
  if (fit === 'cover' || fit === 'contain') {
    sx = sy = fit === 'cover' ? Math.min(w / r.width, h / r.height) : Math.max(w / r.width, h / r.height);
  }
  const ox = (w - r.width * sx) / 2;
  const oy = (h - r.height * sy) / 2;
  const px = Math.max(0, ox + (x - r.left - RADIUS) * sx);
  const py = Math.max(0, oy + (y - r.top - RADIUS) * sy);
  const pw = Math.min(w - px, RADIUS * 2 * sx);
  const ph = Math.min(h - py, RADIUS * 2 * sy);
  if (pw <= 0 || ph <= 0) return null;
  try {
    const c = getCtx();
    c.clearRect(0, 0, 1, 1);
    c.drawImage(el, px, py, pw, ph, 0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data;
    return d[3] > 200 ? { r: d[0], g: d[1], b: d[2], a: 1 } : null;
  } catch {
    ctx = null; // canvas contaminado por una imagen de otro origen: se rehace
    return null;
  }
};

const sampleAt = (x, y) => {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.body || el === document.documentElement) break;
    if (el.closest(SKIP)) continue;
    const forced = el.closest('[data-nav-tone]')?.dataset.navTone;
    if (forced === 'light' || forced === 'dark') return forced;
    if (el.tagName === 'IMG' || el.tagName === 'VIDEO') {
      const c = mediaColor(el, x, y);
      if (c) return c;
      continue;
    }
    const c = parseColor(getComputedStyle(el).backgroundColor);
    if (c && c.a > 0.5) return c;
  }
  return parseColor(getPageBase());
};

// Luminancia relativa (WCAG), 0 negro → 1 blanco
const luminance = ({ r, g, b }) => {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const toneOf = (c, prev) => {
  if (typeof c === 'string') return c;
  if (!c) return prev || 'dark';
  const L = luminance(c);
  if (L > 0.32) return 'light';
  if (L < 0.2) return 'dark';
  return prev || (L > 0.26 ? 'light' : 'dark');
};

// Con histéresis: en fondos medios conserva el tono anterior para no parpadear
export const toneAt = (x, y, prev) => toneOf(sampleAt(x, y), prev);

const toHsl = ({ r, g, b }) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
};

// Fondo de color (no blanco, gris ni negro): la pill pasa al vidrio gris
// esmerilado del panel de búsqueda (ver .pill--glass[data-tint='color'])
const isColored = (c) => {
  if (!c || typeof c === 'string') return false;
  const { s, l } = toHsl(c);
  return s >= 0.16 && l < 0.96 && l > 0.06;
};

const HOLD_MS = 280; // el fondo nuevo tiene que sostenerse este tiempo para cambiar

/**
 * Mantiene data-tone y data-tint en los elementos [data-tone-sample] de `root`.
 * Una sola decisión para toda la nav: se muestrea detrás de cada pill y gana la
 * mayoría, así nunca quedan pills de distinto color una al lado de la otra.
 * El cambio espera HOLD_MS de fondo estable: un borde de foto pasando por
 * debajo al scrollear no la hace parpadear.
 */
export const watchTone = (root) => {
  let raf = 0;
  let state = { tone: null, tint: null };
  let pending = null;
  let pendingSince = 0;

  const apply = (next) => {
    state = next;
    root.querySelectorAll('[data-tone-sample]').forEach((el) => {
      if (el.dataset.tone !== next.tone) el.dataset.tone = next.tone;
      if (el.dataset.tint !== next.tint) el.dataset.tint = next.tint;
    });
  };

  const update = () => {
    raf = 0;
    if (document.hidden) return;
    const els = root.querySelectorAll('[data-tone-sample]');
    let light = 0;
    let colored = 0;
    let n = 0;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const c = sampleAt(r.left + r.width / 2, r.top + r.height / 2);
      if (toneOf(c, state.tone || 'light') === 'light') light += 1;
      if (isColored(c)) colored += 1;
      n += 1;
    });
    if (!n) return;
    const next = {
      tone: light * 2 >= n ? 'light' : 'dark',
      tint: colored * 2 > n ? 'color' : '',
    };
    if (state.tone === null) { apply(next); return; }
    const same = next.tone === state.tone && next.tint === state.tint;
    if (same) { pending = null; return; }
    const now = performance.now();
    const samePending = pending && pending.tone === next.tone && pending.tint === next.tint;
    if (!samePending) { pending = next; pendingSince = now; return; }
    if (now - pendingSince >= HOLD_MS) { pending = null; apply(next); }
  };

  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  const id = setInterval(schedule, 150);
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('wheel', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    cancelAnimationFrame(raf);
    clearInterval(id);
    window.removeEventListener('scroll', schedule, { capture: true });
    window.removeEventListener('wheel', schedule);
    window.removeEventListener('resize', schedule);
  };
};
