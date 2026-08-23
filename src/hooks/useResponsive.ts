import { useState, useEffect } from 'react';

export function useResponsive() {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileDevice = typeof navigator !== 'undefined' && (
    /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) || 
    !!(typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.())
  );

  const isMobile = isMobileDevice || width < 768;
  const isTablet = !isMobileDevice && width >= 768 && width <= 1024;
  const isDesktop = !isMobileDevice && width > 1024;

  return { isMobile, isTablet, isDesktop, width };
}

export const useResponsiveLayout = useResponsive;
