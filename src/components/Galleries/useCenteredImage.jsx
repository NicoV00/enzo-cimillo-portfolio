import { useState, useCallback } from 'react';

const useCenteredImage = () => {
  const [centeredImage, setCenteredImage] = useState(null);
  const [isImageCentered, setIsImageCentered] = useState(false);

  // Handle image click to center it
  const handleImageClick = useCallback((imageIndex) => {
    setCenteredImage(imageIndex);
    setIsImageCentered(true);
  }, []);

  // Handle clicking on centered image to enter gallery
  const handleCenteredImageClick = useCallback(() => {
    // This is where navigation to portfolio gallery would happen
    console.log('Entering gallery for image:', centeredImage);
    // For now, we'll just close the centered view
    // In production, you would navigate to the specific gallery
  }, [centeredImage]);

  // Handle clicking outside to return to map
  const handleOverlayClick = useCallback((e) => {
    // Only close if clicking the background, not the image
    if (e.target === e.currentTarget) {
      setCenteredImage(null);
      setIsImageCentered(false);
    }
  }, []);

  return {
    centeredImage,
    isImageCentered,
    handleImageClick,
    handleCenteredImageClick,
    handleOverlayClick
  };
};

export default useCenteredImage;