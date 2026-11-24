import React from 'react';
import { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import About1 from './components/About1';
import Footer from './components/Footer';
import OffCanvas from './components/OffCanvas';
import { Box } from '@mui/material';
import GalleryLoadingScreen from './components/Galleries/GalleryLoadingScreen';
import { styled } from '@mui/material/styles';
import IntroVideo from './components/IntroVideo';
import ScreensaverBanner from './components/ScreensaverBanner';
import { gsap } from 'gsap';
import * as THREE from 'three';
import MyWaySection from './components/MyWaySection';
import { Analytics } from '@vercel/analytics/react';
import MobileComingSoon from './components/MobileComingSoon';
import LegalPage from './components/LegalPage';
import galleryColors from './components/utils/galleryColors';
import { setPageBase } from './components/utils/pageTint';

// Lazy loaded galleries
const AnaLivniGallery = lazy(() => import('./components/Galleries/AnaLivniGallery'));
const BluaGallery = lazy(() => import('./components/Galleries/BluaGallery'));
const MaisonGallery = lazy(() => import('./components/Galleries/MaisonGallery'));
const VestimeTeoGallery = lazy(() => import('./components/Galleries/VestimeTeoGallery'));
const CaldoGallery = lazy(() => import('./components/Galleries/CaldoGallery'));
const PlataGallery = lazy(() => import('./components/Galleries/PlataGallery'));
const LenoirGallery = lazy(() => import('./components/Galleries/LenoirGallery'));
const KaboaGallery = lazy(() => import('./components/Galleries/KaboaGallery'));
const AmourGallery = lazy(() => import('./components/Galleries/AmourGallery'));
const MarcosGallery = lazy(() => import('./components/Galleries/MarcosGallery'));
const PasarelaGallery = lazy(() => import('./components/Galleries/PasarelaGallery'));
const IdentidadGallery = lazy(() => import('./components/Galleries/IdentidadGallery'));
const EnzoGallery = lazy(() => import('./components/Galleries/EnzoGallery'));
// Easter egg: solo se descarga cuando alguien lo activa
const AuraMode = lazy(() => import('./components/Aura/AuraMode'));

// Precarga
import('./components/Galleries/BluaGallery');

// Función para detectar dispositivos móviles
const isMobileDevice = () => {
  // Detecta por user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

  // Detecta por tamaño de pantalla
  const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

  // Detecta por capacidades táctiles
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return mobileRegex.test(userAgent.toLowerCase()) || (screenWidth <= 768 && hasTouch);
};

// Componente para el texto con efecto glitch
const GlitchText = ({ text }) => {
  const [displayText, setDisplayText] = useState(text);
  const [isGlitching, setIsGlitching] = useState(false);
  const prevTextRef = useRef(text);

  useEffect(() => {
    // Activar glitch cuando cambia el texto
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      setIsGlitching(true);
      const characters = "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let iterations = 0;

      const interval = setInterval(() => {
        setDisplayText(text
          .split("")
          .map((letter, index) => {
            if (index < iterations) {
              return text[index];
            }
            if (letter === ' ') return ' '; // Mantener espacios
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("")
        );

        if (iterations >= text.length) {
          clearInterval(interval);
          setIsGlitching(false);
          setDisplayText(text);
        }

        iterations += 1;
      }, 30);

      return () => clearInterval(interval);
    }
  }, [text]);

  return <span>{displayText}</span>;
};

// Font loading and global styles
const GlobalStyle = styled('style')({
  '@font-face': [
    {
      fontFamily: 'Medium',
      src: 'url("/fonts/Medium.otf") format("opentype")',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
    {
      fontFamily: 'Helvetica-Regular',
      src: 'url("/fonts/Helvetica.ttf") format("truetype")',
      fontWeight: 'normal',
      fontStyle: 'normal',
      fontDisplay: 'swap',
    },
    {
      fontFamily: 'Helvetica-Bold',
      src: 'url("/fonts/Helvetica-Bold.ttf") format("truetype")',
      fontWeight: 'bold',
      fontStyle: 'normal',
      fontDisplay: 'swap',
    }
  ]
});

// Container for the entire app
const ContainerCloud = styled(Box)({
  position: 'relative',
  width: '100%',
  // dvh = alto visible: con 100vh, en mobile el canvas quedaba más alto que la pantalla
  // (barra del navegador) y la foto seleccionada bajaba hasta tapar el nombre
  height: '100vh',
  '@supports (height: 100dvh)': { height: '100dvh' },
  opacity: 1,
});

// Photographer name with rotation and styling
const PhotographerName = styled(Box)({
  position: 'absolute',
  top: '140px',
  left: '0px',
  fontFamily: 'Helvetica-Bold, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: '50px',
  fontWeight: 'bold',
  color: 'black',
  transform: 'rotate(-90deg)',
  transformOrigin: 'top left',
  zIndex: 10,
  letterSpacing: '-2px',
  textTransform: 'lowercase',
  transition: 'letter-spacing 0.3s ease, opacity 0.5s ease, color 0.2s ease',
  opacity: 0,
  cursor: 'pointer',
  userSelect: 'none',
});

// Style for individual letters
const Letter = styled('span')({
  display: 'inline-block',
  transition: 'color 0.2s ease, text-shadow 0.3s ease',
  marginRight: '0.5px'
});

// Place the caption just below the centered image, independently of the navigation.
const nameBottom = (photoFrac) =>
  `calc(${(0.5 - photoFrac / 2).toFixed(4)} * 100dvh - 48px)`;

const ProjectInfoContainer = styled(Box, {
  shouldForwardProp: (prop) => !['isVisible', 'textColor', 'photoFrac', 'liftFrac'].includes(prop),
})(({ isVisible, textColor, photoFrac = 0.66, liftFrac = 0 }) => ({
  position: 'fixed',
  bottom: nameBottom(photoFrac),
  '@media (max-width: 699px)': { bottom: `max(env(safe-area-inset-bottom, 0px), calc(${(0.5 - photoFrac / 2).toFixed(4)} * 100dvh - 58px))` },
  left: '50%',
  display: 'flex',
  alignItems: 'baseline',
  gap: '10px',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '8px',
  zIndex: 1000,
  pointerEvents: 'none',
  color: textColor || '#000000', // Usar el color del tema directamente
  fontFamily: '"Helvetica", Helvetica, Arial, sans-serif',
  fontSize: '16px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
  lineHeight: 1,
  opacity: isVisible ? 1 : 0,
  transform: isVisible
    ? 'translateX(-50%) translateY(0)'
    : 'translateX(-50%) translateY(20px)',
  transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
}));

const ProjectName = styled(Box)({
  fontSize: '18px',
  fontWeight: 'bold',
  letterSpacing: '1px',
});

const ProjectYear = styled(Box)({
  fontSize: '14px',
  opacity: 0.7,
  fontWeight: 'bold',
});

// Definido fuera de App para que React no remonte la galería en cada render de App
const GalleryWrapper = ({ onBack, slugToImage }) => {
  const { id } = useParams();

  // Título de pestaña por proyecto (y se restaura al volver al carrusel)
  useEffect(() => {
    if (!id) return;
    const prev = document.title;
    const name = id.replace(/-/g, ' ');
    document.title = `${name} — enzo cimillo`;
    return () => { document.title = prev; };
  }, [id]);

  // Si no hay ID o queremos volver al carrusel
  if (!id) return null;

  const loadingComponent = <GalleryLoadingScreen loading backgroundColor={galleryColors[id]?.main} textColor={galleryColors[id]?.text} />;

  switch (id) {
    case "ana-livni":
      return <Suspense fallback={loadingComponent}><AnaLivniGallery onBack={onBack} /></Suspense>;
    case "blua":
      return <Suspense fallback={loadingComponent}><BluaGallery onBack={onBack} /></Suspense>;
    case "maison":
      return <Suspense fallback={loadingComponent}><MaisonGallery onBack={onBack} /></Suspense>;
    case "caldo":
      return <Suspense fallback={loadingComponent}><CaldoGallery onBack={onBack} /></Suspense>;
    case "vestimeteo":
      return <Suspense fallback={loadingComponent}><VestimeTeoGallery onBack={onBack} /></Suspense>;
    case "plata":
      return <Suspense fallback={loadingComponent}><PlataGallery onBack={onBack} /></Suspense>;
    case "lenoir":
      return <Suspense fallback={loadingComponent}><LenoirGallery onBack={onBack} /></Suspense>;
    case "kaboa":
      return <Suspense fallback={loadingComponent}><KaboaGallery onBack={onBack} /></Suspense>;
    case "amour":
      return <Suspense fallback={loadingComponent}><AmourGallery onBack={onBack} /></Suspense>;
    case "marcos":
      return <Suspense fallback={loadingComponent}><MarcosGallery onBack={onBack} /></Suspense>;
    case "pasarela":
      return <Suspense fallback={loadingComponent}><PasarelaGallery onBack={onBack} /></Suspense>;
    case "identidad":
      return <Suspense fallback={loadingComponent}><IdentidadGallery onBack={onBack} /></Suspense>;
    case "enzo":
      return <Suspense fallback={loadingComponent}><EnzoGallery onBack={onBack} /></Suspense>;
    default:
      // Try to see if it's a "MyWay" collection
      // Since we don't have the image path here, we might need to handle this differently
      // but for now let's assume if it's not special, it's MyWay
      return (
        <MyWaySection
          onBack={onBack}
          collection={slugToImage[id] || id}
        />
      );
  }
};

function App() {
  const photographerName = "enzo";
  const lettersRef = useRef([]);
  const [showDiv, setShowDiv] = useState(false);
  const [index, setIndex] = useState('false');
  const [showGallery, setShowGallery] = useState(false);
  const [collection, setCollection] = useState("");
  // Check sessionStorage to see if intro was already shown in this session
  const [showIntro, setShowIntro] = useState(() => {
    // Check if we are on a gallery route directly
    // galerías y la página de privacidad abren directo, sin la intro
    const isGalleryRoute = /^\/(gallery\/|privacy)/.test(window.location.pathname);
    const introShown = sessionStorage.getItem('introShown');

    if (isGalleryRoute) {
      // If we land on a gallery, we consider the intro "shown" (skipped) for future navigations
      sessionStorage.setItem('introShown', 'true');
      return false;
    }

    return introShown !== 'true'; // Show intro only if NOT shown before in this session
  });
  const containerRef = useRef(null);
  const photographerNameRef = useRef(null);
  // Visibilidad del nombre como estado (antes se ponía por ref y se perdía al re-montar)
  const [nameVisible, setNameVisible] = useState(() => false);
  // Sin intro (recarga en la misma sesión) el carrusel igual entra animado: la nav
  // y el nombre esperan a que se asiente en vez de aparecer encima de la imagen
  useEffect(() => {
    if (showIntro) return;
    const t = setTimeout(() => setNameVisible(true), 1100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [bgColor, setBgColor] = useState('#ffffff');
  const glRef = useRef(null);
  const clearColor = useRef(new THREE.Color(bgColor));

  // Estados para la transición
  const [initialTransition, setInitialTransition] = useState(false);
  const [transitionImageUrl, setTransitionImageUrl] = useState(null);
  // Encuadre (px) de la portada en el último frame del video de intro
  const [introRect, setIntroRect] = useState(null);
  const transitionInProgressRef = useRef(false);
  const [scene3DReady, setScene3DReady] = useState(false);

  // Estado para la información del proyecto seleccionado
  const [selectedProjectInfo, setSelectedProjectInfo] = useState(null);

  // Estados del screensaver
  const [screensaverActive, setScreensaverActive] = useState(true);
  const [isUserInactive, setIsUserInactive] = useState(false);

  // NUEVO ESTADO para almacenar los colores del tema actual
  const [themeColors, setThemeColors] = useState(null);

  // NUEVO ESTADO para detectar dispositivos móviles
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  // Collection mapping
  const specialCollections = {
    "./images/CALDO/CALDO-1 (PORTADA).jpg": "caldo",
    "./images/S-1.jpg": "ana-livni",
    "./images/blua_constelaciones_finales.jpg": "blua",
    "./images/MDLST/MDLST-1.png": "maison",
    "./images/TEO/V1.jpg": "vestimeteo",
    "./images/PLATA/PLATA-2.jpg": "plata",
    "./images/LENOIR/LENOIR-1.jpg": "lenoir",
    "./images/KABOA/KABOA-1.jpg": "kaboa",
    "./images/AMOUR/portada.jpg": "amour",
    "./images/MARCOS/MARCOSMUF-5 (PORTADA).jpg": "marcos",
    "./images/PASARELA/PASARELA MUF-12(PORTADA).jpg": "pasarela",
    "./images/IDENTIDAD/IDENTIDAD MUF-1 (PORTADA).jpg": "identidad",
    "./images/X/@enzocimillo_ex-_1.jpg": "enzo"
  };

  // Reverse mapping for slug to image path (needed for router deep links)
  const slugToImage = Object.fromEntries(
    Object.entries(specialCollections).map(([img, slug]) => [slug, img])
  );

  const navigate = useNavigate();
  const location = useLocation();

  // Screensaver en blanco sobre proyectos oscuros (Maison, Pasarela…): fondo de la
  // galería abierta o, en el carrusel, el del proyecto seleccionado
  const gallerySlug = location.pathname.startsWith('/gallery/')
    ? decodeURIComponent(location.pathname.split('/')[2] || '')
    : null;
  const screensaverBg = gallerySlug ? galleryColors[gallerySlug]?.main : themeColors?.main;
  const screensaverText = screensaverBg && new THREE.Color(screensaverBg).getHSL({}).l < 0.35
    ? '#ffffff'
    : '#000000';


  // NUEVO: Detectar cambios en el tamaño de ventana
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // CLEANUP: Clear all GSAP animations and resources on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up App component...');
      // Kill all GSAP animations
      if (window.gsap) {
        window.gsap.killTweensOf("*");
      }
      // Clear session storage on page unload (not on component unmount)
      // sessionStorage will persist during navigation between projects
    };
  }, []);

  // Barras de Safari iOS: en el mapa siguen el color del canvas (que anima al seleccionar)
  const syncHomeTint = () => {
    if (window.location.pathname.startsWith('/gallery/')) return;
    setPageBase(`#${clearColor.current.getHexString()}`);
  };

  // En una galería: su color de fondo. Al volver al mapa: blanco (el canvas se recrea
  // en blanco), así no queda pegado el color del proyecto anterior
  useEffect(() => {
    if (gallerySlug) {
      gsap.killTweensOf(clearColor.current);
      setPageBase(galleryColors[gallerySlug]?.main || '#ffffff');
    } else {
      gsap.killTweensOf(clearColor.current);
      clearColor.current.set('#ffffff');
      setBgColor('#ffffff');
      setPageBase('#ffffff');
    }
  }, [gallerySlug]);

  // FIX: Manejo correcto del reset de color a blanco
  useEffect(() => {
    const fallback = '#ffffff';


    // Si bgColor es null, undefined, o se está reseteando, volver a blanco
    if (!bgColor) {
      setThemeColors(null);


      console.log('||||| ---> Reseteando color a BLANCO');


      const whiteColor = new THREE.Color('#ffffff');
      gsap.to(clearColor.current, {
        r: whiteColor.r,
        g: whiteColor.g,
        b: whiteColor.b,
        duration: 1,
        onUpdate: () => {
          if (glRef.current) {
            glRef.current.setClearColor(clearColor.current);
          }
          syncHomeTint();
        },
      });
      return;
    }

    // Si bgColor es un objeto con la estructura del tema
    if (typeof bgColor === 'object' && bgColor.main) {
      setThemeColors(bgColor); // Guardar todo el objeto de colores
      const hex = bgColor.main || fallback;

      console.log('||||| ---> Tema COMPLETO recibido:', bgColor);
      console.log('||||| ---> Color de fondo:', bgColor.main);
      console.log('||||| ---> Color de texto:', bgColor.text);

      const newColor = new THREE.Color(hex);
      gsap.to(clearColor.current, {
        r: newColor.r,
        g: newColor.g,
        b: newColor.b,
        duration: 1,
        onUpdate: () => {
          if (glRef.current) {
            glRef.current.setClearColor(clearColor.current);
          }
          syncHomeTint();
        },
      });
    } else if (typeof bgColor === 'string') {
      // Si bgColor es solo un string de color
      const hex = bgColor;
      setThemeColors(null);

      console.log('||||| ---> Color simple recibido:', hex);

      const newColor = new THREE.Color(hex);
      gsap.to(clearColor.current, {
        r: newColor.r,
        g: newColor.g,
        b: newColor.b,
        duration: 1,
        onUpdate: () => {
          if (glRef.current) {
            glRef.current.setClearColor(clearColor.current);
          }
          syncHomeTint();
        },
      });
    }
  }, [bgColor]);

  const hexToRGB = (hex) => {
    if (typeof hex !== 'string') return [0, 0, 0];

    const cleanedHex = hex.replace('#', '');

    const bigint = parseInt(cleanedHex, 16);
    return [
      ((bigint >> 16) & 255) / 255,
      ((bigint >> 8) & 255) / 255,
      (bigint & 255) / 255,
    ];
  };

  // Preparar escena 3D inmediatamente al cargar
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.display = 'block';
    }

    setScene3DReady(true);
  }, []);

  // Handler optimizado para la transición sin retrasos
  const handleIntroComplete = (finalImageUrl, rect) => {
    if (transitionInProgressRef.current) return;
    transitionInProgressRef.current = true;

    // Mark intro as shown in session storage so it doesn't show again on reload
    sessionStorage.setItem('introShown', 'true');

    console.log("Iniciando transición sin retrasos");

    setIntroRect(rect || null);
    setTransitionImageUrl(finalImageUrl);
    setInitialTransition(true);

    // Red de seguridad: si el carrusel no toma la posta, quitar la intro igual
    setTimeout(() => setShowIntro(false), 2500);
  };

  // El carrusel ya pintó la imagen 3D calzada sobre el último frame: quitar el video
  // Fundido corto del video sobre la imagen 3D (mismo encuadre) en vez de corte seco
  const [introFading, setIntroFading] = useState(false);
  const handleIntroHandoff = useCallback(() => {
    setIntroFading(true);
    setTimeout(() => setShowIntro(false), 450);
  }, []);

  // ── Easter egg "aura": escribir "aura" o tocar 5 veces el nombre "enzo" ──
  const [auraOpen, setAuraOpen] = useState(false);
  const closeAura = useCallback(() => setAuraOpen(false), []);
  const nameTaps = useRef([]);
  const handleNameTap = useCallback(() => {
    const now = performance.now();
    nameTaps.current = [...nameTaps.current.filter((t) => now - t < 2500), now];
    if (nameTaps.current.length >= 5) {
      nameTaps.current = [];
      setAuraOpen(true);
    }
  }, []);
  useEffect(() => {
    let typed = '';
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-4);
      if (typed === 'aura') {
        typed = '';
        setAuraOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Callback instantáneo para cuando el carrusel está listo
  const handleCarouselReady = () => {
    console.log("Carrusel listo para animación");
  };

  // Finalizar la transición y mostrar elementos de UI
  const handleTransitionComplete = () => {
    console.log("Transición completada");
    setInitialTransition(false);

    setNameVisible(true);

    transitionInProgressRef.current = false;
  };

  // Glitch effect - solo letras y números para mantener tamaño consistente.
  // Una sola corrida por letra a la vez (sin acumular intervalos) y más pausado.
  const glitchEffect = (element, text, delay = 0) => {
    if (element.dataset.glitching === '1') return;
    element.dataset.glitching = '1';
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    setTimeout(() => {
      const interval = setInterval(() => {
        element.textContent = characters[Math.floor(Math.random() * characters.length)];
      }, 90);
      setTimeout(() => {
        clearInterval(interval);
        element.textContent = text;
        element.dataset.glitching = '0';
      }, 500);
    }, delay);
  };

  // Photographer name hover effect
  useEffect(() => {
    if (showGallery) return;

    const nameContainer = document.querySelector('.photographer-name');
    if (!nameContainer) return;

    const isTouch = window.matchMedia('(hover: none)').matches;
    let touchResetTimer = null;

    const handleMouseOver = () => {
      lettersRef.current.forEach((letter, index) => {
        if (!letter) return;
        letter.style.transitionDelay = `${index * 50}ms`;
        letter.style.color = '#00ff00';
        letter.style.textShadow = '0 0 2px rgba(0, 255, 0, 0.5), 0 0 3px rgba(0, 255, 0, 0.3)';
        glitchEffect(letter, photographerName[index], index * 80);
      });

      nameContainer.style.letterSpacing = '-1px';

      // En táctil no hay "mouse out": volver al estado normal al terminar el glitch
      if (isTouch) {
        clearTimeout(touchResetTimer);
        touchResetTimer = setTimeout(handleMouseOut, 500 + photographerName.length * 80 + 150);
      }
    };

    const handleMouseOut = () => {
      lettersRef.current.forEach(letter => {
        if (!letter) return;
        letter.style.color = 'black';
        letter.style.textShadow = 'none';
      });

      nameContainer.style.letterSpacing = '-2px';
    };

    // mouseenter/mouseleave no se re-disparan al pasar entre letras
    nameContainer.addEventListener('mouseenter', handleMouseOver);
    nameContainer.addEventListener('mouseleave', handleMouseOut);

    return () => {
      clearTimeout(touchResetTimer);
      nameContainer.removeEventListener('mouseenter', handleMouseOver);
      nameContainer.removeEventListener('mouseleave', handleMouseOut);
    };
  }, [showGallery, photographerName]);

  // FIX: Function to return to main carousel - reset color to white
  const handleBackToCarousel = () => {
    navigate('/');
    setCollection("");
    setSelectedProjectInfo(null);
    setThemeColors(null); // Limpiar colores del tema
    setBgColor('#ffffff'); // FIX: Resetear explícitamente a blanco
  };

  const handleCollectionChange = (newCollection) => {
    const slug = specialCollections[newCollection] || encodeURIComponent(newCollection);
    setCollection(newCollection);
    navigate(`/gallery/${slug}`);
  };

  // Handlers memoizados para evitar re-renders
  const handleProjectInfoChange = useCallback((projectInfo) => {
    console.log("Project info changed:", projectInfo);
    setSelectedProjectInfo(projectInfo);
  }, []);

  const handleUserInactivity = useCallback((inactive) => {
    setIsUserInactive(inactive);
    console.log(`🎯 Usuario ${inactive ? 'INACTIVO' : 'ACTIVO'} - Carrusel ${inactive ? 'PAUSADO' : 'ACTIVO'}`);
  }, []);

  const handleScreensaverDismiss = useCallback(() => {
    console.log("Screensaver dismissed by user activity");
    setIsUserInactive(false);
  }, []);

  // Determine content to show
  const renderHome = () => {
    return (
      <Canvas
        // con aura abierto el carrusel queda tapado: no tiene sentido seguir dibujándolo
        frameloop={auraOpen ? 'never' : 'always'}
        camera={{
          fov: 65,
          position: [0, 0, 41],
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("white");
          glRef.current = gl;
        }}
      >
        <About1
          setIndex={setIndex}
          setShowCollection={() => { }} // Not strictly needed anymore but kept for compatibility
          setCollection={handleCollectionChange}
          setActiveGalleryColor={setBgColor}
          setSelectedProjectInfo={handleProjectInfoChange}
          initialTransition={initialTransition}
          initialImageUrl={transitionImageUrl}
          introRect={introRect}
          onIntroHandoff={handleIntroHandoff}
          onTransitionComplete={handleTransitionComplete}
          onCarouselReady={handleCarouselReady}
          isUserInactive={isUserInactive}
        />
      </Canvas>
    );
  };

  // RENDERIZADO CONDICIONAL: Si es móvil, mostrar Coming Soon
  {/* Si es móvil, mostrar Coming Soon 
  if (isMobile) {
    return <MobileComingSoon />;
  }
  */}

  // Si no es móvil, mostrar la aplicación completa
  return (
    <>
      {/* Global styles */}
      <GlobalStyle />

      {/* Componente de cursor global (ahora inactivo) */}

      {/* SCREENSAVER BANNER ULTRA SMOOTH - 20 SEGUNDOS */}
      <ScreensaverBanner
        isActive={screensaverActive}
        textColor={screensaverText}
        timeout={20000} // 20 SEGUNDOS exactos
        onDismiss={handleScreensaverDismiss}
        onInactivityChange={handleUserInactivity}
        text={{
          line1: "enzo cimillo",
          line2: "fashion photographer"
        }}
      />

      {/* Mostrar IntroVideo solo mientras es necesario */}
      {showIntro && (
        <IntroVideo onIntroComplete={handleIntroComplete} fading={introFading} />
      )}

      {/* Contenedor principal */}
      <ContainerCloud
        className="containerCloud"
        ref={containerRef}
      >
        <Routes>
          <Route path="/" element={
            <>
              {/* Siempre montado: con el menú abierto queda visible detrás del blur */}
              <PhotographerName
                className="photographer-name"
                ref={photographerNameRef}
                style={{ opacity: nameVisible ? 1 : 0 }}
                onClick={handleNameTap}
              >
                {photographerName.split('').map((letter, index) => (
                  <Letter
                    key={index}
                    className="letter"
                    ref={el => lettersRef.current[index] = el}
                  >
                    {letter}
                  </Letter>
                ))}
              </PhotographerName>
              {renderHome()}
              {/* grano vivo sobre el fondo (pointer-events: none) */}
              <div className="bg-grain" aria-hidden="true" />

              {selectedProjectInfo && <span className="mobile-enter-hint" aria-hidden="true">tap to enter</span>}

              <ProjectInfoContainer
                isVisible={!!selectedProjectInfo}
                photoFrac={selectedProjectInfo?.photoFrac}
                liftFrac={selectedProjectInfo?.liftFrac}
                textColor={themeColors?.text || '#000000'}
              >
                {selectedProjectInfo && (
                  <>
                    <ProjectName>
                      <GlitchText text={selectedProjectInfo.name || 'UNTITLED'} />
                    </ProjectName>
                    <ProjectYear>
                      <GlitchText text={selectedProjectInfo.year || '2024'} />
                    </ProjectYear>
                  </>
                )}
              </ProjectInfoContainer>
            </>
          } />
          <Route path="/gallery/:id" element={
            <GalleryWrapper onBack={handleBackToCarousel} slugToImage={slugToImage} />
          } />
          <Route path="/privacy" element={<LegalPage />} />
        </Routes>

        {/* Sin onShowChange: abrir/cerrar el menú no re-renderiza toda la App */}
        {/* Entra junto con el nombre, cuando la imagen de la intro ya llegó al centro */}
        {location.pathname === '/' && <Footer hidden={!nameVisible || !!selectedProjectInfo} />}
      </ContainerCloud>

      {auraOpen && (
        <Suspense fallback={null}>
          <AuraMode onClose={closeAura} />
        </Suspense>
      )}

      {/* Vercel Analytics */}
      <Analytics />
    </>
  );
}

export default App;
