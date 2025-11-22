declare module "@/env" {
  export const env: {
    NODE_ENV: "development" | "test" | "production";
    AWS_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    DYNAMO_GALLERIES_TABLE: string;
    DYNAMO_EVENTS_TABLE: string;
    DYNAMO_PHOTOS_TABLE: string;
    DYNAMO_FEEDBACKS_TABLE: string;
    DYNAMO_ORGANIZATIONS_TABLE: string;
    DYNAMO_TIMING_RESULTS_TABLE: string;
    DYNAMO_EVENT_PHOTOS_TABLE?: string;
    DYNAMO_PHOTO_BIB_INDEX_TABLE?: string;
    DYNAMO_PHOTO_SERVICE_TABLE?: string;
    PHOTO_SEARCH_API_URL?: string;
    BUCKET: string;
    AUTH_SECRET: string;
    AUTH_URL?: string;
    CRISP_WEBSITE_ID: string;
    GOOGLE_ANALYTICS_ID?: string;
    NEXT_PUBLIC_SITE_URL: string;
    // Supabase DB
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  };
}
