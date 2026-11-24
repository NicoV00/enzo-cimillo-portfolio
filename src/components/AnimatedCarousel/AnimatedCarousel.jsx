import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { optimizedCover } from "../utils/coverImages";
import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import ImageMesh from './ImageMesh';

const WHITE_BG = new THREE.Color('#ffffff');
const HOVER_BG = new THREE.Color('#e4e4e4');
import { getGalleryColors } from '../utils/galleryColors';

// Distancia de reposo de la cámara (vista general de la nube)
const CAMERA_DIST = 41;

// Las fotos copian la rotación de la cámara (billboard plano) en vez de lookAt:
// lookAt las inclinaba al subir/bajar la vista. Se descuenta el giro del grupo padre.
const _parentQ = new THREE.Quaternion();
const faceCamera = (obj, camera) => {
  if (obj.parent) obj.parent.getWorldQuaternion(_parentQ).invert();
  else _parentQ.identity();
  obj.quaternion.multiplyQuaternions(_parentQ, camera.quaternion);
};

// Mueve la cámara en órbita alrededor del origen (interpola distancia y ángulos)
// en vez de en línea recta: así el encuadre no hace barridos raros al ir/volver
const tweenCameraOrbit = (timeline, camera, to, vars, position = 0) => {
  const from = new THREE.Spherical().setFromVector3(camera.position);
  const end = new THREE.Spherical().setFromVector3(new THREE.Vector3(to.x, to.y, to.z));
  // camino angular más corto
  let dTheta = end.theta - from.theta;
  if (dTheta > Math.PI) dTheta -= Math.PI * 2;
  if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  const state = { t: 0 };
  const tmp = new THREE.Spherical();
  return timeline.to(state, {
    t: 1,
    ...vars,
    onUpdate: () => {
      const k = state.t;
      tmp.set(
        from.radius + (end.radius - from.radius) * k,
        from.phi + (end.phi - from.phi) * k,
        from.theta + dTheta * k
      );
      camera.position.setFromSpherical(tmp);
      camera.lookAt(0, 0, 0);
    },
  }, position);
};

const checkIsMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth <= 768;
};


const AnimatedCarousel = ({
  setShowCollection,
  setCollection,
  setIndex,
  setActiveGalleryColor,
  setSelectedProjectInfo,
  initialTransition = false,
  initialImageUrl = null,
  onTransitionComplete = null,
  introRect = null,
  onIntroHandoff = null,
  isUserInactive = false
}) => {
  // MOBILE DETECTION
  const isMobile = useRef(checkIsMobile()).current;


  // ALWAYS HIGH QUALITY - No quality switch
  const isHighQuality = true; // Siempre máxima calidad
  const [isInitializing, setIsInitializing] = useState(initialTransition);
  const hasStartedTransitionRef = useRef(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);

  // OPTIMIZED IMAGE URLS - Consider using lower resolution versions for mobile
  const imageUrls = useMemo(() => {
    const baseUrls = [
      "./images/CALDO/CALDO-1 (PORTADA).jpg",
      "./images/blua_constelaciones_finales.jpg",
      "./images/PLATA/PLATA-2.jpg",
      "./images/TEO/V1.jpg",
      "./images/S-1.jpg",
      "./images/MDLST/MDLST-1.png",
      "./images/AMOUR/portada.jpg",
      "./images/MARCOS/MARCOSMUF-5 (PORTADA).jpg",
      "./images/PASARELA/PASARELA MUF-12(PORTADA).jpg",
      "./images/IDENTIDAD/IDENTIDAD MUF-1 (PORTADA).jpg",
      "./images/X/@enzocimillo_ex-_1.jpg",
    ];

    // MOBILE OPTIMIZATION: Limit number of images on mobile
    if (isMobile) {
      return baseUrls.slice(0, 15); // Show only 10 images on mobile
    }
    return baseUrls;
  }, [isMobile]);

  const projectInfo = useMemo(() => ({
    "./images/CALDO/CALDO-1 (PORTADA).jpg": { name: "Caldo Bastardo", year: "2024" },
    "./images/blua_constelaciones_finales.jpg": { name: "Constelación, Blua", year: "2024" },
    "./images/PLATA/PLATA-2.jpg": { name: "Plata, Blua", year: "2024" },
    "./images/CAT-17.jpg": { name: "Catatumbo", year: "2024" },
    "./images/NWB&W-09.jpg": { name: "Neam Wave", year: "2024" },
    "./images/S-1.jpg": { name: "Ana Livni", year: "2024" },
    "./images/MDLST/MDLST-1.png": { name: "Maison de l'Est", year: "2024" },
    "./images/TEO/V1.jpg": { name: "La Notte, Vestimeteo", year: "2024" },
    "./images/LENOIR/LENOIR-1.jpg": { name: "Lenoir", year: "2024" },
    "./images/KABOA/KABOA-1.jpg": { name: "Kaboa SS24", year: "2024" },
    "./images/AMOUR/portada.jpg": { name: "A del Amour", year: "2024" },
    "./images/MARCOS/MARCOSMUF-5 (PORTADA).jpg": { name: "Catálogo MUF", year: "2024" },
    "./images/PASARELA/PASARELA MUF-12(PORTADA).jpg": { name: "Pasarela MUF", year: "2024" },
    "./images/IDENTIDAD/IDENTIDAD MUF-1 (PORTADA).jpg": { name: "Montevideo Under Fashion", year: "2024" },
    "./images/X/@enzocimillo_ex-_1.jpg": { name: "ex-", year: "2026" }
  }), []);

  const initialImageIndex = useMemo(() => {
    if (!initialImageUrl) return -1;
    return imageUrls.findIndex(url => url === initialImageUrl);
  }, [imageUrls, initialImageUrl]);

  // TEXTURE LOADING OPTIMIZATION
  const textures = useLoader(
    THREE.TextureLoader,
    imageUrls.map(optimizedCover),
    (loader) => {
      loader.setCrossOrigin('anonymous');
    }
  );

  // OPTIMIZE TEXTURES FOR MOBILE AND CLEANUP ON UNMOUNT
  useEffect(() => {
    if (isMobile) {
      textures.forEach((texture) => {
        // Reduce texture resolution for mobile
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        // Dispose of unnecessary data
        if (texture.image) {
          const maxSize = 1024; // Max texture size for mobile
          if (texture.image.width > maxSize || texture.image.height > maxSize) {
            texture.needsUpdate = true;
          }
        }
      });
    }

    // CLEANUP: Dispose textures on unmount
    return () => {
      console.log('🧹 Cleaning up textures...');
      textures.forEach((texture) => {
        if (texture) {
          texture.dispose();
        }
      });
    };
  }, [textures, isMobile]);

  const refsRef = useRef([]);
  if (refsRef.current.length !== textures.length) {
    refsRef.current = Array.from({ length: textures.length }, () => ({ current: null }));
  }
  const refs = refsRef.current;

  // ADJUSTED POSITIONS FOR MOBILE
  const originalPositions = useMemo(() => {
    // Blua stays at the origin for the intro; the remaining covers have room to breathe.
    const desktopPositions = [
      [-7, -8, 4],
      [0, 0, 14],
      [3, 0, -7],
      [-16, 0, 0],
      [-10, 7, 2],
      [8, -8, 1],
      [-3, 6, -6],
      [11, 8, 2],
      [-8, -5, -5],
      [16, 1, -3],
      [1, -8, 8],
    ];

    // Scale down positions for mobile
    if (isMobile) {
      // Pre-calcular sin crear arrays intermedios
      const scaled = [];
      const len = Math.min(desktopPositions.length, imageUrls.length);
      for (let i = 0; i < len; i++) {
        const pos = desktopPositions[i];
        scaled[i] = [pos[0] * 0.7, pos[1] * 0.7, pos[2] * 0.7];
      }
      return scaled;
    }

    return desktopPositions;
  }, [isMobile, imageUrls.length]);

  const groupRef = useRef();
  const [selectedImage, setSelectedImage] = useState([]);
  // la imagen bajo el cursor: las demás se apagan un poco
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Al salir de una imagen se espera un poco antes de soltar el hover: si el cursor
  // pasa rápido a otra, el apagado se mantiene en vez de prenderse y apagarse
  const hoverOutTimer = useRef(null);
  const handleHoverChange = useCallback((index, on) => {
    clearTimeout(hoverOutTimer.current);
    if (on) {
      setHoveredIndex(index);
      return;
    }
    hoverOutTimer.current = setTimeout(() => {
      setHoveredIndex((prev) => (prev === index ? null : prev));
    }, 220);
  }, []);
  useEffect(() => () => clearTimeout(hoverOutTimer.current), []);
  const [isImageUpFront, setIsImageUpFront] = useState(false);
  const cameraRef = useRef();
  const controls = useThree((state) => state.controls);

  // Sin zoom in/out mientras una imagen está seleccionada al frente
  useEffect(() => {
    if (controls) controls.enableZoom = !isImageUpFront;
  }, [controls, isImageUpFront]);
  const raycaster = useRef(new THREE.Raycaster()).current;
  const mouse = useRef(new THREE.Vector2()).current;
  const dragRef = useRef({ active: false, moved: false, startX: 0, lastX: 0, target: 0, applied: 0, velocity: 0 });
  const [loadedIndices, setLoadedIndices] = useState([]);
  const animationInProgressRef = useRef(false);
  const timelineRef = useRef(null);
  const backgroundRef = useRef(null);
  if (!backgroundRef.current) {
    backgroundRef.current = new THREE.Color('white');
  }
  // FRAME RATE LIMITER FOR MOBILE
  const frameCount = useRef(0);
  const skipFrames = isMobile ? 2 : 1; // Skip every other frame on mobile

  // CLEANUP: Kill all GSAP animations on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up GSAP animations...');
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      // No usar killTweensOf("*"): mata también los tweens de la nav y el menú
      // y deja el modal trabado a mitad de animación
    };
  }, []);

  useEffect(() => {
    textures.forEach((_, index) => {
      setLoadedIndices(prev => [...prev, index]);
    });
  }, [textures]);

  // OPTIMIZED INITIAL TRANSITION
  useEffect(() => {
    if (initialTransition && initialImageIndex !== -1 && refs[initialImageIndex]?.current
      && !hasStartedTransitionRef.current && !animationInProgressRef.current) {

      hasStartedTransitionRef.current = true;
      animationInProgressRef.current = true;
      setIsInitializing(true);

      refs.forEach((ref, idx) => {
        if (ref.current) {
          ref.current.visible = idx === initialImageIndex;
          if (idx !== initialImageIndex) {
            ref.current.scale.set(0.001, 0.001, 0.001);
            if (ref.current.material) {
              ref.current.material.transparent = true;
              ref.current.material.opacity = 0;
            }
          }
        }
      });

      const targetRef = refs[initialImageIndex].current;
      const camera = cameraRef.current;

      if (targetRef && camera) {
        const finalPosition = [...originalPositions[initialImageIndex]];

        // El carrusel estuvo girando detrás del video (~15° al terminar la intro):
        // sin esto la imagen viaja rotada y llega corrida del centro
        if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);

        camera.position.set(0, 0, 6);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();

        // Pose inicial calzada sobre el último frame del video (mismo tamaño y
        // posición en pantalla), así el corte video → 3D es invisible
        const viewH = introRect?.viewH || window.innerHeight;
        const worldPerPx = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / viewH;
        const planeH = targetRef.children[0]?.geometry?.parameters?.height || (isMobile ? 3.2 : 5);
        const rect = introRect || { side: Math.max(window.innerWidth, viewH), cx: 0, cy: 0 };
        const startScale = (rect.side * worldPerPx) / planeH;

        targetRef.position.set(rect.cx * worldPerPx, -rect.cy * worldPerPx, 0);
        targetRef.rotation.set(0, 0, 0);
        targetRef.scale.set(startScale, startScale, startScale);

        // SIMPLIFIED ANIMATION FOR MOBILE
        const duration = isMobile ? 1.2 : 1.8;
        const timeline = gsap.timeline({
          paused: true,
          onComplete: () => {
            gsap.set(targetRef.position, {
              x: finalPosition[0],
              y: finalPosition[1],
              z: finalPosition[2],
              overwrite: true,
              force3D: false // Disable 3D transform on mobile
            });

            gsap.set(targetRef.scale, {
              x: 1,
              y: 1,
              z: 1,
              overwrite: true
            });

            gsap.set(camera.position, {
              x: 0,
              y: 0,
              z: CAMERA_DIST,
              overwrite: true
            });

            if (targetRef.material) {
              targetRef.material.opacity = 1;
            }

            setIsInitializing(false);
            animationInProgressRef.current = false;
            if (onTransitionComplete) {
              onTransitionComplete();
            }
          }
        });

        timeline.to(targetRef.position, {
          x: finalPosition[0],
          y: finalPosition[1],
          z: finalPosition[2],
          duration: duration,
          ease: isMobile ? "power2.inOut" : "power3.inOut"
          // Sin lookAt: girar hacia la cámara en el primer frame producía un tirón
        }, 0);

        timeline.to(targetRef.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: duration,
          ease: isMobile ? "power2.inOut" : "power3.inOut"
        }, 0);

        timeline.to(camera.position, {
          x: 0,
          y: 0,
          z: CAMERA_DIST,
          duration: duration,
          ease: isMobile ? "power2.inOut" : "power3.inOut"
        }, 0);

        timeline.call(() => {
          refs.forEach((ref, idx) => {
            if (ref.current && idx !== initialImageIndex) {
              ref.current.visible = true;

              // SIMPLIFIED ANIMATION FOR OTHER IMAGES ON MOBILE
              const animDuration = isMobile ? 0.8 : 1.2;
              const delay = isMobile ? 0.05 : (0.1 + (Math.random() * 0.4));

              gsap.fromTo(ref.current.scale,
                { x: 0.001, y: 0.001, z: 0.001 },
                {
                  x: 1,
                  y: 1,
                  z: 1,
                  duration: animDuration,
                  delay: delay,
                  ease: isMobile ? "power2.out" : "back.out(1.3)",
                  onUpdate: isMobile ? null : () => {
                    if (ref.current) {
                      faceCamera(ref.current, camera);
                    }
                  }
                }
              );

              if (ref.current.material) {
                gsap.fromTo(ref.current.material,
                  { opacity: 0 },
                  {
                    opacity: 1,
                    duration: animDuration,
                    delay: delay,
                    ease: "power2.out"
                  }
                );
              }
            }
          });
        }, [], 1.0);

        // Esperar a que el frame con la pose inicial se pinte detrás del video,
        // quitar la intro y recién ahí arrancar el viaje hacia el círculo
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (onIntroHandoff) onIntroHandoff();
          // El video se funde (INTRO_FADE_MS en App) sobre la imagen 3D quieta;
          // el viaje arranca recién cuando el fundido terminó
          setTimeout(() => timeline.play(), 420);
        }));
      }
    }
  }, [initialTransition, initialImageIndex, refs, originalPositions, onTransitionComplete, isMobile, introRect, onIntroHandoff]);

  // Quality change handler removed - always high quality

  const handleClick = useCallback((index) => {
    if (isInitializing || animationInProgressRef.current) return;

    if (!(selectedImage.includes(index))) {
      setSelectedImage((prev) => {
        const updatedList = [...prev, index];
        const closestImageIndex = findClosestImage(updatedList);
        if (closestImageIndex !== null) {
          animateImageToFront(closestImageIndex);
        } else {
          animateImageToFront(index);
        }
        return updatedList;
      });

      const galleryImageUrl = imageUrls[index];
      const galleryColors = getGalleryColors(galleryImageUrl);

      if (setActiveGalleryColor) {
        setActiveGalleryColor(galleryColors);
      }

      if (galleryColors && galleryColors.main) {
        const newColor = new THREE.Color("white");
        backgroundRef.current = newColor;
      }
    } else if (!isMobile) {
      resetImagePositions();
    }
  }, [selectedImage, isInitializing, imageUrls, isMobile]);

  const animateImageToFront = useCallback((index) => {
    // Keep original animation logic unchanged
    if (animationInProgressRef.current) return;
    animationInProgressRef.current = true;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    setIsImageUpFront(true);

    timelineRef.current = gsap.timeline({
      onComplete: () => {
        animationInProgressRef.current = false;
      }
    });

    const selectedRef = refs[index]?.current;
    const camera = cameraRef.current;

    if (!selectedRef || !camera) {
      animationInProgressRef.current = false;
      return;
    }

    setIndex(index);

    const originalPosition = selectedRef.position.clone();

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Distancia fija: la imagen seleccionada siempre ocupa el mismo tamaño en pantalla
    const plane = selectedRef.children[0];
    const params = plane?.geometry?.parameters || {};
    const planeScale = 1.05; // escala aplicada al seleccionar (ImageMesh)
    const planeH = (params.height || (isMobile ? 3.2 : 5)) * planeScale;
    const planeW = (params.width || planeH) * planeScale;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Deja aire abajo para el nombre + año y la nav
    // En mobile casi a sangre (margen mínimo a los lados, como i-d)
    // fracción máx. del alto de pantalla. Mobile: la foto (centrada) deja abajo
    // nav (108px) + nombre (18px) + 16px de aire a cada lado del nombre
    const SELECTED_LIFT = 0; // fracción del alto de pantalla
    const fitH = isMobile ? 0.76 : 0.66;
    const fitW = isMobile ? 0.86 : 0.55;  // fracción máx. del ancho de pantalla
    const fixedDistance = Math.max(
      planeH / (fitH * 2 * tanHalf),
      planeW / (fitW * 2 * tanHalf * camera.aspect)
    );
    if (setSelectedProjectInfo) {
      const info = projectInfo[imageUrls[index]];
      // Alto de la foto como fracción de la pantalla (centrada): App la usa para
      // dejar el nombre a la misma distancia de la foto que de la nav
      const photoFrac = planeH / (2 * tanHalf * fixedDistance);
      setSelectedProjectInfo(info && { ...info, photoFrac, liftFrac: SELECTED_LIFT });
    }

    // La imagen va al origen; la cámara queda a distancia fija en su dirección actual
    const targetPosition = direction.clone().multiplyScalar(-fixedDistance);

    // Keep original smooth animation
    // Sube apenas la foto para dar más aire abajo (nombre + nav)
    const liftY = SELECTED_LIFT * 2 * tanHalf * fixedDistance;
    timelineRef.current.to(selectedRef.position, {
      x: 0,
      y: liftY,
      z: 0,
      duration: 1.2,
      ease: "power3.inOut",
      force3D: true,
      onUpdate: () => {
        if (selectedRef) {
          faceCamera(selectedRef, camera);
        }
      }
    }, 0);

    tweenCameraOrbit(timelineRef.current, camera, targetPosition, {
      duration: 1.4,
      ease: "power3.inOut"
    }, 0);

    // Keep original dispersion animation
    refs.forEach((ref, i) => {
      if (i === index) return;

      const mesh = ref.current;
      if (!mesh) return;

      const direction = new THREE.Vector3(
        mesh.position.x - originalPosition.x,
        mesh.position.y - originalPosition.y,
        mesh.position.z - originalPosition.z
      ).normalize();

      const distance = 500 + Math.random() * 200;

      timelineRef.current.to(mesh.position, {
        x: originalPositions[i][0] + direction.x * distance,
        y: originalPositions[i][1] + direction.y * distance,
        z: originalPositions[i][2] + direction.z * distance,
        duration: 1.0 + Math.random() * 0.3,
        ease: "power3.out",
        delay: Math.random() * 0.1,
        onComplete: () => {
          mesh.visible = false;
        }
      }, 0);
    });

    timelineRef.current.play();
  }, [refs, imageUrls, projectInfo, originalPositions]);

  const findClosestImage = useCallback((updatedList) => {
    if (updatedList.length === 0) {
      return null;
    }
    const cameraPosition = cameraRef.current.position.clone();
    let closestIndex = updatedList[0];
    let closestDistance = Infinity;
    updatedList.forEach((index) => {
      const ref = refs[index];
      if (ref && ref.current) {
        const distance = ref.current.position.distanceTo(cameraPosition);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }
    });
    return closestIndex;
  }, [refs]);

  // OPTIMIZED FRAME UPDATE FOR MOBILE
  useFrame(({ camera, scene }) => {
    frameCount.current++;

    // Skip frames on mobile for better performance
    if (isMobile && frameCount.current % skipFrames !== 0) {
      return;
    }

    cameraRef.current = camera;

    // Only update look-at every few frames on mobile
    if (!animationInProgressRef.current && (!isMobile || frameCount.current % 4 === 0)) {
      refs.forEach(ref => {
        if (ref.current) {
          faceCamera(ref.current, camera);
        }
      });
    }

    if (isImageUpFront && scene.background) {
      scene.background.lerp(backgroundRef.current, isMobile ? 0.1 : 0.05);
    } else if (scene.background) {
      // con una imagen en hover el entorno también se apaga un poco
      const dimmed = hoveredIndex !== null && selectedImage.length === 0;
      scene.background.lerp(dimmed ? HOVER_BG : WHITE_BG, isMobile ? 0.1 : 0.08);
    }

    // Misma velocidad que en desktop: en mobile se compensa el salto de frames
    if (groupRef.current &&
      !isImageUpFront &&
      !isInitializing &&
      !animationInProgressRef.current &&
      !isUserInactive &&
      !isManuallyPaused) {
      groupRef.current.rotation.y += 0.0003 * (isMobile ? skipFrames : 1);
    }

    // Arrastre: la rotación persigue al objetivo con easing muy suave,
    // y al soltar sigue un poco por inercia hasta frenar
    const drag = dragRef.current;
    if (groupRef.current && !isImageUpFront && !animationInProgressRef.current) {
      if (!drag.active) {
        drag.target += drag.velocity;
        drag.velocity *= 0.94;
      }
      const step = (drag.target - drag.applied) * (isMobile ? 0.12 : 0.06);
      drag.applied += step;
      groupRef.current.rotation.y += step;
    }
  });

  const resetImagePositions = useCallback(() => {
    if (animationInProgressRef.current) return;
    animationInProgressRef.current = true;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const camera = cameraRef.current;

    if (setSelectedProjectInfo) {
      setSelectedProjectInfo(null);
    }

    if (setActiveGalleryColor) {
      setActiveGalleryColor({
        main: '#ffffff',
        text: '#000000',
        highlight: '#666666'
      });
    }

    backgroundRef.current = new THREE.Color('#ffffff');

    // OPTIMIZED RESET FOR MOBILE
    const duration = isMobile ? 0.8 : 1.2;

    timelineRef.current = gsap.timeline({
      onComplete: () => {
        refs.forEach((ref, index) => {
          if (ref.current) {
            const targetPos = originalPositions[index];
            gsap.set(ref.current.position, {
              x: targetPos[0],
              y: targetPos[1],
              z: targetPos[2],
              force3D: !isMobile,
              overwrite: true
            });
          }
        });

        setIsImageUpFront(false);
        setSelectedImage([]);
        animationInProgressRef.current = false;
      }
    });

    tweenCameraOrbit(timelineRef.current, camera, { x: 0, y: 0, z: CAMERA_DIST }, {
      duration: duration,
      ease: isMobile ? "power2.inOut" : "power3.inOut"
    }, 0);

    const selectedIdx = selectedImage[selectedImage.length - 1];

    refs.forEach((ref, index) => {
      if (ref.current) {
        ref.current.visible = true;

        // La imagen que estaba al frente vuelve en sincronía exacta con la cámara
        // (misma duración, curva y sin retraso): ida y vuelta simétricas
        if (index === selectedIdx) {
          const targetPos = originalPositions[index];
          timelineRef.current.to(ref.current.position, {
            x: targetPos[0],
            y: targetPos[1],
            z: targetPos[2],
            duration: duration,
            ease: isMobile ? "power2.inOut" : "power3.inOut",
            onUpdate: () => {
              if (ref.current) faceCamera(ref.current, camera);
            }
          }, 0);
          return;
        }

        const currentPos = ref.current.position;
        const targetPos = originalPositions[index];
        const distance = Math.sqrt(
          Math.pow(currentPos.x - targetPos[0], 2) +
          Math.pow(currentPos.y - targetPos[1], 2) +
          Math.pow(currentPos.z - targetPos[2], 2)
        );

        const animDuration = isMobile ?
          Math.min(0.8, 0.4 + (distance / 800)) :
          Math.min(1.2, 0.6 + (distance / 500));

        const delay = isMobile ? 0 : (0.1 + Math.random() * 0.1);

        timelineRef.current.to(ref.current.position, {
          x: targetPos[0],
          y: targetPos[1],
          z: targetPos[2],
          duration: animDuration,
          ease: isMobile ? "power2.inOut" : "power3.inOut",
          force3D: !isMobile,
          onUpdate: isMobile ? null : () => {
            if (ref.current) {
              faceCamera(ref.current, camera);
            }
          }
        }, delay);
      }
    });

    timelineRef.current.play();
  }, [refs, originalPositions, isMobile, selectedImage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isInitializing || animationInProgressRef.current) return;
      if (!isImageUpFront) return;

      // Handle both mouse and touch events
      const clientX = event.clientX || (event.touches && event.touches[0]?.clientX);
      const clientY = event.clientY || (event.touches && event.touches[0]?.clientY);

      if (clientX === undefined || clientY === undefined) return;

      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      // Ensure camera is available
      if (!cameraRef.current) return;

      raycaster.setFromCamera(mouse, cameraRef.current);

      // Only check the selected image (which should be at position 0,0,0)
      const selectedImageIndex = selectedImage[selectedImage.length - 1];
      if (selectedImageIndex === undefined) return;

      const selectedRef = refs[selectedImageIndex]?.current;
      if (!selectedRef || !selectedRef.visible) return;

      const intersects = raycaster.intersectObject(selectedRef, true); // recursivo: el plano es hijo del group

      // If no intersection with the selected image, reset positions
      if (intersects.length === 0) {
        resetImagePositions();
      }
    };

    // Add both mouse and touch event listeners
    if (isMobile) return undefined;
    const eventType = 'mousedown';
    document.addEventListener(eventType, handleClickOutside);

    return () => {
      document.removeEventListener(eventType, handleClickOutside);
    };
  }, [refs, isInitializing, isImageUpFront, resetImagePositions, selectedImage, isMobile]);

  // On touch, test the selected plane directly: other meshes must not steal the tap.
  useEffect(() => {
    if (!isMobile || !isImageUpFront) return;
    let start = null;
    const onStart = (event) => {
      const touch = event.touches[0];
      if (touch) start = { x: touch.clientX, y: touch.clientY };
    };
    const onEnd = (event) => {
      const touch = event.changedTouches[0];
      if (!start || !touch || animationInProgressRef.current || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return;
      const index = selectedImage[selectedImage.length - 1];
      const mesh = refs[index]?.current?.children[0];
      const camera = cameraRef.current;
      if (!mesh || !camera) return;
      mouse.set((touch.clientX / window.innerWidth) * 2 - 1, -(touch.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.intersectObject(mesh).length) {
        setCollection(imageUrls[index]);
        setShowCollection(true);
      } else {
        resetImagePositions();
      }
      start = null;
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [isMobile, isImageUpFront, selectedImage, refs, imageUrls, setCollection, setShowCollection, resetImagePositions]);

  // Arrastrar con mouse / dedo para girar el carrusel, independiente del click
  useEffect(() => {
    const drag = dragRef.current;
    const SENS = 0.0018; // rad por px: lento a propósito

    const onDown = (e) => {
      drag.moved = false; // cada press arranca limpio: si no, un drag viejo bloquea el próximo click
      if (e.target.tagName !== 'CANVAS' || isImageUpFront) return;
      drag.active = true;
      drag.moved = false;
      drag.startX = drag.lastX = e.clientX;
      drag.velocity = 0;
    };
    const onMove = (e) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      if (Math.abs(e.clientX - drag.startX) > 6) drag.moved = true;
      drag.target += dx * SENS;
      drag.velocity = drag.velocity * 0.6 + dx * SENS * 0.4;
    };
    const onUp = () => {
      if (!drag.active) return;
      drag.active = false;
      drag.velocity = Math.max(-0.01, Math.min(0.01, drag.velocity * 0.5));
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isImageUpFront]);

  // Keyboard controls (desktop only)
  useEffect(() => {
    if (isMobile) return; // Skip keyboard controls on mobile

    const handleKeyPress = (event) => {
      if (event.shiftKey && event.key === 'P') {
        event.preventDefault();
        setIsManuallyPaused(prev => {
          const newState = !prev;
          console.log(newState ? "⏸️ PAUSA MANUAL ACTIVADA" : "▶️ PAUSA MANUAL DESACTIVADA");

          if (newState) {
            console.log("=== POSICIONES ACTUALES DE LAS IMÁGENES ===");
            refs.forEach((ref, index) => {
              if (ref.current) {
                const pos = ref.current.position;
                console.log(`Imagen ${index}: [${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}]`);
              }
            });
            console.log("==========================================");
            console.log("Presiona Shift+P nuevamente para reanudar el movimiento");
          }

          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [refs, isMobile]);

  return (
    <group ref={groupRef}>
      {/* Quality switch removed - always high quality */}

      {/* Debug pause indicator - only on desktop */}
      {!isMobile && isManuallyPaused && (
        <group position={[-15, 15, 10]}>
          <mesh>
            <boxGeometry args={[8, 3, 0.1]} />
            <meshBasicMaterial color="#ff0000" opacity={0.9} transparent />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <planeGeometry args={[7, 2]} />
            <meshBasicMaterial color="#ffffff" opacity={1} transparent />
          </mesh>
        </group>
      )}

      {imageUrls.map((texture, index) => (
        <ImageMesh
          key={index}
          position={originalPositions[index]}
          textureUrl={texture}
          refProp={refs[index]}
          onClick={() => { if (!dragRef.current.moved) handleClick(index); }}
          isHighQuality={isHighQuality}
          isSelected={selectedImage.includes(index)}
          hoverDisabled={isInitializing}
          isDimmed={hoveredIndex !== null && hoveredIndex !== index && selectedImage.length === 0}
          onHoverChange={(on) => handleHoverChange(index, on)}
          isMobile={isMobile}
          onGalleryToggle={() => {
            setShowCollection(true);
            setCollection(imageUrls[index]);
          }}
        />
      ))}
    </group>
  );
};

export default AnimatedCarousel;