// postcss.config.mjs
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Replaced 'tailwindcss' (v3) with v4 plugin
    '@tailwindcss/postcss': {},
    // Autoprefixer is no longer needed with Tailwind v4 (Lightning CSS handles it)
  },
};

export default config;