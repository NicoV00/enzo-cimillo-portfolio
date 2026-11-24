// src/components/MyWaySection.jsx
import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import './glass.css';

// Flecha fina, misma línea que la del menú (ArrowIcon)
const BackArrow = () => (
  <svg viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square">
    <path d="M13 5H1.6M5.4 1.2L1.6 5l3.8 3.8" />
  </svg>
);

// Declaración de la fuente Helvetica-Bold
const fontFaceStyle = `
  @font-face {
    font-family: 'Helvetica-Bold';
    src: url('/fonts/Helvetica-Bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
`;

// Líneas de perspectiva: viewBox 1200x1000, el punto de fuga queda en (600, 0).
// Cada línea arranca donde termina la línea recta del plano normal (cada 1/12 del ancho).
const PERSPECTIVE_LINES = Array.from({ length: 37 }, (_, i) => `M${(i - 12) * 100} 1000L600 0`).join('');

const MyWaySection = ({ onBack }) => {
  const sectionRef = useRef(null);
  const scrollRef = useRef({ p: 0, sp: 0 });

  // Inyectar los estilos de fuente al montarse el componente
  useEffect(() => {
    if (!document.getElementById('helvetica-bold-font')) {
      const style = document.createElement('style');
      style.id = 'helvetica-bold-font';
      style.innerHTML = fontFaceStyle;
      document.head.appendChild(style);
    }
  }, []);

  // Optimizado: usar requestAnimationFrame directamente para mejor rendimiento
  useEffect(() => {
    let animationFrameId = null;
    
    const tick = () => {
      const scroll = scrollRef.current;
      const next = scroll.sp + (scroll.p - scroll.sp) * 0.08;
      // Escribir la variable CSS directo (sin re-render de React) y solo si cambió
      if (Math.abs(next - scroll.sp) > 0.00005 && sectionRef.current) {
        sectionRef.current.style.setProperty('--scroll-progress', next.toFixed(5));
      }
      scroll.sp = next;
      animationFrameId = requestAnimationFrame(tick);
    };

    const handleScroll = () => {
      if (!sectionRef.current) return;
      
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const sectionHeight = rect.height;
      
      const start = rect.top + scrollY;
      const end = start + sectionHeight + windowHeight;
      const trigger = scrollY + windowHeight;

      if (trigger < start) {
        scrollRef.current.p = 0;
      } else if (trigger > end) {
        scrollRef.current.p = 1;
      } else {
        scrollRef.current.p = (trigger - start) / (end - start);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    
    handleScroll(); // Initial calculation
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <>
      <Box
        ref={sectionRef}
        sx={{
          '--padding': '25rem', // REDUCIDO para ver las letras antes
          '--scroll-progress': 0,
          '--distortion': 50,

          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 3,
          padding: 'calc(var(--padding) * 0.3) 0 calc(var(--padding) * 0.8)', // REDUCIDO
          minHeight: '120vh', // REDUCIDO de 200vh a 120vh
          background: '#f5f5f5',

          '@media (max-width: 768px)': {
            '--padding': '6rem', // Reducido AUN MAS para móvil (de 8rem a 6rem)
            minHeight: '90vh', // Reducido para scroll más corto
            padding: 'calc(var(--padding) * 0.15) 0 calc(var(--padding) * 0.4)', // Menos espacio arriba y abajo
          }
        }}
      >
        {/* EL TEXTO PRINCIPAL CON MATRIX3D */}
        <Box
          sx={{
            '--amplitude': '50%',
            '--offset': '15%',
            position: 'absolute',
            bottom: 0,
            left: 0,
            zIndex: 2,
            width: '100%',
            height: 'calc(var(--padding) * 1.05 + 5rem)',
            perspective: 'calc(var(--distortion) * 0.85em)',
            userSelect: 'none',
            fontFamily: 'Helvetica-Bold, Helvetica, Arial, sans-serif',
            fontWeight: 700,
            fontSize: 'calc(var(--padding) * 1.2)',
            lineHeight: 0.82,
            textAlign: 'center',
            textTransform: 'none', // Sin transformación
            whiteSpace: 'nowrap',

            '@media (max-width: 768px)': {
              '--amplitude': '75%',
              '--offset': '27.5%',
              perspective: 'calc(var(--distortion) * 1.05em)',
              fontSize: 'calc(var(--padding) * 0.9)',
            }
          }}
        >
          {/* Líneas que fugan hasta el horizonte del plano distorsionado.
              Fuga = centro del wrapper (0.75 * padding) + perspective / distortion (0.7em, 0.85em en móvil) */}
          <Box
            component="svg"
            viewBox="0 0 1200 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: 'calc(var(--padding) * 0.75 + 0.7em)',
              pointerEvents: 'none',
              overflow: 'visible',

              '@media (max-width: 768px)': {
                height: 'calc(var(--padding) * 0.75 + 0.85em)',
              }
            }}
          >
            <defs>
              <linearGradient id="myway-lines-fade" gradientUnits="userSpaceOnUse" x1="0" y1="1000" x2="0" y2="0">
                <stop offset="0" stopColor="#000" stopOpacity="0.24" />
                <stop offset="0.7" stopColor="#000" stopOpacity="0.14" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={PERSPECTIVE_LINES}
              fill="none"
              stroke="url(#myway-lines-fade)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </Box>

          {/* Distorted wrapper */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: 'calc(var(--padding) * 1.5)',
              overflow: 'hidden',
              perspective: 'calc(var(--distortion) * 0.7em)',

              '@media (max-width: 768px)': {
                perspective: 'calc(var(--distortion) * 0.85em)',
              }
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: '-100%',
                width: '300%',
                height: 'calc(var(--padding) * 1.05 + 5rem)',
                transformOrigin: '50% 100%',
                transform: `matrix3d(
                  1,
                  0,
                  0,
                  0,
                  0,
                  1,
                  var(--distortion),
                  0,
                  0,
                  0,
                  1,
                  0,
                  0,
                  0,
                  0,
                  1
                )`,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  willChange: 'transform',
                  color: '#000',
                  transform: `translate3d(
                    0,
                    calc(var(--scroll-progress) * var(--amplitude) - var(--offset)),
                    0
                  )`,
                }}
              >
                Project <br />
                under <br />
                creation <br />
                <Box component="span" sx={{ color: '#ff0000', fontSize: '1.2em' }}>
                  
                  404
                </Box>
                
                {/* Botón volver al carrusel */}
                <Box
                  sx={{
                    marginTop: '6rem',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <button type="button" className="g-btn g-dark" onClick={onBack}>
                    <BackArrow /> volver al carrusel
                  </button>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Normal wrapper */}
          <Box
            sx={{
              position: 'absolute',
              top: 'calc(100% - 1px)',
              left: 0,
              width: '100%',
              height: 'calc(100% + 100vh)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '300%',
                height: '100%',
                // Líneas de perspectiva: en el plano distorsionado fugan hacia atrás, en el normal bajan rectas
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.24) 0 1px, transparent 1px calc(100% / 36))',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  willChange: 'transform',
                  color: '#000',
                  transform: `translate3d(
                    0,
                    calc(
                      var(--scroll-progress) * var(--amplitude) - 100% - var(--offset)
                    ),
                    0
                  )`,
                }}
              >
                project <br />
                under <br />
                creation <br />
                <Box component="span" sx={{ color: '#ff0000', fontSize: '1.2em' }}>
                  404
                </Box>
                
                {/* Botón duplicado para el wrapper normal */}
                <Box
                  sx={{
                    marginTop: '6rem',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <button type="button" className="g-btn g-dark" onClick={onBack}>
                    <BackArrow /> volver al carrusel
                  </button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Botón volver arriba (fijo) */}
        <button
          type="button"
          className="g-btn g-dark"
          onClick={onBack}
          style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 1000 }}
        >
          <BackArrow /> volver al carrusel
        </button>
      </Box>
    </>
  );
};

export default MyWaySection;
