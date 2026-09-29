import type { NextConfig } from "next";

// Published as a static site on GitHub Pages at https://rockyshiv.github.io/dmsa-stories/
export const BASE_PATH = "/dmsa-stories";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
};

export default nextConfig;
