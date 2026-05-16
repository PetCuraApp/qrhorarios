import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Permite importar xlsx en el servidor
  serverExternalPackages: ['xlsx'],
};

export default nextConfig;
