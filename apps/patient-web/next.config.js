/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  turbopack: {},
  transpilePackages: ['@smileguard/shared-types', '@smileguard/shared-hooks', '@smileguard/supabase-client'],
};

module.exports = nextConfig;
