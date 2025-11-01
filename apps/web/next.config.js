/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    unoptimized: true,
    remotePatterns: [
      // CloudFront custom domain
      {
        protocol: "https",
        hostname: "images.snap-race.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default config;
