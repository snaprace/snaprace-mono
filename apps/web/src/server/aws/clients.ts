import { S3Client } from "@aws-sdk/client-s3";

import { env } from "@/env";
import { dynamoClient, TABLES } from "@/lib/dynamodb";

export const s3 = new S3Client({
  region: env.AWS_REGION,
});

export const ddb = dynamoClient;

export const BUCKET = env.BUCKET;
