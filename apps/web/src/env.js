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
    DYNAMO_GALLERIES_TABLE: z.string(),
    DYNAMO_EVENTS_TABLE: z.string(),
    DYNAMO_PHOTOS_TABLE: z.string(),
    DYNAMO_FEEDBACKS_TABLE: z.string(),
    DYNAMO_ORGANIZATIONS_TABLE: z.string(),
    DYNAMO_TIMING_RESULTS_TABLE: z.string(),
    BUCKET: z.string(),
    // Auth.js (NextAuth) configuration
    AUTH_SECRET: z.string(),
    AUTH_URL: z.string().url().optional(),
    // Crisp
    CRISP_WEBSITE_ID: z.string(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
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
    DYNAMO_GALLERIES_TABLE: process.env.DYNAMO_GALLERIES_TABLE,
    DYNAMO_EVENTS_TABLE: process.env.DYNAMO_EVENTS_TABLE,
    DYNAMO_PHOTOS_TABLE: process.env.DYNAMO_PHOTOS_TABLE,
    DYNAMO_FEEDBACKS_TABLE: process.env.DYNAMO_FEEDBACKS_TABLE,
    DYNAMO_ORGANIZATIONS_TABLE: process.env.DYNAMO_ORGANIZATIONS_TABLE,
    DYNAMO_TIMING_RESULTS_TABLE: process.env.DYNAMO_TIMING_RESULTS_TABLE,
    BUCKET: process.env.BUCKET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    // Crisp
    CRISP_WEBSITE_ID: process.env.CRISP_WEBSITE_ID,
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
