import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 95],
  },
  webpack(config) {
    // Low-space validation hosts can compile without persisting webpack cache.
    if (process.env.WWW_DISABLE_WEBPACK_CACHE === '1') config.cache = false;
    return config;
  },
  async redirects() {
    return [{ source: '/', destination: '/member', permanent: false }];
  },
};

export default nextConfig;
