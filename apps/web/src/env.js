import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AWS_REGION: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    DYNAMO_PHOTO_SERVICE_TABLE: z.string().optional(), // New Photo Service Table
    // Auth.js (NextAuth) configuration
    AUTH_SECRET: z.string(),
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    // Crisp
    CRISP_WEBSITE_ID: z.string(),
    // Supabase DB
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    // Search by Selfie API
    SEARCH_BY_SELFIE_FUNCTION_NAME: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
    NEXT_PUBLIC_IMAGE_HANDLER_URL: z.string().url(),
    NEXT_PUBLIC_IMAGE_BUCKET: z.string(),
    NEXT_PUBLIC_IMAGE_CDN_URL: z.string().url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    DYNAMO_PHOTO_SERVICE_TABLE: process.env.DYNAMO_PHOTO_SERVICE_TABLE,
    SEARCH_BY_SELFIE_FUNCTION_NAME: process.env.SEARCH_BY_SELFIE_FUNCTION_NAME,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    // Crisp
    CRISP_WEBSITE_ID: process.env.CRISP_WEBSITE_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Supabase DB
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // Image Handler
    NEXT_PUBLIC_IMAGE_HANDLER_URL: process.env.NEXT_PUBLIC_IMAGE_HANDLER_URL,
    NEXT_PUBLIC_IMAGE_BUCKET: process.env.NEXT_PUBLIC_IMAGE_BUCKET,
    NEXT_PUBLIC_IMAGE_CDN_URL: process.env.NEXT_PUBLIC_IMAGE_CDN_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
