import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 95],
  },
  async redirects() {
    return [{ source: '/', destination: '/member', permanent: false }];
  },
};

export default nextConfig;
