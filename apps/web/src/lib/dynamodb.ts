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
  PHOTO_SERVICE: env.DYNAMO_PHOTO_SERVICE_TABLE,
} as const;
