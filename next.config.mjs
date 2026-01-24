/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Critical Fix: Exclude PDF libraries from Next.js bundling
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse-fork', 'pdfjs-dist'],
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  webpack: (config) => {
    // 2. Critical Fix: Prevent PDF.js from trying to load 'canvas'
    config.resolve.alias.canvas = false;
    
    // 3. Handle other binary module externals
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    
    return config;
  },
};

export default nextConfig;