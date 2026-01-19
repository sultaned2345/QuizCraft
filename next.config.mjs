/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Critical Fix for PDF Parsing 500 Error
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse-fork', 'pdfjs-dist'],
  },
  
  // 2. Existing config (keep yours if different)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // 3. Webpack config (optional, but helps with some binary modules)
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    return config;
  },
};

export default nextConfig;