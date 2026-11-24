import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import NavigationArrow from './NavigationArrow';
import GalleryLoadingScreen from './GalleryLoadingScreen';
import useSmoothScroll from './useSmoothScroll';
import { getGalleryColors } from '../utils/galleryColors';
import useCenteredImage from './useCenteredImage';
import CenteredImageOverlay from './CenteredImageOverlay';

// Get the color theme for this gallery
const galleryTheme = getGalleryColors('plata');

// Proporción real (ancho / alto) de cada imagen, en el orden de `images`.
// El ancho se fija explícito: con width auto Safari iOS estiraba las fotos.
const RATIOS = [1.274, 1, 1, 1, 1.117, 1.6, 1.518, 4.144, 0.819, 0.8, 3.617, 0.8, 1];

// Alto de pantalla de escritorio para el que está armada la composición.
// En mobile todo (posiciones y altos) escala con el alto visible: se ve como en web, más chico.
const REF_H = 950;

// Custom font loading - solo mantenemos Medium y Myriad para otros usos en la galería
const MediumFontStyle = styled('style')({
  '@font-face': {
    fontFamily: 'Medium OTF',
    src: 'url("/fonts/Medium.otf") format("opentype")',
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontDisplay: 'swap',
  }
});

const MyriadFontStyle = styled('style')({
  '@font-face': {
    fontFamily: 'MYRIADPRO-BOLD',
    src: 'url("/fonts/MYRIADPRO-BOLD.OTF") format("opentype")',
    fontWeight: 'bold',
    fontStyle: 'normal',
    fontDisplay: 'swap',
  }
});

// Optimized scroll progress bar with GPU acceleration
const ScrollProgressBar = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  height: '3px',
  width: '0%',
  backgroundColor: galleryTheme.highlight,
  zIndex: 9999,
  transform: 'translateZ(0)',  // Force GPU acceleration
  willChange: 'width',
  boxShadow: '0 0 3px rgba(255,255,255,0.2)',
});

// Modificación del gradiente en GalleryContainer
const GalleryContainer = styled(Box)(({ theme }) => ({
  width: '100vw',
  height: '100vh',
  position: 'relative',
  overflowX: 'auto',
  overflowY: 'hidden',
  transform: 'translateZ(0)',  // Force GPU acceleration
  perspective: '1000px',      // Enhance GPU acceleration
  backfaceVisibility: 'hidden', // Further GPU optimization
  willChange: 'scroll-position',
  WebkitOverflowScrolling: 'touch',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  // Gradiente mejorado con transición más temprana y negro absoluto al final
  background: 'linear-gradient(to right, #e6e6e6 0%, #e6e6e6 25%, #c8c8c8 40%, #898989 55%, #3b3b3b 70%, #111111 80%, #000000 85%, #000000 100%)',
  backgroundSize: '9600px 100%',
  backgroundAttachment: 'local',
  [theme.breakpoints.down('sm')]: {
    overflowX: 'auto',
    overflowY: 'hidden',
    // alto visible (en iOS 100vh es más alto que la pantalla y cortaba las fotos)
    height: '100dvh',
    minHeight: 0,
    // mismo degradé que en web, escalado como el contenido
    backgroundSize: `calc(9600 * 100dvh / ${REF_H}) 100%`,
  },
}));

// Content container
const GalleryContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '9600px',
  height: '100%',
  padding: '40px',
  paddingRight: '300px',
  position: 'relative',
  transform: 'translateZ(0)',  // Force GPU acceleration
  [theme.breakpoints.down('sm')]: {
    // misma composición que en web, escalada con el alto visible
    width: `calc(9600 * 100dvh / ${REF_H})`,
    padding: 0,
  },
}));

// Image item with GPU acceleration - Sin sombras
const ImageItem = styled(Box, {
  shouldForwardProp: (prop) => !['isMobile', 'top', 'left', 'isVisible', 'ratio'].includes(prop)
})(({ theme, top, left, width, height, ratio, zIndex = 1, isMobile = false, isVisible = true }) => ({
  position: 'absolute',
  top,
  left,
  width: ratio ? `calc(${height} * ${ratio})` : width,
  height: height,
  zIndex: zIndex,
  marginBottom: isMobile ? '0' : '0', // Removed margin for mobile
  opacity: isVisible ? 1 : 0,
  transform: isVisible ? 'translateZ(0)' : 'translateZ(0) scale(0.98)',
  transition: 'opacity 0.5s ease, transform 0.5s ease',
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden', // GPU optimization
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '2px',
    boxShadow: 'none', // Sin sombras
    backfaceVisibility: 'hidden',
    transform: 'translateZ(0)', // Force GPU acceleration
  },
  '& video': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '2px',
    boxShadow: 'none', // Sin sombras
    transform: 'translateZ(0)', // Force GPU acceleration
  }
}));

const PlataGallery = ({ onBack }) => {
  // Loading screen state
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // References for animation elements
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);

  // Image visibility state and references with optimized memory usage
  const [visibleImages, setVisibleImages] = useState({});
  const imageRefs = useRef([]);

  // Use centered image hook
  const {
    centeredImage,
    isImageCentered,
    handleImageClick,
    handleCenteredImageClick,
    handleOverlayClick
  } = useCenteredImage();

  // Images for PLATA - using the correct folder path
  const images = useMemo(() => ({
    P1: '/images/PLATA/PLATA-1.png',
    P2: '/images/PLATA/webp/PLATA-2.webp',
    P3: '/images/PLATA/webp/PLATA-3.webp',
    P4: '/images/PLATA/PLATA-4.png',
    P5: '/images/PLATA/PLATA-5.png',
    P6: '/images/PLATA/webp/PLATA-6.webp',
    P7: '/images/PLATA/PLATA-7.png',
    P8: '/images/PLATA/PLATA-8.png',
    P9: '/images/PLATA/webp/PLATA-9.webp',
    P10: '/images/PLATA/PLATA-10.webp',
    P11: '/images/PLATA/PLATA-11.png',
    P12: '/images/PLATA/webp/PLATA-12.webp',
    P13: '/images/PLATA/webp/PLATA-13.webp'
  }), []);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Unidades: escritorio igual que siempre (px / vh); mobile escala con el alto visible
  const X = (px) => (isMobile ? `calc(${px} * 100dvh / ${REF_H})` : `${px}px`);
  const H = (vh) => (isMobile ? `${vh}dvh` : `${vh}vh`);

  // Optimized visibility checking - throttled for performance
  const checkVisibility = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Increased preload margin for smoother experience
    const preloadMargin = containerWidth * 1.2;

    const newVisibility = {};

    imageRefs.current.forEach((ref, index) => {
      if (ref && ref.current) {
        const imageRect = ref.current.getBoundingClientRect();

        // Always use horizontal scrolling check logic regardless of device
        const isVisible = (
          imageRect.left < containerRect.right + preloadMargin &&
          imageRect.right > containerRect.left - preloadMargin
        );

        newVisibility[index] = isVisible;
      }
    });

    // Only update state if visibility has changed
    setVisibleImages(prev => {
      if (JSON.stringify(prev) !== JSON.stringify(newVisibility)) {
        return newVisibility;
      }
      return prev;
    });
  }, [isMobile]);

  // Use the optimized smooth scroll hook with theme colors
  const { scrollLeft, scrollProgress, lenis } = useSmoothScroll({
    containerRef,
    isMobile,
    isLoading: loading || isImageCentered, // Pause scroll when image is centered
    checkVisibility,
    horizontal: true, // Always use horizontal scrolling for both desktop and mobile
    duration: 2.5,           // Extended duration for smoother motion
    wheelMultiplier: 1.2,     // Higher multiplier for more responsive scrolling
    touchMultiplier: 2,       // Higher touch multiplier
    lerp: 0.04,               // Lower lerp for ultra smooth motion
    colors: galleryTheme
  });

  // Loading progress animation effect
  useEffect(() => {
    let interval;

    if (loading) {
      interval = setInterval(() => {
        setLoadProgress(prev => {
          const next = prev + (Math.random() * 15);
          if (next >= 100) {
            clearInterval(interval);
            return 100;
          }
          return next;
        });
      }, 250);
    }

    return () => clearInterval(interval);
  }, [loading]);

  // Force loading to complete after a timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [loading]);

  // Handle loading animation complete
  const handleLoadingComplete = () => {
    setLoading(false);
  };

  // Optimize browser performance
  useEffect(() => {
    // Optimize browser performance during scrolling
    if (!loading) {
      // Add will-change hint to body for smoother overall page performance
      document.body.style.willChange = 'scroll-position';

      // Disable overscroll for smoother experience
      document.body.style.overscrollBehavior = 'none';

      // Enable smooth scrolling at the browser level for maximum smoothness
      document.documentElement.style.scrollBehavior = 'smooth';
    }

    return () => {
      // Cleanup optimizations when component unmounts
      document.body.style.willChange = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.scrollBehavior = '';
    };
  }, [loading]);

  // Set up optimized IntersectionObserver for visibility detection
  useEffect(() => {
    if (loading || !containerRef.current) return;

    checkVisibility();

    if ('IntersectionObserver' in window) {
      const options = {
        root: containerRef.current, // Always use container as root for both mobile and desktop
        rootMargin: '300px', // Increased margin for earlier loading
        threshold: 0.1
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const id = entry.target.dataset.id;
          if (id) {
            setVisibleImages(prev => ({
              ...prev,
              [id]: entry.isIntersecting
            }));
          }
        });
      }, options);

      imageRefs.current.forEach((ref, index) => {
        if (ref?.current) {
          ref.current.dataset.id = index;
          observer.observe(ref.current);
        }
      });

      return () => {
        imageRefs.current.forEach(ref => {
          if (ref?.current) observer.unobserve(ref.current);
        });
        observer.disconnect();
      };
    }
  }, [loading, isMobile, checkVisibility]);

  // Always use desktop view rendering regardless of device
  const renderGalleryContent = () => (
    <>
      {/* Grupo de primeras imágenes (basado en el layout que se ve en la imagen) */}
      <ImageItem
        ref={el => imageRefs.current[0] = el}
        ratio={RATIOS[0]}
        top="90%"
        left={X(450)}
        height={H(10)}
        zIndex={2}
        isVisible={visibleImages[0] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , pointerEvents: 'none'}}>
        <Box component="img" src={images.P1} alt="PLATA 1" loading="eager" />
      </ImageItem>

      <ImageItem
        ref={el => imageRefs.current[1] = el}
        ratio={RATIOS[1]}
        top="50%"
        left={X(600)}
        height={H(75)}
        zIndex={2}
        isVisible={visibleImages[1] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(1)}>
        <Box component="img" src={images.P2} alt="PLATA 2" loading="eager" />
      </ImageItem>

      {/* Icono plus */}
      <ImageItem
        ref={el => imageRefs.current[2] = el}
        ratio={RATIOS[2]}
        top="50%"
        left={X(1350)}
        height={H(75)}
        zIndex={3}
        isVisible={visibleImages[2] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(2)}>
        <Box component="img" src={images.P3} alt="PLATA 3" loading="eager" />
      </ImageItem>

      {/* Imagen central */}
      <ImageItem
        ref={el => imageRefs.current[3] = el}
        ratio={RATIOS[3]}
        top="50%"
        left={X(2000)}
        height={H(100)}
        zIndex={2}
        isVisible={visibleImages[3] !== false}
        isMobile={isMobile}
        sx={{
          transform: 'translateY(-50%) translateZ(0) rotate(10deg) scale(1.4)', // Añadido rotate y scale
          transformOrigin: 'center center',
        pointerEvents: 'none',
        }}>
        <Box component="img" src={images.P4} alt="PLATA 4" loading="eager" />
      </ImageItem>

      {/* Logo BLUE */}
      <ImageItem
        ref={el => imageRefs.current[4] = el}
        ratio={RATIOS[4]}
        top="80%"
        left={X(2780)}
        height={H(10)}
        zIndex={2}
        isVisible={visibleImages[4] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , pointerEvents: 'none'}}>
        <Box component="img" src={images.P5} alt="PLATA 5" loading="eager" />
      </ImageItem>

      {/* imagen central */}
      <ImageItem
        ref={el => imageRefs.current[5] = el}
        ratio={RATIOS[5]}
        top="45%"
        left={X(2900)}
        height={H(60)}
        zIndex={2}
        isVisible={visibleImages[5] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(5)}>
        <Box component="img" src={images.P6} alt="PLATA 6" loading="eager" />
      </ImageItem>

      {/* Logo PLATA grande como textura de fondo */}
      <ImageItem
        ref={el => imageRefs.current[6] = el}
        ratio={RATIOS[6]}
        top="88%"
        left={X(3550)}
        height={H(15)}
        zIndex={1}
        isVisible={visibleImages[6] !== false}
        isMobile={isMobile}
        sx={{
          transform: 'translateY(-50%) translateZ(0)',
        pointerEvents: 'none',
        }}>
        <Box component="img" src={images.P7} alt="PLATA 7" loading="lazy" />
      </ImageItem>

      {/* Imágenes en UV (morado) */}
      <ImageItem
        ref={el => imageRefs.current[7] = el}
        ratio={RATIOS[7]}
        top="6%"
        left={X(4050)}
        height={H(5)}
        zIndex={3}
        isVisible={visibleImages[7] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , pointerEvents: 'none'}}>
        <Box component="img" src={images.P8} alt="PLATA 8" loading="lazy" />
      </ImageItem>

      <ImageItem
        ref={el => imageRefs.current[8] = el}
        ratio={RATIOS[8]}
        top="50%"
        left={X(4300)}
        height={H(90)}
        zIndex={3}
        isVisible={visibleImages[8] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(8)}>
        <Box component="img" src={images.P9} alt="PLATA 9" loading="lazy" />
      </ImageItem>

      {/* remeras */}
      <ImageItem
        ref={el => imageRefs.current[9] = el}
        ratio={RATIOS[9]}
        top="50%"
        left={X(5350)}
        height={H(170)}
        zIndex={3}
        isVisible={visibleImages[9] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(9)}>
        <Box component="img" src={images.P10} alt="PLATA 10" loading="lazy" />
      </ImageItem>

      <ImageItem
        ref={el => imageRefs.current[10] = el}
        ratio={RATIOS[10]}
        top="55%"
        left={X(5300)}
        height={H(70)}
        zIndex={1}
        isVisible={visibleImages[10] !== false}
        isMobile={isMobile}
        sx={{
          transform: 'translateY(-50%) translateZ(0)',
          opacity: 0.2, // opacidad (0 transparente, 1 opaco)
        pointerEvents: 'none',
        }}>
        <Box component="img" src={images.P11} alt="PLATA 11" loading="lazy" />
      </ImageItem>

      {/* Las dos últimas fotos sobre fondo negro puro */}
      <ImageItem
        ref={el => imageRefs.current[11] = el}
        ratio={RATIOS[11]}
        top="50%"
        left={X(7980)}
        height={H(100)}
        zIndex={4}
        isVisible={visibleImages[11] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(11)}>
        <Box component="img" src={images.P12} alt="PLATA 12" loading="lazy" />
      </ImageItem>

      <ImageItem
        ref={el => imageRefs.current[12] = el}
        ratio={RATIOS[12]}
        top="50%"
        left={X(8700)}
        height={H(100)}
        zIndex={4}
        isVisible={visibleImages[12] !== false}
        isMobile={isMobile}
        sx={{ transform: 'translateY(-50%) translateZ(0)' , cursor: 'pointer'}}
      
        onClick={() => handleImageClick(12)}>
        <Box component="img" src={images.P13} alt="PLATA 13" loading="lazy" />
      </ImageItem>
    </>
  );

  return (
    <>
      <MediumFontStyle />

      {/* Centered image overlay - only show when not loading */}
      {!loading && (
        <CenteredImageOverlay
          isVisible={isImageCentered}
          imageIndex={centeredImage}
          imageSrc={centeredImage !== null ? (Array.isArray(images) ? images[centeredImage] : Object.values(images)[centeredImage]) : null}
          onOverlayClick={handleOverlayClick}
          onImageClick={handleCenteredImageClick}
        />
      )}
      <MyriadFontStyle />

      {/* Loading screen component */}
      <GalleryLoadingScreen
        title="Plata, Blua"
        year="2024"
        loading={loading}
        loadProgress={loadProgress}
        onAnimationComplete={handleLoadingComplete}
        backgroundColor="#e6e6e6"
        textColor="#000000"
        progressColor="#000000"
      />

      {/* Scroll progress bar - always visible after loading but controlled by Lenis via data-scroll-progress */}
      <ScrollProgressBar
        ref={progressBarRef}
        data-scroll-progress
        sx={{
          opacity: loading ? 0 : 1,
        cursor: 'pointer',
        }}
      />

      {/* Navigation arrow */}
      <NavigationArrow
        onBack={onBack}
        containerRef={containerRef}
        colors={galleryTheme}
        isLoading={loading}
      />

      <GalleryContainer ref={containerRef}>
        <GalleryContent>
          {renderGalleryContent()}
        </GalleryContent>
      </GalleryContainer>
    </>
  );
};

export default PlataGallery;
