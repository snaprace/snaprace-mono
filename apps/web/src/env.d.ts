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
    BUCKET: string;
    AUTH_SECRET: string;
    AUTH_URL?: string;
    CRISP_WEBSITE_ID: string;
  };
}
