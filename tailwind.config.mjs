@import "tailwindcss";
/* 👇 This line links your JS config so colors/plugins are loaded */
@config "../../tailwind.config.mjs";

@layer base {
  :root {
    /* --- LIGHT MODE (High-Tech Clinical) --- */
    --background: 99% 0 0;
    --foreground: 20% 0.02 265; 
    
    --card: 100% 0 0;
    --card-foreground: 20% 0.02 265;
    
    --popover: 100% 0 0;
    --popover-foreground: 20% 0.02 265;
    
    --primary: 55% 0.25 280; 
    --primary-foreground: 99% 0 0;
    
    --secondary: 95% 0.02 265;
    --secondary-foreground: 20% 0.02 265;
    
    --muted: 95% 0.02 265;
    --muted-foreground: 50% 0.05 265;
    
    --accent: 95% 0.05 265;
    --accent-foreground: 20% 0.02 265;
    
    --destructive: 60% 0.2 20;
    --destructive-foreground: 99% 0 0;

    --border: 90% 0.02 265;
    --input: 90% 0.02 265;
    --ring: 55% 0.25 280;
    
    --radius: 0.5rem;
  }

  .dark {
    /* --- DARK MODE (Deep Space HUD) --- */
    --background: 10% 0.02 270; 
    --foreground: 98% 0.01 280;

    --card: 14% 0.03 270; 
    --card-foreground: 98% 0.01 280;

    --popover: 12% 0.03 270;
    --popover-foreground: 98% 0.01 280;

    --primary: 65% 0.22 280; 
    --primary-foreground: 99% 0 0;

    --secondary: 20% 0.04 270;
    --secondary-foreground: 98% 0.01 280;

    --muted: 18% 0.03 270;
    --muted-foreground: 70% 0.05 270;

    --accent: 25% 0.05 270;
    --accent-foreground: 99% 0 0;

    --destructive: 60% 0.2 20;
    --destructive-foreground: 99% 0 0;

    --border: 30% 0.05 270;
    --input: 25% 0.05 270;
    --ring: 65% 0.22 280;
  }
}

@layer base {
  * {
    border-color: oklch(var(--border));
    outline-color: oklch(var(--ring) / 0.5);
  }
  body {
    @apply bg-[oklch(var(--background))] text-[oklch(var(--foreground))];
  }
}

/* --- UTILITIES --- */
@layer utilities {
  .glass {
    @apply bg-[oklch(var(--card))]/60 shadow-xl;
    /* Manual replacement for border-white/10 to avoid v4 parsing error */
    border: 1px solid rgb(255 255 255 / 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  
  .glow {
    box-shadow: 0 0 20px -5px oklch(var(--primary));
  }
  
  .glow-text {
    text-shadow: 0 0 10px oklch(var(--primary));
  }
}