import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import PortfolioButton from './PortfolioButton';
import { getGalleryColors } from '../utils/galleryColors';
import { optimizedCover } from '../utils/coverImages';

const ImageMesh = React.memo(({
  position,
  textureUrl,
  refProp,
  onClick,
  isHighQuality,
  isSelected,
  // Durante la transición de la intro la imagen pasa bajo el cursor: sin hover
  hoverDisabled = false,
  onGalleryToggle,
  isDimmed = false,
  onHoverChange,
  isMobile = false // New prop for mobile optimization
}) => {
  const [texture, setTexture] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const meshRef = useRef();
  const materialRef = useRef();
  
  const galleryColors = getGalleryColors(textureUrl);
  
  useEffect(() => {
    let mounted = true;
    
    const loadTexture = async () => {
      const loader = new THREE.TextureLoader();
      
      // Mobile-optimized texture loading
      if (isMobile || !isHighQuality) {
        loader.load(optimizedCover(textureUrl), (tex) => {
          if (!mounted) return;
          
          // Mobile optimizations
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.anisotropy = 1;
          
          // Resize texture for mobile
          if (isMobile && tex.image) {
            const maxSize = 512; // Max texture size for mobile
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = tex.image.width;
            let height = tex.image.height;
            
            if (width > maxSize || height > maxSize) {
              const scale = Math.min(maxSize / width, maxSize / height);
              width = Math.floor(width * scale);
              height = Math.floor(height * scale);
              
              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(tex.image, 0, 0, width, height);
              
              // Create new texture from resized canvas
              const resizedTexture = new THREE.CanvasTexture(canvas);
              resizedTexture.colorSpace = THREE.SRGBColorSpace;
              resizedTexture.minFilter = THREE.LinearFilter;
              resizedTexture.magFilter = THREE.LinearFilter;
              resizedTexture.generateMipmaps = false;
              resizedTexture.needsUpdate = true;
              
              setTexture(resizedTexture);
              return;
            }
          }
          
          setTexture(tex);
        });
      } else {
        // Desktop high quality loading
        try {
          const loadedTexture = await new Promise((resolve) => {
            loader.load(optimizedCover(textureUrl), (tex) => {
              if (mounted) {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.minFilter = THREE.LinearMipmapLinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.generateMipmaps = true;
                tex.anisotropy = 16;
                resolve(tex);
              }
            });
          });
          setTexture(loadedTexture);
        } catch (error) {
          console.error('Error loading high quality texture:', error);
        }
      }
    };
    
    loadTexture();
    
    return () => {
      mounted = false;
      if (texture) {
        texture.dispose();
      }
    };
  }, [textureUrl, isHighQuality, isMobile]);
  
  useEffect(() => {
    if (texture?.image) {
      setAspectRatio(texture.image.width / texture.image.height);
    }
  }, [texture]);
  
  useEffect(() => {
    if (isSelected && meshRef.current) {
      gsap.killTweensOf(meshRef.current.scale); // que un hover a medias no pise la escala de selección
      meshRef.current.scale.set(1.05, 1.05, 1.05);
    } else if (!isHovered && meshRef.current) {
      meshRef.current.scale.set(1, 1, 1);
    }
  }, [isSelected]);
  
  // Apagado suave cuando otra imagen está en hover
  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    const v = isDimmed ? 0.48 : 1;
    // apagar rápido, volver a prender más lento (así no parpadea al cruzar entre imágenes)
    gsap.to(mat.color, { r: v, g: v, b: v, duration: isDimmed ? 0.35 : 0.6, ease: 'power2.out', overwrite: true });
  }, [isDimmed, texture]);

  const handlePointerOver = () => {
    // Disable hover effects on mobile to improve performance
    if (isMobile || hoverDisabled) return;
    
    setIsHovered(true);
    onHoverChange?.(true);
    
    if (!isSelected && meshRef.current) {
      gsap.to(meshRef.current.scale, {
        x: 1.07,
        y: 1.07,
        z: 1.07,
        duration: 0.7,
        ease: "power3.out",
        overwrite: true
      });
    }
  };
  
  const handlePointerOut = () => {
    if (isMobile || hoverDisabled) return;
    
    setIsHovered(false);
    onHoverChange?.(false);
    
    if (!isSelected && meshRef.current) {
      gsap.to(meshRef.current.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.6,
        ease: "power3.out",
        overwrite: true
      });
    }
  };
  
  if (!texture) return null;
  
  // Use simpler geometry for mobile
  const geometryArgs = isMobile ?
    [3.2 * aspectRatio, 3.2] : // Much smaller planes for mobile to fit screen better
    [5 * aspectRatio, 5];  // Original size for desktop
  
  return (
    <group ref={refProp} position={position}>
      <mesh 
        ref={meshRef}
        onClick={onClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={geometryArgs} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          transparent
          // Sin tone mapping: la foto se ve igual que en el video / en la web
          toneMapped={false}
          side={THREE.FrontSide}
          // Reduce overdraw on mobile
          depthWrite={!isMobile || isSelected}
          depthTest={true}
        />
      </mesh>
      {isSelected && !isMobile && (
        <PortfolioButton 
          onClick={onGalleryToggle} 
          imageMeshRef={meshRef} 
          galleryColors={galleryColors}
        />
      )}
    </group>
  );
});

export default ImageMesh;