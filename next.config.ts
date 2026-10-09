import type { NextConfig } from "next";

// Published as a static site on GitHub Pages (repo rockyshiv/myithri) at https://myithri.auraclusive.com/.
// The old address https://rockyshiv.github.io/dmsa-stories/ forwards here (redirect pages in that repo).
export const BASE_PATH = "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
};

export default nextConfig;
