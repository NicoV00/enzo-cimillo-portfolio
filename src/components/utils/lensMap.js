// Mapas para la lupa del cursor del menú, con la óptica del liquid glass de iOS
// (basado en glass.outpacestudios.com): centro plano y nítido, y en el bisel la
// refracción real de un vidrio n=1.5 sobre un perfil squircle (ley de Snell).
// Dos pasadas (R = desplazamiento X, G = desplazamiento Y, 128 = nada):
//  - zoom: un solo mapa para los tres canales, con escala chica (ZOOM_SCALE) para
//    que cada escalón de 8 bits mueva ~0.15px: aumento limpio, sin grano ni color.
//  - bezel.r/g/b: solo la refracción del borde, un mapa por canal (dispersión).
//    En el centro valen 128 en los tres: ahí no hay prisma posible.
//  - mask: alpha = cuánto pesa la difusión (0 en el centro, 1 en el borde).
const ZOOM = 0.34;     // aumento de lupa en todo el lente (~1.5x), centro nítido
const BEZEL = 0.38;    // ancho del bisel (fracción del radio): el aro exterior curva
const REFRACT = 0.5;   // cuánto dobla el bisel: fuerte, las letras se estiran en el borde (efecto líquido)
const IOR = 1.5;       // índice de refracción del vidrio
// Dispersión: R dobla un poco más y B un poco menos que G, solo en el bisel.
// Muy baja: un filo de color apenas visible, como el vidrio de iOS, no un arcoíris.
const DISPERSION = 0.035;

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// x: 0 = borde, 1 = donde termina el bisel. Devuelve 0 en el centro, máximo en el borde.
const bend = (x) => {
  const u = 1 - x;
  const slope = u ** 3 / Math.max(1 - u ** 4, 1e-6) ** 0.75; // pendiente del squircle
  const thetaI = Math.atan(slope);
  const thetaT = Math.asin(Math.sin(thetaI) / IOR);
  return Math.sin(thetaI - thetaT);
};
const BEND_MAX = bend(0);

// Armar los mapas es pixel por pixel (~80ms): se hace una sola vez por tamaño y
// se reutiliza. prewarmLensMaps lo adelanta a un momento ocioso de la página,
// así abrir el menú no paga ese costo en el click.
const cache = new Map();

export const buildLensMaps = (size) => {
  if (!cache.has(size)) cache.set(size, computeLensMaps(size));
  return cache.get(size);
};

export const prewarmLensMaps = (size) => {
  if (cache.has(size)) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(() => buildLensMaps(size), { timeout: 4000 });
};

const computeLensMaps = (cssSize) => {
  // El mapa se arma a la densidad de la pantalla: a 1x en un monitor 2x cada valor
  // cubre 4 píxeles reales y el texto aumentado sale en escalera.
  const res = Math.min(Math.max(Math.ceil(window.devicePixelRatio || 1), 1), 3);
  const size = cssSize * res;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // las escalas del filtro van en px CSS
  const R0 = cssSize / 2;
  // escala justa para el desplazamiento máximo de cada pasada (+5% de margen)
  const scales = {
    zoom: Math.ceil(2 * R0 * ZOOM * 1.05),
    bezel: Math.ceil(2 * R0 * REFRACT * (1 + DISPERSION) * 1.05),
  };
  const disp = {
    zoom: ctx.createImageData(size, size),
    r: ctx.createImageData(size, size),
    g: ctx.createImageData(size, size),
    b: ctx.createImageData(size, size),
  };
  const edge = ctx.createImageData(size, size);
  const R = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5 - R;
      const py = y + 0.5 - R;
      const d = Math.hypot(px, py);
      const r = Math.min(d / R, 1);
      let refr = 0;
      if (d > 0 && r < 1) {
        const depth = (1 - r) / BEZEL;
        refr = depth < 1 ? (bend(depth) / BEND_MAX) * smoothstep(1, 0.4, depth) : 0;
      }

      // en el círculo la normal es radial: se muestrea siempre hacia adentro,
      // así nunca lee fuera del lente
      const write = (img, pull, scale) => {
        let vx = 0.5;
        let vy = 0.5;
        if (d > 0 && r < 1 && pull) {
          vx = 0.5 - ((px / d) * pull) / scale;
          vy = 0.5 - ((py / d) * pull) / scale;
        }
        img.data[i] = Math.round(vx * 255);
        img.data[i + 1] = Math.round(vy * 255);
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      };
      // pull en px CSS (R0), igual que las escalas
      write(disp.zoom, R0 * ZOOM * r, scales.zoom);
      write(disp.r, R0 * REFRACT * refr * (1 + DISPERSION), scales.bezel);
      write(disp.g, R0 * REFRACT * refr, scales.bezel);
      write(disp.b, R0 * REFRACT * refr * (1 - DISPERSION), scales.bezel);

      edge.data[i] = 255;
      edge.data[i + 1] = 255;
      edge.data[i + 2] = 255;
      edge.data[i + 3] = smoothstep(0.9, 1, r) * 255;
    }
  }

  const maps = {};
  for (const c of ['zoom', 'r', 'g', 'b']) {
    ctx.putImageData(disp[c], 0, 0);
    maps[c] = canvas.toDataURL();
  }
  ctx.clearRect(0, 0, size, size);
  ctx.putImageData(edge, 0, 0);
  const mask = canvas.toDataURL();
  return { maps, scales, mask };
};
