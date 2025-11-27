declare module "@/env" {
  export const env: {
    NODE_ENV: "development" | "test" | "production";
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    DYNAMO_PHOTO_SERVICE_TABLE?: string;
    AUTH_SECRET: string;
    AUTH_URL?: string;
    CRISP_WEBSITE_ID: string;
    GOOGLE_ANALYTICS_ID?: string;
    NEXT_PUBLIC_SITE_URL: string;
    // Image Handler
    // NEXT_PUBLIC_IMAGE_HANDLER_URL: string;
    // NEXT_PUBLIC_IMAGE_BUCKET: string;
    // Supabase DB
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;

    SEARCH_BY_SELFIE_FUNCTION_NAME: string;
  };
}
