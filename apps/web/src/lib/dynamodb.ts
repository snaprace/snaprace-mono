import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "@/env";

const client = new DynamoDBClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const dynamoClient = DynamoDBDocumentClient.from(client);
export const TABLES = {
  GALLERIES: env.DYNAMO_GALLERIES_TABLE,
  EVENTS: env.DYNAMO_EVENTS_TABLE,
  PHOTOS: env.DYNAMO_PHOTOS_TABLE,
  ORGANIZATIONS: env.DYNAMO_ORGANIZATIONS_TABLE,
  TIMING_RESULTS: env.DYNAMO_TIMING_RESULTS_TABLE,
  EVENT_PHOTOS: env.DYNAMO_EVENT_PHOTOS_TABLE,
  PHOTO_BIB_INDEX: env.DYNAMO_PHOTO_BIB_INDEX_TABLE,
  PHOTO_SERVICE: env.DYNAMO_PHOTO_SERVICE_TABLE,
} as const;
