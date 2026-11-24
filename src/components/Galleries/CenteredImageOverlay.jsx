import React, { useEffect } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Add CSS animations globally (only once)
if (typeof document !== 'undefined' && !document.head.querySelector('[data-gallery-animations]')) {
  const animationStyles = `
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `;

  const style = document.createElement('style');
  style.textContent = animationStyles;
  style.setAttribute('data-gallery-animations', 'true');
  document.head.appendChild(style);
}

const CenteredImageOverlay = ({
  isVisible,
  imageIndex,
  imageSrc,
  onOverlayClick,
  onImageClick
}) => {
  // Get theme and check if mobile
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Handle ESC key to close
  useEffect(() => {
    if (!isVisible) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onOverlayClick({ target: e.currentTarget, currentTarget: e.currentTarget });
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isVisible, onOverlayClick]);

  if (!isVisible || imageIndex === null) return null;

  return (
    <Box
      onClick={onOverlayClick}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        cursor: 'zoom-out',
        animation: 'fadeIn 0.3s ease'
      }}
    >
      <Box
        onClick={onImageClick}
        sx={{
          cursor: 'pointer',
          position: 'relative',
          animation: 'scaleIn 0.3s ease',
          display: 'flex',
          // Los límites van en la imagen: con max-height en % sobre un padre de alto
          // auto, las fotos verticales se salían de pantalla a tamaño completo.
          // Así entra entera, centrada y con su proporción original.
          '& img': {
            display: 'block',
            width: 'auto',
            height: 'auto',
            maxWidth: isMobile ? '88vw' : '80vw',
            maxHeight: isMobile ? '70dvh' : '84vh',
            objectFit: 'contain',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }
        }}
      >
        <Box
          component="img"
          src={imageSrc}
          alt={`Centered image ${imageIndex + 1}`}
        />
      </Box>
    </Box>
  );
};

export default CenteredImageOverlay;