import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class"],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  prefix: "",
  plugins: [
    typography, // This correctly loads the typography plugin
  ],
};

export default config;