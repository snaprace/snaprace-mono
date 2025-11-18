#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ImageRekognitionStack } from "../lib/image-rekognition-stack";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from packages/image-rekognition/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = new cdk.App();

new ImageRekognitionStack(app, "ImageRekognitionStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
