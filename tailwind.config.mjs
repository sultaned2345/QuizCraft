// tailwind.config.mjs
import typography from 'tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Your theme extensions from globals.css's @theme block go here.
      // We'll leave it simple for now to get the build passing.
      // You can migrate the variables from globals.css here later if you want.
    },
  },
  plugins: [
    typography(), // <-- This is the crucial line
  ],
}

export default config