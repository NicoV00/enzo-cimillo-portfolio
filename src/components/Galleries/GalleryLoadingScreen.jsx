import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './GalleryLoadingScreen.css';

export default function GalleryLoadingScreen({ loading, loadProgress = 0, onAnimationComplete, backgroundColor = '#e6e6e6', textColor = '#000', progressColor = textColor }) {
  const screenRef = useRef(null);
  const completeRef = useRef(onAnimationComplete);
  completeRef.current = onAnimationComplete;
  const progress = Math.min(100, Math.max(0, loadProgress));

  useEffect(() => {
    if (!loading || progress < 100) return;
    const tween = gsap.to(screenRef.current, {
      opacity: 0,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.24,
      delay: 0.15,
      onComplete: () => completeRef.current?.(),
    });
    return () => tween.kill();
  }, [loading, progress]);

  if (!loading) return null;
  return (
    <div ref={screenRef} className="gallery-loading" style={{ backgroundColor, color: textColor }} role="status" aria-label="Loading images">
      <div className="gallery-loading__pill">
        <svg className="gallery-loading__mark" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" /><circle cx="12" cy="12" r="3" /></svg>
        <div className="gallery-loading__track" role="progressbar" aria-label="Loading images" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <span style={{ transform: `scaleX(${progress / 100})`, backgroundColor: progressColor }} />
        </div>
        <span className="gallery-loading__count" aria-hidden="true">{String(Math.round(progress)).padStart(2, '0')}</span>
      </div>
    </div>
  );
}
