/** @type {import('tailwindcss').Config} */
const config = {
  // Enable class-based dark mode
  darkMode: ["class"],
  
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
      },
      colors: {
        // Using Relative Color Syntax to handle variables defined as full oklch() colors
        border: "oklch(from var(--border) l c h / <alpha-value>)",
        input: "oklch(from var(--input) l c h / <alpha-value>)",
        ring: "oklch(from var(--ring) l c h / <alpha-value>)",
        background: "oklch(from var(--background) l c h / <alpha-value>)",
        foreground: "oklch(from var(--foreground) l c h / <alpha-value>)",
        primary: {
          DEFAULT: "oklch(from var(--primary) l c h / <alpha-value>)",
          foreground: "oklch(from var(--primary-foreground) l c h / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(from var(--secondary) l c h / <alpha-value>)",
          foreground: "oklch(from var(--secondary-foreground) l c h / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(from var(--destructive) l c h / <alpha-value>)",
          foreground: "oklch(from var(--destructive-foreground) l c h / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(from var(--muted) l c h / <alpha-value>)",
          foreground: "oklch(from var(--muted-foreground) l c h / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(from var(--accent) l c h / <alpha-value>)",
          foreground: "oklch(from var(--accent-foreground) l c h / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(from var(--popover) l c h / <alpha-value>)",
          foreground: "oklch(from var(--popover-foreground) l c h / <alpha-value>)",
        },
        card: {
          DEFAULT: "oklch(from var(--card) l c h / <alpha-value>)",
          foreground: "oklch(from var(--card-foreground) l c h / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Friendly Fox Animations
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};

export default config;