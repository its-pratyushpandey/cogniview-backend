import type { NextConfig } from "next";

const nextDistDir = process.env.NEXT_DIST_DIR || ".next";
const isOneDriveWorkspace = process.cwd().toLowerCase().includes("\\onedrive\\");
const oneDriveCacheMode = (process.env.NEXT_ONEDRIVE_CACHE_MODE || "memory").toLowerCase();

const nextConfig: NextConfig = {
  distDir: nextDistDir,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    // OneDrive can intermittently remove/update webpack fs cache files during dev.
    // Use in-memory caching there to keep rebuilds fast and avoid ENOENT pack/chunk failures.
    if (dev && isOneDriveWorkspace) {
      if (oneDriveCacheMode === "off") {
        config.cache = false;
      } else {
        config.cache = {
          type: "memory",
          maxGenerations: 1,
        };
      }
    }

    return config;
  },
};

export default nextConfig;
