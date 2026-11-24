// Refracción "liquid glass" para la BottomNav.
// Solo Chromium soporta backdrop-filter: url(#svg); el resto usa el blur de fallback del CSS.
export const supportsLiquidGlass = () => {
  if (typeof navigator === 'undefined') return false;
  const brands = navigator.userAgentData?.brands;
  return !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
};

// Distancia con signo a un rectángulo redondeado (negativa adentro)
const sdRoundRect = (x, y, w, h, r) => {
  const px = Math.abs(x - w / 2) - (w / 2 - r);
  const py = Math.abs(y - h / 2) - (h / 2 - r);
  return Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - r;
};

let canvas = null;

/**
 * Mapa de desplazamiento: en el bisel (los `bezel` px junto al borde) cada píxel
 * muestrea hacia adentro siguiendo la normal, como un borde de vidrio convexo.
 * R = desplazamiento X, G = desplazamiento Y (128 = sin desplazamiento).
 */
export const buildDisplacementMap = (w, h, radius, bezel) => {
  canvas = canvas || document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const r = Math.min(radius, w / 2, h / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const sx = x + 0.5;
      const sy = y + 0.5;
      const depth = -sdRoundRect(sx, sy, w, h, r);
      let dx = 0;
      let dy = 0;

      if (depth > 0 && depth < bezel) {
        const gx = sdRoundRect(sx + 1, sy, w, h, r) - sdRoundRect(sx - 1, sy, w, h, r);
        const gy = sdRoundRect(sx, sy + 1, w, h, r) - sdRoundRect(sx, sy - 1, w, h, r);
        const len = Math.hypot(gx, gy) || 1;
        // perfil de superficie circular: fuerte en el borde, nulo al final del bisel
        const t = 1 - depth / bezel;
        const mag = 1 - Math.sqrt(1 - t * t);
        dx = (-gx / len) * mag;
        dy = (-gy / len) * mag;
      }

      data[i] = 128 + dx * 127;
      data[i + 1] = 128 + dy * 127;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
};
