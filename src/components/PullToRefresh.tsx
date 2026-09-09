import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { createLogger } from '../utils/logger';

const log = createLogger('');

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

  // Use refs for values needed in event handlers to avoid unnecessary effect re-runs
  const isPullingRef = useRef(isPulling);
  const isRefreshingRef = useRef(isRefreshing);
  const pullDistanceRef = useRef(pullDistance);

  useEffect(() => { isPullingRef.current = isPulling; }, [isPulling]);
  useEffect(() => { isRefreshingRef.current = isRefreshing; }, [isRefreshing]);
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);

  const threshold = 75;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshingRef.current) return;

    const target = e.target as HTMLElement;
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
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || isRefreshingRef.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const resistanceDistance = Math.min(130, diff * 0.45);
      setPullDistance(resistanceDistance);
    } else {
      setPullDistance(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current || isRefreshingRef.current) return;

    setIsPulling(false);
    const currentDistance = pullDistanceRef.current;
    
    if (currentDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      log.debug('Pull threshold reached, triggering refresh', { threshold });
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      setPullDistance(0);
    }
  }, [threshold]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

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
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-velum-850/90 backdrop-blur-[var(--blur-backdrop-md)] border border-white-10 shadow-xl">
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
                ? '' 
                : pullDistance >= threshold 
                  ? '' 
                  : ''}
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
