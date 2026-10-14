// src/components/MyWaySection.jsx
import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

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

const MyWaySection = ({ onBack, onBackToGalleries }) => {
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
                // Líneas de perspectiva: en el plano distorsionado fugan hacia atrás, en el normal bajan rectas
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 1px, transparent 1px calc(100% / 36))',
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
                
                {/* Botón volver a galerías */}
                <Box
                  sx={{
                    marginTop: '6rem',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    component="button"
                    onClick={onBackToGalleries}
                    sx={{
                      padding: '12px 24px',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fontFamily: 'Helvetica-Bold, Helvetica, Arial, sans-serif',
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: '#333',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    ← volver a las galerías
                  </Box>
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
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 1px, transparent 1px calc(100% / 36))',
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
                  <Box
                    component="button"
                    onClick={onBackToGalleries}
                    sx={{
                      padding: '12px 24px',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fontFamily: 'Helvetica-Bold, Helvetica, Arial, sans-serif',
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        backgroundColor: '#333',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    ← volver a las galerías
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Botón volver arriba (fijo) */}
        <button 
          onClick={onBack}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 1000,
            padding: '12px 24px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s ease',
            fontFamily: 'Helvetica-Bold, Helvetica, Arial, sans-serif'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#333';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#000';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          ← volver al carrusel
        </button>
      </Box>
    </>
  );
};

export default MyWaySection;
