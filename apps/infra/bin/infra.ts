#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SnapRaceStack } from '../lib/stacks/snaprace-stack';

const app = new cdk.App();

// Stage 컨텍스트 읽기 (기본값: dev)
const stage = app.node.tryGetContext('stage') || 'dev';

// SnapRace 스택 생성
new SnapRaceStack(app, `SnapRaceStack-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  description: `SnapRace Infrastructure Stack (${stage})`,
  tags: {
    Project: 'SnapRace',
    Environment: stage,
    ManagedBy: 'CDK'
  }
});

app.synth();
