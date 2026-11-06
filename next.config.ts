import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // PptxGenJS supplies browser fallbacks for fs/https; normalize Node URI
      // imports so Webpack can apply those package-scoped fallbacks.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:(fs|https)$/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      }));
    }
    return config;
  },
};

export default nextConfig;
