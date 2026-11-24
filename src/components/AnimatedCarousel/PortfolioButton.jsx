import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import '../glass.css';
import './PortfolioButton.css';

const X_SVG = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9"/></svg>';

// Puntero compartido entre montajes: el botón se monta con la imagen ya
// centrada y tiene que saber dónde está el mouse sin esperar a que se mueva
const pointer = { x: -1, y: -1, known: false, target: null };
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.known = true;
    pointer.target = e.target;
  }, { passive: true });
}

// Un solo par de cursores para toda la página, con conteo de quién los usa:
// cambiar de foto monta un botón y desmonta otro, y ninguno borra los del otro
const shared = { users: 0, enter: null, x: null, mode: 'none' };

const acquireCursors = () => {
  shared.users += 1;
  if (shared.enter) return;
  const enter = document.createElement('div');
  enter.className = 'pcursor pcursor--enter g-dark g-light';
  enter.textContent = 'enter portfolio';
  const x = document.createElement('div');
  x.className = 'pcursor pcursor--x g-dark';
  x.innerHTML = X_SVG;
  document.body.append(enter, x);
  shared.enter = enter;
  shared.x = x;
  shared.mode = 'none';
};

const releaseCursors = () => {
  shared.users = Math.max(0, shared.users - 1);
  if (shared.users > 0) return;
  shared.enter?.remove();
  shared.x?.remove();
  shared.enter = null;
  shared.x = null;
  shared.mode = 'none';
  document.documentElement.classList.remove('pcursor-on');
};

// Fuente única de verdad: 'enter' sobre la foto, 'x' sobre el resto del canvas,
// 'none' fuera del canvas (ahí vuelve el cursor nativo). Idempotente: se puede
// llamar en cada frame sin costo, solo toca el DOM cuando el modo cambia.
const setMode = (mode) => {
  if (!shared.enter || shared.mode === mode) return;
  shared.mode = mode;
  shared.enter.classList.toggle('--on', mode === 'enter');
  shared.x.classList.toggle('--on', mode === 'x');
  document.documentElement.classList.toggle('pcursor-on', mode !== 'none');
};

const placeCursors = (x, y) => {
  const pos = `${x}px ${y}px`;
  if (shared.enter) shared.enter.style.translate = pos;
  if (shared.x) shared.x.style.translate = pos;
};

const PortfolioButton = ({ onClick, imageMeshRef }) => {
  const { gl, camera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const overMesh = useRef(false);
  const pressedOnMesh = useRef(false);
  // el click siempre usa el último onClick sin re-armar los listeners
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    acquireCursors();
    const canvas = gl.domElement;

    const hitMesh = () => {
      const mesh = imageMeshRef?.current;
      if (!mesh || !pointer.known) return false;
      ndc.current.set((pointer.x / window.innerWidth) * 2 - 1, -(pointer.y / window.innerHeight) * 2 + 1);
      raycaster.current.setFromCamera(ndc.current, camera);
      return raycaster.current.intersectObject(mesh).length > 0;
    };

    const update = () => {
      // sobre el canvas = el elemento bajo el puntero ES el canvas (no la nav,
      // ni un título HTML encima): así nunca conviven el nativo y el custom
      const onCanvas = pointer.known && pointer.target === canvas;
      overMesh.current = onCanvas && hitMesh();
      setMode(!onCanvas ? 'none' : overMesh.current ? 'enter' : 'x');
    };

    const onMove = (e) => {
      placeCursors(e.clientX, e.clientY);
      update();
    };
    const onLeaveWindow = () => setMode('none');
    const onDown = (e) => {
      if (e.button !== 0) return;
      update();
      pressedOnMesh.current = overMesh.current;
      const el = overMesh.current ? shared.enter : shared.x;
      el?.classList.add('--press');
    };
    const onUp = () => {
      shared.enter?.classList.remove('--press');
      shared.x?.classList.remove('--press');
      // abre solo si el press empezó y terminó sobre la foto (un click en la X no la abre)
      update();
      if (pressedOnMesh.current && overMesh.current) onClickRef.current?.();
      pressedOnMesh.current = false;
    };

    if (pointer.known) placeCursors(pointer.x, pointer.y);
    update();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    // la foto se mueve sola (el carrusel anima): re-chequear en cada frame
    shared.tick = update;

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      if (shared.tick === update) shared.tick = null;
      releaseCursors();
    };
  }, [gl, camera, imageMeshRef]);

  useFrame(() => shared.tick?.());

  return null;
};

export default PortfolioButton;
