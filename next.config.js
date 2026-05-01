/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
    serverActions: {
      bodySizeLimit: '100mb'
    }
  }
}
module.exports = nextConfig