/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["sharp"],
  transpilePackages: [
    "@cometchat/chat-uikit-react",
    "@cometchat/chat-sdk-javascript",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    proxyClientMaxBodySize: "100mb",
  },
}

export default nextConfig
