import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  disabled?: boolean;
}

export default function PullToRefresh({ children, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 75; // Distance in pixels to trigger reload

  const handleTouchStart = (e: TouchEvent) => {
    if (isRefreshing) return;

    // We only initiate pull-to-refresh if the target container or its scrollable parent is scrolled to the top
    const target = e.target as HTMLElement;
    
    // Find the closest scrollable container to check its scrollTop
    let parent: HTMLElement | null = target;
    let isAtTop = true;
    while (parent && parent !== containerRef.current) {
      if (parent.scrollTop > 0) {
        isAtTop = false;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (containerRef.current && containerRef.current.scrollTop > 0) {
      isAtTop = false;
    }

    if (!isAtTop) return;

    startYRef.current = e.touches[0].clientY;
    setIsPulling(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Prevent default scrolling behavior when actively pulling down at the top
      if (e.cancelable) {
        e.preventDefault();
      }
      
      // Apply exponential/logarithmic resistance so it gets harder to pull down
      const resistanceDistance = Math.min(130, diff * 0.45);
      setPullDistance(resistanceDistance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling || isRefreshing) return;

    setIsPulling(false);
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      // Trigger refresh with a subtle spin animation delay so the user feels the confirmation
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      setPullDistance(0);
    }
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled) return;

    // Attach non-passive event listeners so we can call preventDefault()
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, isRefreshing, disabled]);

  return (
    <div ref={containerRef} className="relative flex-grow flex-shrink flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden">
      {/* Visual pull-to-refresh indicator */}
      {!disabled && (
        <div 
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-150 ease-out pointer-events-none select-none"
          style={{
            transform: `translateY(${pullDistance - 50}px)`,
            opacity: Math.min(1, pullDistance / threshold),
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-velum-850/90 backdrop-blur-md border border-white-10 shadow-xl">
            <RefreshCw 
              className={`w-3.5 h-3.5 text-accent ${
                isRefreshing 
                  ? 'animate-spin' 
                  : `transition-transform duration-100`
              }`} 
              style={!isRefreshing ? { transform: `rotate(${pullDistance * 4.5}deg)` } : undefined}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-mono">
              {isRefreshing 
                ? 'Reloading...' 
                : pullDistance >= threshold 
                  ? 'Release to refresh' 
                  : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div 
        className="flex-grow flex-shrink flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden transition-transform duration-150 ease-out"
        style={!disabled ? {
          transform: `translateY(${pullDistance * 0.4}px)`
        } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
