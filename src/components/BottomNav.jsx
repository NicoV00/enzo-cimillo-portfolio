import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '@fontsource-variable/inter-tight';
import OffCanvas from './OffCanvas';
import { PROJECTS } from './utils/projects';
import { setPageOverlay } from './utils/pageTint';
import { watchTone } from './utils/navTone';
import './glass.css';
import './pill.css';
import './BottomNav.css';

const CONTACT_MAIL = 'mailto:cimillo.enzo@gmail.com';

const normalize = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Flecha de links externos de la nav de i-d.co (mismo path, blanco al 30%)
const ExternalArrow = () => (
  <svg className="bnav__arrow" width="9" height="10" viewBox="0 0 9 10" fill="none" aria-hidden="true">
    <path d="M8.62819 7.51883L8.61051 0.705853L1.79754 0.688176C1.72656 0.678565 1.65434 0.684318 1.58578 0.705044C1.51721 0.72577 1.4539 0.760986 1.40013 0.808307C1.34636 0.855629 1.30338 0.91395 1.27411 0.979325C1.24484 1.0447 1.22996 1.1156 1.23047 1.18723C1.23098 1.25885 1.24688 1.32953 1.27708 1.39448C1.30728 1.45943 1.35109 1.51714 1.40553 1.56368C1.45997 1.61023 1.52378 1.64454 1.59263 1.66428C1.66148 1.68403 1.73378 1.68875 1.80461 1.67813L6.90992 1.69934L0.146446 8.46281C0.0526783 8.55658 0 8.68376 0 8.81637C0 8.94898 0.0526783 9.07615 0.146446 9.16992C0.240215 9.26369 0.367392 9.31637 0.500001 9.31637C0.632609 9.31637 0.759785 9.26369 0.853553 9.16992L7.61703 2.40645L7.63824 7.51176C7.63871 7.64444 7.69187 7.7715 7.78602 7.86499C7.88017 7.95848 8.00761 8.01074 8.14029 8.01027C8.27297 8.0098 8.40003 7.95664 8.49352 7.86249C8.58701 7.76834 8.63927 7.6409 8.6388 7.50822L8.62819 7.51883Z" fill="currentColor" />
  </svg>
);

const BottomNav = ({ onShowChange, hidden = false }) => {
  const navigate = useNavigate();
  // Entrada después de la intro: `hidden` la mantiene abajo e invisible y, al
  // soltarse, `--in` le da una transición más lenta solo para esa entrada
  const [entering, setEntering] = useState(false);
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden) {
      setEntering(true);
      const t = setTimeout(() => setEntering(false), 1700);
      wasHidden.current = hidden;
      return () => clearTimeout(t);
    }
    wasHidden.current = hidden;
  }, [hidden]);
  const [menuOpen, setMenuOpen] = useState(false);
  // La nav se oculta mientras el modal existe (abierto o volviendo a ser nav)
  const [navHidden, setNavHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(null);
  // -1 = ninguno resaltado (solo hover o flechas resaltan)
  const [activeIdx, setActiveIdx] = useState(-1);

  const rootRef = useRef(null);
  const containerRef = useRef(null);
  // El modal nace de esta pill y vuelve a ella al cerrar
  const menuBtnRef = useRef(null);
  // La búsqueda nace de esta pill: el vidrio del campo arranca con su forma y color
  const searchBtnRef = useRef(null);
  const [glassFrom, setGlassFrom] = useState(null);
  const inputRef = useRef(null);
  const closedWidth = useRef(null);
  const tagsRef = useRef(null);
  const [tagsH, setTagsH] = useState(0);
  const resetTimer = useRef(null);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return PROJECTS;
    return PROJECTS.filter((p) => normalize(`${p.name} ${p.year} ${p.slug}`).includes(q));
  }, [query]);

  useEffect(() => { onShowChange?.(menuOpen); }, [menuOpen, onShowChange]);
  useEffect(() => { setActiveIdx(-1); }, [query]);
  // Las barras de Safari iOS se oscurecen junto con .bnav-overlay
  useEffect(() => {
    setPageOverlay('search', searchOpen ? 'rgba(0, 0, 0, 0.2)' : null);
  }, [searchOpen]);
  useEffect(() => () => setPageOverlay('search', null), []);

  // El halo gris envuelve campo + proyectos (como i-d en mobile): medir el bloque de tags
  useEffect(() => {
    const el = tagsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTagsH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // width: auto no transiciona: medimos el ancho natural y animamos px -> px
  const openSearch = useCallback(() => {
    clearTimeout(resetTimer.current);
    const box = containerRef.current;
    const btn = searchBtnRef.current;
    if (box) {
      closedWidth.current = box.offsetWidth;
      setWidth(closedWidth.current);
    }
    if (box && btn) {
      const c = box.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      setGlassFrom({
        '--gl': `${b.left - c.left}px`,
        '--gr': `${c.right - b.right}px`,
        '--gt': `${b.top - c.top}px`,
        '--gb': `${c.bottom - b.bottom}px`,
        '--glass-from': getComputedStyle(btn).backgroundColor,
      });
    }
    requestAnimationFrame(() => {
      setWidth(Math.min(460, window.innerWidth - 32));
      setSearchOpen(true);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250);
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setActiveIdx(-1);
    if (closedWidth.current) setWidth(closedWidth.current);
    clearTimeout(resetTimer.current);
    // La búsqueda se limpia recién con todo cerrado: si se vacía al instante, la
    // lista vuelve a tener todos los proyectos y el halo se estira hacia abajo
    // justo mientras se va (era la parte que "se caía")
    resetTimer.current = setTimeout(() => {
      setWidth(null);
      setQuery('');
    }, 700);
  }, []);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Cada pill lee el fondo que tiene detrás: texto oscuro sobre claro, blanco sobre oscuro
  useEffect(() => {
    if (!containerRef.current) return undefined;
    return watchTone(containerRef.current);
  }, []);

  const goToProject = useCallback((slug) => {
    closeSearch();
    navigate(`/gallery/${slug}`);
  }, [closeSearch, navigate]);

  // Tap/click: primero se ve seleccionado, después navega
  const pickProject = useCallback((i, slug) => {
    setActiveIdx(i);
    setTimeout(() => goToProject(slug), 160);
  }, [goToProject]);

  // Esc y click afuera cierran la búsqueda
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeSearch(); };
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) closeSearch();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [searchOpen, closeSearch]);

  const onInputKey = (e) => {
    if (e.key === 'Enter' && results.length) {
      goToProject(results[Math.max(activeIdx, 0)].slug);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
  };

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const onMenuExited = useCallback(() => setNavHidden(false), []);

  return (
    <>
      {/* Fondo desenfocado de la búsqueda (id-site-header-overlay de i-d.co) */}
      <div className={`bnav-overlay${searchOpen ? ' --on' : ''}`} aria-hidden="true" />

      <div
        ref={rootRef}
        className={`bnav${searchOpen ? ' --search' : ''}${navHidden ? ' --menu' : ''}${hidden ? ' --intro' : ''}${entering ? ' --in' : ''}`}
        aria-hidden={hidden || undefined}
      >
        <div
          ref={containerRef}
          className="bnav__container"
          style={{ ...(width ? { width } : null), ...glassFrom, '--bnav-tags-h': `${tagsH}px` }}
        >
          <span className="bnav__shine" aria-hidden="true" />
          <ul className={`bnav__links${searchOpen ? ' --hidden' : ''}`}>
            <li>
              <button ref={menuBtnRef} type="button" className="pill pill--glass pill--lg g-light bnav__link bnav__menu" data-tone-sample onClick={() => { closeSearch(); setNavHidden(true); setMenuOpen(true); }}>
                Menu
              </button>
            </li>
            <li>
              <a className="pill pill--glass pill--lg g-light bnav__link" data-tone-sample href={CONTACT_MAIL}>
                Contact
                <ExternalArrow />
              </a>
            </li>
            <li>
              <button ref={searchBtnRef} type="button" className="pill pill--glass pill--lg g-light bnav__link" data-tone-sample onClick={openSearch}>
                Search
              </button>
            </li>
          </ul>

          <div className="bnav__search" aria-hidden={!searchOpen}>
            <div className="bnav__search-inner">
              <input
                ref={inputRef}
                className="bnav__input"
                type="text"
                placeholder="Search project"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                tabIndex={searchOpen ? 0 : -1}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="bnav__close"
                aria-label="Close search"
                tabIndex={searchOpen ? 0 : -1}
                onClick={closeSearch}
              >
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" />
                </svg>
              </button>
            </div>
            <ul ref={tagsRef} className="bnav__tags" onMouseLeave={() => setActiveIdx(-1)}>
              {results.length === 0 && <li className="bnav__empty">No results</li>}
              {results.map((p, i) => (
                <li key={p.slug} style={{ '--i': i }}>
                  <button
                    type="button"
                    className={`bnav__tag${i === activeIdx ? ' --active' : ''}`}
                    tabIndex={searchOpen ? 0 : -1}
                    // hover solo con mouse: en touch se marca únicamente al tocar
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveIdx(i); }}
                    onClick={() => pickProject(i, p.slug)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <OffCanvas open={menuOpen} onClose={closeMenu} originRef={menuBtnRef} onExited={onMenuExited} />
    </>
  );
};

export default BottomNav;
