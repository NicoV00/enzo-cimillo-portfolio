import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo } from 'react';
import { gsap } from 'gsap';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import SequentialGlitchText from './SequentialGlitchText';
import { supportsLiquidGlass } from './utils/liquidGlass';
import { buildLensMaps, prewarmLensMaps } from './utils/lensMap';
import { setPageOverlay } from './utils/pageTint';
import './pill.css';
import './MenuModal.css';

// El primer Intl.DateTimeFormat con zona horaria carga los datos de zonas (~30ms):
// se crea una vez y se adelanta junto con la lupa (ver prewarmMenu)
let madridFormat = null;
const getMadridFormat = () => {
  madridFormat ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return madridFormat;
};

const LocalTime = memo(() => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = getMadridFormat();
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const [h = '--', m = '--', s = '--'] = time.split(':');
  return (
    <span className="mmodal__time">
      {h}<span className="mmodal__colon">:</span>{m}<span className="mmodal__colon">:</span>{s}
      <span className="mmodal__tz">CEST</span>
    </span>
  );
});

// Flecha tech: palito y punta casi del mismo largo, apuntando a la esquina
export const ArrowIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
    <path d="M3 7L8 2M3.6 2H8V6.4" />
  </svg>
);

const LENS_SIZE = 120;

const CloseIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
  </svg>
);

/**
 * Lente de vidrio que sigue al mouse (solo punteros finos).
 * Dentro del panel es una lupa glass; sobre el fondo se transforma en el botón de cerrar.
 */
const GlassCursor = ({ panelRef }) => {
  const ref = useRef(null);
  const mapZRef = useRef(null);
  const [scales, setScales] = useState(null);
  const mapRRef = useRef(null);
  const mapGRef = useRef(null);
  const mapBRef = useRef(null);
  const maskRef = useRef(null);
  const [refract] = useState(supportsLiquidGlass);

  useEffect(() => {
    if (!refract || !mapGRef.current || !maskRef.current) return;
    const { maps, scales: sc, mask } = buildLensMaps(LENS_SIZE);
    setScales(sc);
    mapZRef.current.setAttribute('href', maps.zoom);
    mapRRef.current.setAttribute('href', maps.r);
    mapGRef.current.setAttribute('href', maps.g);
    mapBRef.current.setAttribute('href', maps.b);
    maskRef.current.setAttribute('href', mask);
  }, [refract]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let raf = 0;
    let shown = false;
    let s = 1;

    const loop = () => {
      // Seguimiento con inercia: se siente físico sin quedarse atrás.
      // El tamaño va por scale (el mapa de la lupa es de tamaño fijo)
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      const c = el.classList;
      // afuera queda en ~53px (el tamaño de la X cuadrada)
      const target = c.contains('--press') ? 0.86 : c.contains('--outside') ? 1 / 3 : c.contains('--hover') ? 1.15 : 1;
      s += (target - s) * 0.16;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`;
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        cx = x;
        cy = y;
        shown = true;
        el.classList.add('--visible');
      }
      const inside = panelRef.current?.contains(e.target);
      el.classList.toggle('--outside', !inside);
      el.classList.toggle('--hover', !!(inside && e.target.closest('a, button')));
    };
    const onDown = () => {
      el.classList.add('--press');
      // destello: reinicia la animación del flash en cada click
      el.classList.remove('--flash');
      void el.offsetWidth;
      el.classList.add('--flash');
    };
    const onUp = () => el.classList.remove('--press');
    const onLeave = () => el.classList.remove('--visible');
    const onEnter = () => shown && el.classList.add('--visible');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.documentElement.addEventListener('pointerenter', onEnter);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.removeEventListener('pointerenter', onEnter);
    };
  }, [panelRef]);

  return (
    <div ref={ref} className={`mcursor${refract ? ' --refract' : ''}`} aria-hidden="true">
      {refract && (
        <svg className="mcursor__defs" focusable="false">
          <filter
            id="mlens"
            x="0"
            y="0"
            width={LENS_SIZE}
            height={LENS_SIZE}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feOffset in="SourceGraphic" dx="0" dy="0" result="src" />
            {/* 1) zoom: un solo mapa fino para los tres canales -> centro limpio */}
            <feImage ref={mapZRef} x="0" y="0" width={LENS_SIZE} height={LENS_SIZE} preserveAspectRatio="none" result="mapZ" />
            <feDisplacementMap in="src" in2="mapZ" scale={scales?.zoom ?? 0} xChannelSelector="R" yChannelSelector="G" result="zoomed" />
            {/* 2) bisel: refracción y prisma solo en el borde, un mapa por canal */}
            <feImage ref={mapRRef} x="0" y="0" width={LENS_SIZE} height={LENS_SIZE} preserveAspectRatio="none" result="mapR" />
            <feImage ref={mapGRef} x="0" y="0" width={LENS_SIZE} height={LENS_SIZE} preserveAspectRatio="none" result="mapG" />
            <feImage ref={mapBRef} x="0" y="0" width={LENS_SIZE} height={LENS_SIZE} preserveAspectRatio="none" result="mapB" />
            <feDisplacementMap in="zoomed" in2="mapR" scale={scales?.bezel ?? 0} xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feDisplacementMap in="zoomed" in2="mapG" scale={scales?.bezel ?? 0} xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feDisplacementMap in="zoomed" in2="mapB" scale={scales?.bezel ?? 0} xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" result="lens" />
            {/* difusión del borde: versión desenfocada solo en el aro */}
            <feGaussianBlur in="lens" stdDeviation="0.35" result="soft" />
            <feImage ref={maskRef} x="0" y="0" width={LENS_SIZE} height={LENS_SIZE} preserveAspectRatio="none" result="mask" />
            <feComposite in="soft" in2="mask" operator="in" result="rim" />
            <feComposite in="rim" in2="lens" operator="over" />
          </filter>
        </svg>
      )}
      <span className="mcursor__glare" />
      <span className="mcursor__x"><CloseIcon /></span>
    </div>
  );
};

const bodyText = {
  fontSize: '13px',
  lineHeight: '17px',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  letterSpacing: '-0.01em',
  style: { wordSpacing: 'normal' },
  stable: true,
};

// Texto principal de las filas: más grande y negro, como el bloque "What I do"
const leadText = { ...bodyText, fontSize: '17px', lineHeight: '23px', fontFamily: "'Inter Tight Variable', 'Helvetica Neue', Helvetica, Arial, sans-serif" };

const SERVICES = ['Creative Direction', 'Photography', 'Videography', 'Editing'];
const EMAIL = 'cimillo.enzo@gmail.com';

// Rect final del modal: ocupa la vista (con tope) y el contenido se acomoda adentro
// sin scroll: las fotos son lo único que se estira o se achica (ver .mmodal__media)
const getPanelRect = (inner) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 700;
  const side = mobile ? 20 : 24;
  const top = mobile ? 20 : 24;
  const bottom = mobile ? 20 : 24;
  const width = Math.min(620, vw - side * 2);
  const height = Math.min(vh - top - bottom, 900);
  if (inner) {
    inner.style.width = `${width}px`;
    inner.style.height = `${height}px`;
  }
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
};

// Si no se puede leer la pill de origen, el morph arranca con este vidrio
const NAV_TINT = 'rgba(205, 205, 205, 0.34)';
const PANEL_BG = '#ffffff';
const PANEL_RADIUS = 28;

// Menú: modal que nace de la BottomNav (morph nav <-> modal)
const OffCanvas = ({ open, onClose, originRef, onExited }) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  // Lo caro de la primera apertura (lupa + reloj) se prepara con la página ociosa
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(getMadridFormat, { timeout: 4000 });
    if (supportsLiquidGlass() && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      prewarmLensMaps(LENS_SIZE);
    }
  }, []);
  // Las barras de Safari iOS se oscurecen junto con el velo (.mmodal.--visible), sin cortes.
  // Al frame siguiente: lee el layout de la página y no tiene que bloquear el click
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPageOverlay('menu', visible ? 'rgba(0, 0, 0, 0.22)' : null));
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  useEffect(() => () => setPageOverlay('menu', null), []);
  const [finePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
  const navigate = useNavigate();
  const goTo = (path) => (e) => {
    e.preventDefault();
    onClose?.();
    navigate(path);
  };
  const panelRef = useRef(null);
  const innerRef = useRef(null);
  // La palabra "Menu" viaja dentro del panel: se va al crecer y vuelve al encogerse,
  // así se lee que es la misma pill la que se transforma
  const ghostRef = useRef(null);
  const lastFocus = useRef(null);
  const tweenRef = useRef(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement;
      setMounted(true);
    }
  }, [open]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!mounted || !panel) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Forma y color exactos de la pill de Menu (su tinte cambia con el fondo)
    const originEl = originRef?.current;
    const origin = originEl?.getBoundingClientRect();
    const navShape = origin && {
      left: origin.left,
      top: origin.top,
      width: origin.width,
      height: origin.height,
      borderRadius: origin.height / 2,
      backgroundColor: getComputedStyle(originEl).backgroundColor || NAV_TINT,
    };
    const ghost = ghostRef.current;
    if (ghost && originEl) {
      const cs = getComputedStyle(originEl);
      Object.assign(ghost.style, {
        color: cs.color,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
      });
      gsap.killTweensOf(ghost);
    }

    if (open) {
      // El contenido ya tiene su tamaño final: el panel lo recorta mientras crece (sin reflow)
      const to = getPanelRect(innerRef.current);
      const final = { ...to, borderRadius: PANEL_RADIUS, backgroundColor: PANEL_BG, opacity: 1 };
      // Si se reabre a mitad del cierre, sigue desde donde está
      const wasClosing = closingRef.current;
      closingRef.current = false;
      tweenRef.current?.kill();
      if (!wasClosing) {
        gsap.set(panel, navShape ? { ...navShape, opacity: 1 } : { ...to, borderRadius: PANEL_RADIUS, opacity: 0 });
        if (ghost) gsap.set(ghost, { opacity: navShape ? 1 : 0 });
      }
      // la palabra se apaga en cuanto la pill empieza a crecer
      if (ghost) gsap.to(ghost, { opacity: 0, duration: reduced ? 0.01 : 0.14, ease: 'power1.out' });
      tweenRef.current = gsap.to(panel, {
        ...final,
        duration: reduced ? 0.01 : 0.85,
        ease: 'expo.out',
        // si otro código mata el tween, el panel no queda a medio abrir
        onInterrupt: () => { if (!closingRef.current) gsap.set(panel, final); },
      });
      setVisible(true);
      const t = setTimeout(() => setReady(true), reduced ? 0 : 320);
      return () => clearTimeout(t);
    }

    // Cerrar: primero se va el contenido, después el modal vuelve a ser la nav
    closingRef.current = true;
    setVisible(false);
    tweenRef.current?.kill();
    // Desmonta aunque otro código mate el tween: si no, el overlay invisible
    // queda tapando la página y la forma de la nav encima de la nav real
    const unmount = () => {
      if (!closingRef.current) return; // se reabrió mientras cerraba
      closingRef.current = false;
      // el glitch se rearma al desmontar, no en el click (menos trabajo en el cierre)
      setReady(false);
      setMounted(false);
    };
    // La nav real empieza a aparecer en la cola del morph (no al final): sin pausa en el relevo
    let handedOff = false;
    const handOff = () => {
      if (handedOff) return;
      handedOff = true;
      onExited?.();
    };
    const closeDur = reduced ? 0.01 : 0.58;
    // "Menu" reaparece en el último tramo, cuando el panel ya tiene casi el tamaño
    // de la pill: al terminar, la forma es idéntica a la pill real y el relevo no se nota
    if (ghost && navShape) {
      gsap.to(ghost, { opacity: 1, duration: reduced ? 0.01 : 0.2, delay: closeDur * 0.5, ease: 'power1.out' });
    }
    tweenRef.current = gsap.to(panel, {
      ...(navShape || { opacity: 0 }),
      duration: closeDur,
      // un solo ease-out: arranca enseguida y frena suave sobre la nav (expo.inOut tironeaba)
      ease: 'power3.out',
      onUpdate() { if (this.progress() > 0.8) handOff(); },
      onComplete: () => {
        handOff();
        // la forma se va recién cuando la nav real ya está casi entera (sin bache de opacidad)
        tweenRef.current = gsap.to(panel, {
          opacity: 0,
          duration: 0.14,
          delay: 0.12,
          ease: 'power1.out',
          onComplete: unmount,
          onInterrupt: unmount,
        });
      },
      onInterrupt: () => {
        if (!closingRef.current) return;
        handOff();
        unmount();
      },
    });
    lastFocus.current?.focus?.({ preventScroll: true });
    return undefined;
  }, [open, mounted, originRef, onExited]);

  useEffect(() => () => tweenRef.current?.kill(), []);

  // Mantener el modal centrado si cambia el viewport
  useEffect(() => {
    if (!open || !mounted) return;
    const onResize = () => {
      const to = getPanelRect(innerRef.current);
      if (!tweenRef.current?.isActive()) gsap.set(panelRef.current, to);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, mounted]);

  useEffect(() => {
    // Sin botón de cerrar: se cierra tocando afuera o con Esc. El foco va al panel
    if (ready) panelRef.current?.focus({ preventScroll: true });
  }, [ready]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onBackdropDown = useCallback((e) => {
    if (open && !panelRef.current?.contains(e.target)) onClose?.();
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`mmodal${visible ? ' --visible' : ''}${finePointer && open ? ' --nocursor' : ''}`}
      onPointerDown={onBackdropDown}
    >
      <div
        ref={panelRef}
        className="mmodal__panel"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <span ref={ghostRef} className="mmodal__ghost" aria-hidden="true">Menu</span>
        <div ref={innerRef} className="mmodal__inner">
          <header className="mmodal__top">
            <span className="pill pill--soft pill--static mmodal__name">enzo cimillo</span>
            <div className="mmodal__top-end">
              <a className="pill pill--soft pill--quiet" href="/gallery/enzo">Latest work</a>
              <button type="button" className="pill pill--solid" onClick={onClose}>Close</button>
            </div>
          </header>

          {/* Fila de imágenes: el último proyecto grande, otro chico apoyado abajo */}
          <div className="mmodal__media">
            <a className="mmodal__shot --main" href="/gallery/enzo">
              <img src="/images/X/webp/@enzocimillo_ex-_6.webp" alt="ex-, 2026" />
            </a>
          </div>

          <div className="mmodal__meta"><span>Latest / ex- / 2026</span></div>

          <section className="mmodal__rows">
            <div className="mmodal__row">
              <span className="mmodal__label">About</span>
              <div className="mmodal__value --lead">
                <SequentialGlitchText
                  text="Photographer and videographer with a strong inclination towards fashion productions."
                  {...leadText}
                  initialGlitch={ready}
                />
              </div>
            </div>

            <div className="mmodal__row">
              <span className="mmodal__label">What I do</span>
              <div className="mmodal__value">
                <ul className="mmodal__pills">
                  {SERVICES.map((s) => (
                    <li key={s}><span className="pill pill--soft pill--static">{s}</span></li>
                  ))}
                </ul>
                <p className="mmodal__note">Available for commission and freelance work.</p>
              </div>
            </div>

            <div className="mmodal__row mmodal__row--location">
              <span className="mmodal__label">Based in Barcelona</span>
              <div className="mmodal__value"><LocalTime /></div>
            </div>
          </section>

          <footer className="mmodal__foot">
            <a className="pill pill--soft pill--split mmodal__mail" href={`mailto:${EMAIL}`}>
              <span>Contact</span>
              <span className="pill__muted">{EMAIL}</span>
            </a>
            <div className="pill pill--soft pill--static pill--split mmodal__copy">
              <span>&copy; {new Date().getFullYear()} Enzo Cimillo</span>
              <span className="mmodal__legal"><a href="/privacy" onClick={goTo('/privacy')}>Privacy</a></span>
            </div>
            <a className="pill pill--soft mmodal__instagram" href="https://www.instagram.com/enzocimillo" target="_blank" rel="noopener noreferrer">
              Instagram<ArrowIcon className="pill__arrow" />
            </a>
          </footer>
        </div>
      </div>

      {finePointer && <GlassCursor panelRef={panelRef} />}
    </div>,
    document.body
  );
};

export default OffCanvas;
