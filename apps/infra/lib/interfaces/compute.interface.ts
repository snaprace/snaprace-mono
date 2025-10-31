/**
 * Compute (Lambda) 관련 인터페이스 정의
 */

export interface LambdaFunctionConfig {
  functionName: string;
  handler: string;
  timeout?: number; // seconds
  memorySize?: number; // MB
  runtime?: string;
  environment?: { [key: string]: string };
}

export interface LambdaEnvironment {
  PHOTOS_TABLE_NAME: string;
  PHOTO_FACES_TABLE_NAME?: string;
  RUNNERS_TABLE_NAME?: string;
  EVENTS_TABLE_NAME?: string;
  QUEUE_URL?: string;
  CLOUDFRONT_DOMAIN_NAME?: string;
}

