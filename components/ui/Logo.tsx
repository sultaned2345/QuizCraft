import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'icon' | 'full'; // 'icon' = symbol only, 'full' = symbol + text
  size?: 'sm' | 'md' | 'lg' | 'xl';
  appName?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  className, 
  variant = 'full', 
  size = 'md',
  appName = "QuizCraft" 
}) => {
  // Container text sizing
  const sizeClasses = {
    sm: 'gap-1.5 text-lg',
    md: 'gap-2 text-xl',
    lg: 'gap-3 text-2xl',
    xl: 'gap-4 text-4xl'
  };

  // SVG dimensions
  const iconPixelSizes = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  };

  return (
    <div className={cn("flex items-center font-bold select-none leading-none", sizeClasses[size], className)}>
      <svg
        width={iconPixelSizes[size]}
        height={iconPixelSizes[size]}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm"
      >
        <defs>
            <linearGradient id="friendlyFoxGradient" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FB923C" /> <stop offset="100%" stopColor="#EA580C" /> </linearGradient>
        </defs>

        {/* Main Head Shape (Rounded) */}
        <path 
            d="M16 29C12 29 6 24 6 18C6 14 8 6 8 6C8 6 12 8 16 9C20 8 24 6 24 6C24 6 26 14 26 18C26 24 20 29 16 29Z"
            fill="url(#friendlyFoxGradient)"
        />

        {/* Inner Ear Fluff (Softened) */}
        <path d="M9 8C9 8 11 13 13 14L16 11L9 8Z" fill="#9A3412" opacity="0.2"/>
        <path d="M23 8C23 8 21 13 19 14L16 11L23 8Z" fill="#9A3412" opacity="0.2"/>

        {/* White Muzzle / Face Mask (Rounded cheeks) */}
        <path 
            d="M16 29C13 29 9 25 9 20C9 17 11.5 15 16 15C20.5 15 23 17 23 20C23 25 19 29 16 29Z"
            fill="#FFF7ED"
        />

        {/* Nose (Soft oval triangle) */}
        <path 
            d="M16 26.5C14.5 26.5 14 25 14 25H18C18 25 17.5 26.5 16 26.5Z" 
            fill="#431407"
        />
        
        {/* The Smile */}
        <path d="M14 27.5Q16 29 18 27.5" stroke="#431407" strokeWidth="1" strokeLinecap="round"/>

        {/* Big Friendly Eyes (Electric Blue) */}
        <circle cx="12.5" cy="19" r="2.5" fill="#0EA5E9" />
        <circle cx="19.5" cy="19" r="2.5" fill="#0EA5E9" />
        
        {/* Eye Sparkles (Larger) */}
        <circle cx="13.5" cy="18.2" r="1" fill="white" />
        <circle cx="20.5" cy="18.2" r="1" fill="white" />
      </svg>

      {variant === 'full' && (
        <span className="tracking-tight text-foreground flex items-center">
          {appName}
        </span>
      )}
    </div>
  );
};

export default Logo;