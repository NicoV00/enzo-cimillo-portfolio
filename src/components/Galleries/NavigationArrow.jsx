import React, { useState, useEffect } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import '../glass.css';
import { styled } from '@mui/material/styles';
import { gsap } from 'gsap';

// Botón de volver: el vidrio de la nav (tinte negro 0.3 + blur 25px) con la luz
// enfrentada del cursor "enter portfolio" (.g-light de glass.css). Siempre fijo.
const NavigationArrowButton = styled('button', {
  shouldForwardProp: (prop) => !['isVisible', 'isMobile'].includes(prop),
})(({ isVisible, isMobile }) => ({
  all: 'unset',
  boxSizing: 'border-box',
  position: 'fixed',
  top: isMobile ? '15px' : '20px',
  left: isMobile ? '15px' : '20px',
  zIndex: 9999,
  display: 'grid',
  placeItems: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  color: '#fff',
  background: 'var(--g-dark-bg)',
  WebkitBackdropFilter: 'var(--g-dark-blur)',
  backdropFilter: 'var(--g-dark-blur)',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  opacity: isVisible ? 1 : 0,
  visibility: isVisible ? 'visible' : 'hidden',
  transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
  transition:
    'opacity 0.3s ease, visibility 0.3s, transform 0.35s var(--g-ease), background 0.25s ease, color 0.25s ease',
  '&:hover': { background: 'rgba(0, 0, 0, 0.42)' },
  '&:active': {
    transform: 'scale(0.94)',
    background: 'rgba(244, 244, 244, 0.96)',
    color: '#111',
  },
  '&:focus-visible': { outline: '1px solid rgba(255, 255, 255, 0.7)', outlineOffset: '3px' },
  '& svg': { width: '14px', height: '14px' },
}));

const NavigationArrow = ({ onBack, containerRef, isLoading = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isVisible, setIsVisible] = useState(false);

  // Aparece una vez que termina la carga de la galería y queda fijo
  useEffect(() => {
    if (isLoading) {
      setIsVisible(false);
      return;
    }
    const t = setTimeout(() => setIsVisible(true), 800);
    return () => clearTimeout(t);
  }, [isLoading]);

  const handleClick = () => {
    // Al hacer clic, si hay una función onBack, la llamamos
    if (onBack) {
      onBack();
      return; // Si tenemos onBack, lo usamos y retornamos
    }
    
    // Si no hay onBack, hacemos scroll al inicio
    if (containerRef?.current) {
      const scrollTarget = isMobile 
        ? { scrollTop: 0 } // Para móvil: scroll vertical al inicio
        : { scrollLeft: 0 }; // Para desktop: scroll horizontal al inicio
      
      gsap.to(containerRef.current, {
        ...scrollTarget,
        duration: 0.8,
        ease: "power2.inOut"
      });
    }
  };

  if (isLoading) return null;

  return (
    <NavigationArrowButton 
      isVisible={isVisible}
      isMobile={isMobile}
      type="button"
      className="g-light --square"
      onClick={handleClick}
      aria-label="Back"
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8.75 2.5L4.25 7l4.5 4.5" />
      </svg>
    </NavigationArrowButton>
  );
};

export default NavigationArrow;
