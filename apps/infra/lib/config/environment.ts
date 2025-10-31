import { Duration } from 'aws-cdk-lib';

export interface EnvironmentConfig {
  stage: 'dev' | 'staging' | 'prod';
  region: string;
  account: string;
  photosBucketName: string;
  rekognitionMinConfidence: number;
  lambdaTimeout: Duration;
  lambdaMemorySize: number;
}

export const getConfig = (stage: string): EnvironmentConfig => {
  const baseConfig = {
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
    account: process.env.CDK_DEFAULT_ACCOUNT || ''
  };

  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      ...baseConfig,
      stage: 'dev',
      photosBucketName: 'snaprace-photos-dev',
      rekognitionMinConfidence: 80,
      lambdaTimeout: Duration.seconds(30),
      lambdaMemorySize: 512
    },
    staging: {
      ...baseConfig,
      stage: 'staging',
      photosBucketName: 'snaprace-photos-staging',
      rekognitionMinConfidence: 85,
      lambdaTimeout: Duration.seconds(60),
      lambdaMemorySize: 768
    },
    prod: {
      ...baseConfig,
      stage: 'prod',
      photosBucketName: 'snaprace-photos-prod',
      rekognitionMinConfidence: 90,
      lambdaTimeout: Duration.minutes(5),
      lambdaMemorySize: 1024
    }
  };

  return configs[stage] || configs.dev;
};

