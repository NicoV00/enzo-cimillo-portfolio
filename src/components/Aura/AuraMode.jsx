import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { AURA_IMAGES } from './auraImages';
import { PROJECTS } from '../utils/projects';
import '../glass.css';
import './AuraMode.css';

/*
 * Modo aura (easter egg): todas las fotos de las galerías flotando, con el
 * vidrio y la distorsión del lab "aura" de nicolasvalles.com.
 * Cambios respecto del lab: sin tilt (planos siempre de frente, sin desplazamiento
 * en z ni rotación de cámara), sin blur (todo nítido) y distribución irregular.
 * La distorsión crece hacia las puntas: en cada foto (bordes y esquinas) y en
 * la pantalla (lente en los bordes del viewport).
 */

const BG = [0.039, 0.039, 0.043]; // casi negro: el borde de vidrio se lee mejor

const EFFECT = {
  warp: 0.95,   // curvatura de las fotos hacia los bordes de la pantalla
  fold: 0.6,    // ídem en vertical
  ripple: 0.14, // ondulación suave del borde
  glass: 0.62,  // brillo y refracción del borde de cada foto
  prism: 0.05,  // separación cromática mínima, solo en las puntas
  lens: 0.85,   // lente de pantalla (post): las puntas del viewport se estiran
};

const NAMES = Object.fromEntries(PROJECTS.map((p) => [p.slug, p.name]));

// pseudo-aleatorio con semilla: el mismo layout en cada apertura
const seeded = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Distribución irregular: tamaños variados y muestreo por rechazo con márgenes
// distintos, así quedan zonas densas y huecos (nada de grilla)
function layout(images) {
  const placed = [];
  const FIELD_W = 64;
  const FIELD_H = 40;
  images.forEach((img, i) => {
    const big = seeded(i * 3.1) > 0.82;
    const h = big ? 3.4 + seeded(i + 7) * 1.1 : 1.7 + seeded(i + 11) * 1.3;
    const w = h * (img.w / img.h);
    let best = null;
    for (let t = 0; t < 60; t++) {
      // sesgo hacia el centro, sin forma de grilla
      const rx = (seeded(i * 13.7 + t * 1.9) - 0.5) * 2;
      const ry = (seeded(i * 7.3 + t * 3.3) - 0.5) * 2;
      const x = Math.sign(rx) * Math.pow(Math.abs(rx), 1.25) * FIELD_W * 0.5;
      const y = Math.sign(ry) * Math.pow(Math.abs(ry), 1.15) * FIELD_H * 0.5;
      const margin = 0.25 + seeded(i * 5.1 + t) * 1.4;
      const hit = placed.some((p) =>
        Math.abs(p.x - x) < (p.w + w) / 2 + margin && Math.abs(p.y - y) < (p.h + h) / 2 + margin);
      if (!hit) { best = { x, y }; break; }
      if (!best) best = { x, y };
    }
    placed.push({ ...best, w, h, z: -seeded(i * 9.7) * 5 });
  });
  return placed;
}

const VERTEX = /* glsl */ `
uniform vec2 shape, screen;
uniform float warp, fold, ripple, phase, amount;
varying vec2 vUv;
void main() {
  vUv = uv;
  float nx = position.x / shape.x, ny = position.y / shape.y;
  // máscara: 0 en el centro de la foto, 1 en bordes y esquinas
  float radial = min(1., length(vec2(nx, ny)) * 1.75);
  float border = clamp((radial - .36) / .55, 0., 1.);
  float mask = border * border * (3. - 2. * border) * amount;
  // cuanto más cerca del borde de la pantalla, más se estira la foto
  float ex = min(1.8, pow(abs(screen.x), 1.5));
  float ey = min(1.8, pow(abs(screen.y), 1.5));
  vec3 p = position;
  p.x += mask * (sin(ny * 3.8 + phase) * .13 * ripple + sign(screen.x) * ex * warp * ny * ny * .58 * shape.y * .45);
  p.y += mask * (sin(nx * 4.4 + phase) * .11 * ripple + sign(screen.y) * ey * fold * nx * nx * .42 * shape.x * .45);
  // sin desplazamiento en z: la foto nunca se inclina
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D image;
uniform vec2 shape;
uniform float radius, glass, prism, phase, amount, reveal, hover;
varying vec2 vUv;
vec3 tex(vec2 uv) { return texture2D(image, clamp(uv, .001, .999)).rgb; }
void main() {
  vec2 p = vUv - .5;
  // el vidrio solo actúa en las puntas: el centro queda intacto y nítido
  float edge = smoothstep(.30, .49, max(abs(p.x), abs(p.y)));
  edge = edge * edge * (3. - 2. * edge) * amount;
  vec2 uv = vUv + vec2(sin(vUv.y * 9. + phase), cos(vUv.x * 8. + phase)) * .015 * glass * edge;
  vec3 c = tex(uv);
  vec2 s = vec2(.012 * prism * edge, 0.);
  c.r = mix(c.r, tex(uv + s).r, min(1., prism * 4.));
  c.b = mix(c.b, tex(uv - s).b, min(1., prism * 4.));
  // rectángulo redondeado + aro de vidrio y destello
  vec2 q = abs(p * shape) - (shape * .5 - radius);
  float extent = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
  float aa = max(fwidth(extent) * 1.2, .001);
  float rim = smoothstep(-.05, -.005, extent);
  float shine = pow(max(0., sin(vUv.x * 4. + vUv.y * 3. + phase)), 14.) * .1 * glass * amount;
  c = mix(c, vec3(.95, .97, .95), (rim * .28 * glass) * amount + shine + hover * .06);
  gl_FragColor = vec4(c, (1. - smoothstep(-aa, aa, extent)) * reveal);
}`;

// Lente de pantalla (del post de aura, sin blur): identidad en el centro,
// estira y separa un poco el color solo hacia las puntas del viewport
const POST_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float lens, ripple, prism;
uniform vec3 bg;
varying vec2 vUv;
void main() {
  vec2 p = vUv - .5;
  vec2 e = pow(abs(p) * 2., vec2(3.));
  vec2 uv = vUv + vec2(-p.x * e.x * .22 * lens + sin(p.y * 9.) * e.x * .026 * ripple,
                       -p.y * e.y * .10 * lens + sin(p.x * 10.) * e.y * .02 * ripple);
  float edge = smoothstep(.08, .72, max(e.x, e.y));
  vec2 sep = vec2(.0035, .001) * prism * 6. * edge;
  vec4 s = texture2D(map, uv);
  s.r = mix(s.r, texture2D(map, uv + sep).r, edge);
  s.b = mix(s.b, texture2D(map, uv - sep).b, edge);
  // el render target está premultiplicado sobre transparente
  gl_FragColor = vec4(s.rgb + bg * (1. - s.a), 1.);
}`;

// Baja cada foto a un tamaño que alcanza para verse nítida (con mipmaps) sin
// llenar la memoria de video: 102 texturas a tamaño original no entran en un celular
function loadTexture(src, maxSide, anisotropy) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = anisotropy;
      tex.generateMipmaps = true;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const AuraMode = ({ onClose }) => {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const labelRef = useRef(null);
  const [count, setCount] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const mount = mountRef.current;
    const label = labelRef.current;
    const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 150);
    // MSAA en el render target: al pasar por el post se pierde el antialias del canvas
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
    const post = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fx = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: rt.texture },
        lens: { value: 0 },
        ripple: { value: EFFECT.ripple },
        prism: { value: EFFECT.prism },
        bg: { value: new THREE.Vector3(...BG) },
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}',
      fragmentShader: POST_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fx);
    post.add(quad);

    // la distorsión entra suave al abrir (amount 0 → 1)
    const fxState = { amount: 0 };
    gsap.to(fxState, { amount: 1, duration: reduced ? 0 : 1.6, ease: 'power2.inOut', delay: reduced ? 0 : 0.3 });

    const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const maxSide = isMobile ? 640 : 1024;
    const spots = layout(AURA_IMAGES);
    const meshes = [];
    const order = AURA_IMAGES.map((_, i) => i).sort((a, b) => {
      // primero las cercanas al centro: lo que se ve aparece antes
      const da = Math.hypot(spots[a].x, spots[a].y);
      const db = Math.hypot(spots[b].x, spots[b].y);
      return da - db;
    });

    const addMesh = (i, tex) => {
      const s = spots[i];
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          image: { value: tex },
          shape: { value: new THREE.Vector2(s.w, s.h) },
          screen: { value: new THREE.Vector2() },
          radius: { value: 0.08 },
          warp: { value: EFFECT.warp },
          fold: { value: EFFECT.fold },
          ripple: { value: EFFECT.ripple },
          glass: { value: EFFECT.glass },
          prism: { value: EFFECT.prism },
          phase: { value: seeded(i) * 6.28 },
          amount: { value: 0 },
          reveal: { value: 0 },
          hover: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(s.w, s.h, 20, 24);
      geo.computeBoundingSphere();
      geo.boundingSphere.radius *= 1.6; // la distorsión agranda la foto en los bordes
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.x, s.y, s.z);
      // más lejos se dibuja antes (transparencias)
      mesh.renderOrder = Math.round(s.z * 100);
      mesh.userData = { index: i };
      scene.add(mesh);
      meshes.push(mesh);
      gsap.to(mat.uniforms.reveal, { value: 1, duration: reduced ? 0 : 0.9, ease: 'power2.out' });
    };

    // carga en tandas de a 6 para no trabar el hilo principal
    (async () => {
      for (let k = 0; k < order.length && !disposed; k += 6) {
        const batch = order.slice(k, k + 6);
        const texs = await Promise.all(batch.map((i) => loadTexture(AURA_IMAGES[i].src, maxSide, anisotropy)));
        if (disposed) { texs.forEach((t) => t && t.dispose()); return; }
        batch.forEach((i, j) => texs[j] && addMesh(i, texs[j]));
        setCount(meshes.length);
      }
    })();

    // ── cámara: arrastrar para moverse, rueda / pinch para acercarse ──
    const state = { x: 0, y: 0, z: isMobile ? 26 : 20 };
    const goal = { ...state };
    const pointer = new THREE.Vector2(99, 99);
    const ray = new THREE.Raycaster();
    const touches = new Map();
    let down = false;
    let moved = 0;
    let last = { x: 0, y: 0 };
    let pinch = 0;
    let hover = null;
    const clampGoal = () => {
      goal.x = THREE.MathUtils.clamp(goal.x, -30, 30);
      goal.y = THREE.MathUtils.clamp(goal.y, -19, 19);
      goal.z = THREE.MathUtils.clamp(goal.z, 7, 42);
    };

    // el puntero visto a través de la lente: el raycast apunta a lo que se ve
    const refracted = () => {
      const x = pointer.x * 0.5;
      const y = pointer.y * 0.5;
      const ex = Math.pow(Math.abs(x) * 2, 3);
      const ey = Math.pow(Math.abs(y) * 2, 3);
      const l = fx.uniforms.lens.value;
      return new THREE.Vector2(
        pointer.x + 2 * (-x * ex * 0.22 * l),
        pointer.y + 2 * (-y * ey * 0.1 * l),
      );
    };

    const el = renderer.domElement;
    const onDown = (e) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      down = true;
      moved = 0;
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e) => {
      pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      label.style.translate = `${e.clientX + 16}px ${e.clientY + 16}px`;
      if (!down) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        goal.z += (pinch - d) * 0.06;
        pinch = d;
        moved = 100;
        clampGoal();
        return;
      }
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      goal.x -= (dx * state.z) / innerHeight * 0.9;
      goal.y += (dy * state.z) / innerHeight * 0.9;
      clampGoal();
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e) => {
      touches.delete(e.pointerId);
      down = touches.size > 0;
      if (!down && moved < 7) {
        pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        ray.setFromCamera(refracted(), camera);
        const hit = ray.intersectObjects(meshes)[0];
        if (hit) {
          const { slug } = AURA_IMAGES[hit.object.userData.index];
          onCloseRef.current?.();
          navigate(`/gallery/${slug}`);
        }
      }
    };
    const onCancel = () => { down = false; touches.clear(); };
    const onLeave = () => pointer.set(99, 99);
    const onWheel = (e) => {
      e.preventDefault();
      goal.z += e.deltaY * 0.012;
      clampGoal();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });

    const resize = () => {
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      rt.setSize(s.x, s.y);
    };
    addEventListener('resize', resize);
    resize();

    let raf = 0;
    let lastTime = performance.now();
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const frame = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const k = reduced ? 1 : 1 - Math.exp(-7 * dt);
      state.x += (goal.x - state.x) * k;
      state.y += (goal.y - state.y) * k;
      state.z += (goal.z - state.z) * k;
      // sin tilt: la cámara solo se traslada, nunca rota
      camera.position.set(state.x, state.y, state.z);
      camera.updateMatrixWorld();

      const amount = fxState.amount;
      fx.uniforms.lens.value = EFFECT.lens * amount;
      for (const m of meshes) {
        const depth = state.z - m.position.z;
        const u = m.material.uniforms;
        u.screen.value.set(
          (m.position.x - state.x) / (depth * halfFov * camera.aspect),
          (m.position.y - state.y) / (depth * halfFov),
        );
        u.amount.value = amount;
      }

      ray.setFromCamera(refracted(), camera);
      const hit = down ? null : ray.intersectObjects(meshes)[0]?.object || null;
      if (hit !== hover) {
        if (hover) gsap.to(hover.material.uniforms.hover, { value: 0, duration: 0.3 });
        if (hit) gsap.to(hit.material.uniforms.hover, { value: 1, duration: 0.3 });
        hover = hit;
        if (hit) label.textContent = `${NAMES[AURA_IMAGES[hit.userData.index].slug] || ''} ↗`;
      }
      label.classList.toggle('--on', !!hover);
      el.style.cursor = down ? 'grabbing' : hover ? 'pointer' : 'grab';

      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(post, postCam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    addEventListener('keydown', onKey);

    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: reduced ? 0 : 0.6, ease: 'power2.out' });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKey);
      gsap.killTweensOf(fxState);
      for (const m of meshes) {
        gsap.killTweensOf(m.material.uniforms.reveal);
        gsap.killTweensOf(m.material.uniforms.hover);
        m.geometry.dispose();
        m.material.uniforms.image.value?.dispose();
        m.material.dispose();
      }
      quad.geometry.dispose();
      fx.dispose();
      rt.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [navigate]);

  return (
    <div ref={rootRef} className="aura" role="dialog" aria-label="Aura: todas las fotos">
      <div ref={mountRef} className="aura__stage" />
      <div ref={labelRef} className="aura__label" aria-hidden="true" />
      <div className="aura__top">
        <span className="aura__brand">aura<small>{count} / {AURA_IMAGES.length}</small></span>
        <button type="button" className="g-btn g-dark aura__close" onClick={() => onClose?.()}>
          close
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
          </svg>
        </button>
      </div>
      <p className="aura__hint">
        <span className="--fine">drag · scroll to zoom · click a photo</span>
        <span className="--touch">drag · pinch to zoom · tap a photo</span>
      </p>
    </div>
  );
};

export default AuraMode;
