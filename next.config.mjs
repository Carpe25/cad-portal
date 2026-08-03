/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@cometchat/chat-uikit-react",
    "@cometchat/chat-sdk-javascript",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
}

export default nextConfig
