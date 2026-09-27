import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  ...(process.env.NODE_ENV === 'development' ? { rewrites: async () => [{ source: '/api/:path*', destination: 'http://127.0.0.1:3001/api/:path*' }] } : {}),
};
export default nextConfig;
