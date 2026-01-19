// src/components/ui/AudioVisualizer.tsx
'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
  className?: string;
  barColor?: string;
}

export function AudioVisualizer({ stream, isRecording, className, barColor }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();
  const contextRef = useRef<AudioContext>();

  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;

    // Initialize Audio Context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    contextRef.current = audioContext;
    
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 64; // Small size for smoother, thicker bars
    source.connect(analyser);
    
    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!isRecording) return;
      
      animationRef.current = requestAnimationFrame(draw);
      
      // FIX: Cast to any to resolve "Uint8Array<ArrayBufferLike>" mismatch error
      if (dataArrayRef.current && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 4; // Number of visual bars
      const gap = 4; 
      const totalGap = gap * (bars - 1);
      const barWidth = (canvas.width - totalGap) / bars;
      const step = Math.floor(dataArrayRef.current!.length / bars);

      // Gradient or Solid Color
      if (barColor) {
        ctx.fillStyle = barColor;
      } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#a855f7'); // Purple
        gradient.addColorStop(1, '#3b82f6'); // Blue
        ctx.fillStyle = gradient;
      }

      for (let i = 0; i < bars; i++) {
        // Average the frequency data for this bar's range for smoothness
        let sum = 0;
        for (let j = 0; j < step; j++) {
            sum += dataArrayRef.current![i * step + j];
        }
        const avg = sum / step;
        
        // Scale height
        const percent = avg / 255;
        const height = Math.max(4, canvas.height * percent * 1.8); 
        const x = i * (barWidth + gap);
        const y = (canvas.height - height) / 2; // Center vertically

        // Draw Rounded Pill
        ctx.beginPath();
        // Check for roundRect support (it's relatively new)
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, height, 4);
        } else {
            ctx.rect(x, y, barWidth, height); // Fallback
        }
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (contextRef.current?.state !== 'closed') contextRef.current?.close();
    };
  }, [stream, isRecording, barColor]);

  // Static state when not recording
  if (!isRecording) {
    return (
      <div className={cn("flex items-center gap-1 h-full opacity-30", className)}>
         <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
         <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
         <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      width={50} 
      height={30} 
      className={cn("opacity-90 transition-opacity", className)} 
    />
  );
}