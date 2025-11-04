#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { PhotoProcessingStack } from '../lib/photo-processing-stack'

const app = new cdk.App()
new PhotoProcessingStack(app, 'PhotoProcessingStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
})
