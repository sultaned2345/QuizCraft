'use client';

import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { cn } from '@/lib/utils';

interface MermaidProps {
  chart: string;
  className?: string;
}

export function Mermaid({ chart, className }: MermaidProps) {
  // Use state for ID to ensure it persists across re-renders but is unique per component instance
  const [id] = useState(() => `mermaid-${Math.random().toString(36).slice(2, 9)}`);
  const [svg, setSvg] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // FIX 1: Initialize ONLY on the client side to avoid SSR "window not defined" errors
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral', // 'neutral' often blends better with light/dark modes
      securityLevel: 'loose',
      fontFamily: 'inherit',
      logLevel: 5, // Suppress verbose logging
    });
  }, []);

  useEffect(() => {
    if (!chart) return;
    
    let mounted = true;
    setIsError(false);

    const renderChart = async () => {
      try {
        // mermaid.render returns an object { svg } in v10+
        const { svg: generatedSvg } = await mermaid.render(id, chart);
        
        // FIX 4: Prevent state update if component unmounted or chart changed
        if (mounted) {
          setSvg(generatedSvg);
          setIsError(false);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (mounted) setIsError(true);
        
        // FIX 3: Cleanup mermaid's error element if it was appended to body
        // Mermaid sometimes appends an element with id `d` + `id` when it fails
        const errorElement = document.getElementById(`d${id}`);
        if (errorElement) {
          errorElement.remove();
        }
      }
    };

    renderChart();

    return () => {
      mounted = false;
    };
  }, [chart, id]);

  if (isError) {
    return (
      <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-500 text-sm border border-red-100 dark:border-red-900/50">
        <p className="font-semibold mb-1">Diagram Syntax Error</p>
        <pre className="text-xs opacity-75 overflow-auto">{chart.substring(0, 100)}...</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("flex justify-center my-6 overflow-x-auto bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}