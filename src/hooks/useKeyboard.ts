import { useState, useEffect } from 'react';

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const visualViewport = window.visualViewport;
    let initialHeight = visualViewport.height;
    let lastWidth = visualViewport.width;
    let resizeTimeout: NodeJS.Timeout | null = null;

    const handleResize = () => {
      // Debounce rapid resize events
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        const currentHeight = visualViewport.height;
        const currentWidth = visualViewport.width;

        // If the viewport width changes, it is an orientation change (e.g. rotating portrait to landscape)
        // or a window split resizing. We reset the baseline height to prevent false-positives.
        if (currentWidth !== lastWidth) {
          initialHeight = currentHeight;
          lastWidth = currentWidth;
          setIsKeyboardOpen(false);
          setKeyboardHeight(0);
          return;
        }

        const heightDifference = initialHeight - currentHeight;
        
        // Consider keyboard open if height difference is significant (> 150px)
        // This accounts for browser chrome, address bar, etc.
        const isOpen = heightDifference > 150;
        
        setIsKeyboardOpen(isOpen);
        setKeyboardHeight(isOpen ? heightDifference : 0);
      }, 100);
    };

    // Set initial height after a small delay to ensure stable layout
    const timer = setTimeout(() => {
      initialHeight = visualViewport.height;
      lastWidth = visualViewport.width;
      handleResize();
    }, 100);

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}
