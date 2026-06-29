/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
