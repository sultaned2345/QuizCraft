'use client';
import { useEffect, useRef } from 'react';

export function SpotlightCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Optimization: Don't run this logic on touch devices (phones/tablets)
    // because they don't have a "hover" state usually.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const moveCursor = (e: MouseEvent) => {
      if (cursorRef.current) {
        // Direct DOM manipulation avoids React re-renders entirely
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    window.addEventListener('mousemove', moveCursor, { passive: true });
    return () => window.removeEventListener('mousemove', moveCursor);
  }, []);

  return (
    <div 
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2 hidden md:block"
      style={{ willChange: 'transform' }} // Hint to browser to optimize
    >
      {/* The Glow Effect */}
      <div className="w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px]" />
    </div>
  );
}