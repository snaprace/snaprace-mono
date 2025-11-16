#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ImageRekognitionStack } from '../lib/image-rekognition-stack';

const app = new cdk.App();

new ImageRekognitionStack(app, 'ImageRekognitionStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
